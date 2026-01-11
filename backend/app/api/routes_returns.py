from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.security import get_current_user
from app.database.session import get_db
from app.models.entities import Client, Debt, DebtPayment, Product, Return, ReturnItem, Sale, SaleItem
from app.models.user import User
from app.schemas import returns as return_schema
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)


def _apply_date_filters(
    query, start_date: date | None, end_date: date | None, column=Return.created_at
):
    if start_date:
        query = query.where(column >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(column <= datetime.combine(end_date, time.max))
    return query


def _enforce_scope(query, current_user: User):
    if current_user.role == "employee":
        query = query.where(Return.created_by_id == current_user.id)
    return query


def _get_sale_for_return(db: Session, sale_id: int, current_user: User) -> Sale:
    sale = db.execute(
        select(Sale)
        .where(Sale.id == sale_id)
        .options(selectinload(Sale.items))
        .with_for_update()
    ).scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


def _build_return_items(
    sale: Sale, payload: return_schema.ReturnCreate, db: Session
) -> list[ReturnItem]:
    if payload.type not in {"by_receipt", "by_item"}:
        raise HTTPException(status_code=400, detail="Неверный тип возврата")

    sale_items_map = {item.id: item for item in sale.items}
    items_to_process: list[tuple[SaleItem, int]] = []

    if payload.type == "by_receipt":
        items_to_process = [(item, item.quantity) for item in sale.items]
    else:
        if not payload.items:
            raise HTTPException(status_code=400, detail="Укажите позиции для возврата")
        for entry in payload.items:
            if entry.sale_item_id not in sale_items_map:
                raise HTTPException(status_code=404, detail=f"Позиция {entry.sale_item_id} не найдена")
            sale_item = sale_items_map[entry.sale_item_id]
            if entry.quantity <= 0 or entry.quantity > sale_item.quantity:
                raise HTTPException(status_code=400, detail="Неверное количество для возврата")
            items_to_process.append((sale_item, entry.quantity))

    return_items: list[ReturnItem] = []
    for sale_item, qty in items_to_process:
        db.execute(select(SaleItem).where(SaleItem.id == sale_item.id).with_for_update()).scalar_one()
        returned_qty = db.execute(
            select(func.coalesce(func.sum(ReturnItem.quantity), 0)).where(
                ReturnItem.sale_item_id == sale_item.id
            )
        ).scalar_one()
        available_for_return = max(sale_item.quantity - int(returned_qty or 0), 0)
        if qty > available_for_return:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Доступно к возврату только {available_for_return} шт.",
            )

        unit_price = (sale_item.total / sale_item.quantity) if sale_item.quantity else sale_item.price
        amount = unit_price * qty
        adjust_stock(db, sale.branch_id, sale_item.product_id, qty)
        product = db.get(Product, sale_item.product_id)
        if product:
            product.quantity += qty
        return_items.append(
            ReturnItem(
                sale_item_id=sale_item.id,
                quantity=qty,
                amount=amount,
            )
        )
    return return_items


@router.post("", response_model=return_schema.ReturnDetail, status_code=status.HTTP_201_CREATED)
async def create_return(
    payload: return_schema.ReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sale = _get_sale_for_return(db, payload.sale_id, current_user)
        return_items = _build_return_items(sale, payload, db)

        return_entry = Return(
            sale_id=sale.id,
            branch_id=sale.branch_id,
            type=payload.type,
            reason=payload.reason,
            created_by_id=current_user.id,
        )
        db.add(return_entry)
        db.flush()

        total_amount = 0.0
        for item in return_items:
            item.return_id = return_entry.id
            total_amount += item.amount
            db.add(item)

        if payload.apply_to_debt:
            if not sale.client_id:
                raise HTTPException(status_code=400, detail="У чека нет клиента для погашения долга")
            client = sale.client or db.get(Client, sale.client_id)
            if not client:
                raise HTTPException(status_code=404, detail="Клиент не найден")

            outstanding = Decimal(str(client.total_debt or 0)).quantize(Decimal("0.01"))
            return_total = Decimal(str(total_amount)).quantize(Decimal("0.01"))
            max_offset = min(outstanding, return_total)
            if max_offset <= 0:
                raise HTTPException(status_code=400, detail="У клиента нет долга для зачета")

            if payload.debt_offset_amount is None:
                offset_amount = max_offset
            else:
                offset_amount = Decimal(str(payload.debt_offset_amount)).quantize(Decimal("0.01"))
                if offset_amount < 0:
                    raise HTTPException(status_code=400, detail="Сумма зачета должна быть больше или равна 0")

            if offset_amount > max_offset:
                raise HTTPException(
                    status_code=400,
                    detail="Сумма зачета не может превышать сумму возврата или долг клиента",
                )

            return_entry.apply_to_debt = True
            return_entry.debt_offset_amount = offset_amount
            if offset_amount > 0:
                remaining = offset_amount
                debts = (
                    db.execute(
                        select(Debt)
                        .where(Debt.client_id == client.id, Debt.amount > Debt.paid)
                        .order_by(Debt.created_at)
                    )
                    .scalars()
                    .all()
                )
                for debt in debts:
                    debt_remaining = Decimal(str(debt.amount)) - Decimal(str(debt.paid or 0))
                    if debt_remaining <= 0:
                        continue
                    portion = min(remaining, debt_remaining)
                    debt.paid = float(Decimal(str(debt.paid or 0)) + portion)
                    remaining -= portion
                    if remaining <= 0:
                        break

                client.total_debt = float(max(outstanding - offset_amount, Decimal("0")))
                debt_payment = DebtPayment(
                    client_id=client.id,
                    amount=offset_amount,
                    payment_type="offset",
                    processed_by_id=current_user.id,
                    created_by_id=current_user.id,
                    branch_id=sale.branch_id,
                )
                db.add(debt_payment)

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(return_entry)
    db.refresh(return_entry, attribute_names=["items", "branch", "created_by"])
    return await get_return_detail(return_entry.id, db=db, current_user=current_user)


@router.get("", response_model=list[return_schema.ReturnSummary])
async def list_returns(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    created_by_id: int | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Return)
        .options(
            joinedload(Return.branch),
            joinedload(Return.created_by),
            joinedload(Return.sale).joinedload(Sale.client),
            selectinload(Return.items),
        )
        .order_by(Return.created_at.desc())
    )
    query = _enforce_scope(query, current_user)
    if branch_id:
        query = query.where(Return.branch_id == branch_id)
    if created_by_id:
        query = query.where(Return.created_by_id == created_by_id)
    if type:
        query = query.where(Return.type == type)
    query = _apply_date_filters(query, start_date, end_date)

    return_entries = db.execute(query).scalars().unique().all()
    summaries: list[return_schema.ReturnSummary] = []
    for entry in return_entries:
        total_amount = sum(item.amount for item in entry.items)
        summaries.append(
            return_schema.ReturnSummary(
                id=entry.id,
                sale_id=entry.sale_id,
                branch_id=entry.branch_id,
                branch_name=entry.branch.name if entry.branch else None,
                created_by_id=entry.created_by_id,
                created_by_name=entry.created_by.name if entry.created_by else None,
                client_name=entry.sale.client.name if entry.sale and entry.sale.client else None,
                type=entry.type,
                total_amount=total_amount,
                created_at=entry.created_at,
            )
        )
    return summaries


@router.get("/{return_id}", response_model=return_schema.ReturnDetail)
async def get_return_detail(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.execute(
        select(Return)
        .where(Return.id == return_id)
        .options(
            joinedload(Return.branch),
            joinedload(Return.created_by),
            selectinload(Return.items)
            .selectinload(ReturnItem.sale_item)
            .selectinload(SaleItem.product),
            joinedload(Return.sale),
        )
    ).scalars().unique().one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Возврат не найден")
    if current_user.role == "employee" and entry.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к возврату")

    items: list[return_schema.ReturnItem] = []
    for item in entry.items:
        product = item.sale_item.product if item.sale_item else None
        items.append(
            return_schema.ReturnItem(
                id=item.id,
                sale_item_id=item.sale_item_id,
                quantity=item.quantity,
                amount=item.amount,
                product_id=product.id if product else 0,
                product_name=product.name if product else None,
            )
        )

    total_amount = sum(item.amount for item in entry.items)
    return return_schema.ReturnDetail(
        id=entry.id,
        sale_id=entry.sale_id,
        branch_id=entry.branch_id,
        branch_name=entry.branch.name if entry.branch else None,
        created_by_id=entry.created_by_id,
        created_by_name=entry.created_by.name if entry.created_by else None,
        client_name=entry.sale.client.name if entry.sale and entry.sale.client else None,
        type=entry.type,
        reason=entry.reason,
        total_amount=total_amount,
        created_at=entry.created_at,
        items=items,
    )

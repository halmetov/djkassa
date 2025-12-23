from __future__ import annotations

from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.security import get_current_user
from app.database.session import get_db
from app.models.entities import Product, Return, ReturnItem, Sale, SaleItem
from app.models.user import User
from app.schemas import returns as return_schema
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)


def _apply_date_filters(query, start_date: date | None, end_date: date | None):
    if start_date:
        query = query.where(Return.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(Return.created_at <= datetime.combine(end_date, time.max))
    return query


def _enforce_scope(query, current_user: User):
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        query = query.where(Return.branch_id == current_user.branch_id)
    return query


def _get_sale_for_return(db: Session, sale_id: int, current_user: User) -> Sale:
    sale = db.execute(
        select(Sale)
        .where(Sale.id == sale_id)
        .options(selectinload(Sale.items))
    ).scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        if sale.branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Нет доступа к этому чеку")
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

    if sale.client_id and sale.paid_debt > 0:
        client = sale.client
        if client:
            client.total_debt = max(client.total_debt - total_amount, 0)

    db.commit()
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
    if current_user.role == "employee" and current_user.branch_id != entry.branch_id:
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

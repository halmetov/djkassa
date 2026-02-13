from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.security import get_current_user, reject_production_manager
from app.core.config import get_settings
from app.database.session import get_db
from app.models.entities import Branch, Counterparty, CounterpartySale, CounterpartySaleItem, Product
from app.models.user import User
from app.schemas import counterparty_sales as sales_schema
from app.services.inventory import adjust_stock

router = APIRouter(
    redirect_slashes=False,
    dependencies=[Depends(get_current_user), Depends(reject_production_manager)],
)


def _get_sale_branch(db: Session) -> Branch:
    settings = get_settings()
    branch = db.execute(select(Branch).where(Branch.name == settings.sale_branch_name)).scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=400, detail=f"Филиал продажи '{settings.sale_branch_name}' не найден")
    return branch


def _apply_date_filters(
    query, start_date: date | None, end_date: date | None, column=CounterpartySale.created_at
):
    if start_date:
        query = query.where(column >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(column <= datetime.combine(end_date, time.max))
    return query


def _map_sale_to_summary(sale: CounterpartySale) -> sales_schema.CounterpartySaleSummary:
    return sales_schema.CounterpartySaleSummary(
        id=sale.id,
        created_at=sale.created_at,
        counterparty_id=sale.counterparty_id,
        counterparty_name=sale.counterparty.name if sale.counterparty else None,
        counterparty_company_name=sale.counterparty.company_name if sale.counterparty else None,
        counterparty_phone=sale.counterparty.phone if sale.counterparty else None,
        total_amount=float(sale.total_amount or 0),
        created_by_id=sale.created_by_id,
        created_by_name=sale.created_by.name if sale.created_by else None,
    )


@router.get("", response_model=list[sales_schema.CounterpartySaleSummary])
async def list_counterparty_sales(
    start_date: date | None = None,
    end_date: date | None = None,
    counterparty_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(CounterpartySale).options(
        joinedload(CounterpartySale.counterparty), joinedload(CounterpartySale.created_by)
    )
    if counterparty_id:
        query = query.where(CounterpartySale.counterparty_id == counterparty_id)
    query = _apply_date_filters(query, start_date, end_date).order_by(CounterpartySale.created_at.desc())
    sales = db.execute(query).scalars().unique().all()
    return [_map_sale_to_summary(sale) for sale in sales]


@router.post("", response_model=sales_schema.CounterpartySaleDetail, status_code=status.HTTP_201_CREATED)
async def create_counterparty_sale(
    payload: sales_schema.CounterpartySaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Позиции продажи не указаны")

    store_branch = _get_sale_branch(db)
    branch_id = store_branch.id

    if payload.counterparty_id is not None:
        counterparty = db.get(Counterparty, payload.counterparty_id)
        if not counterparty:
            raise HTTPException(status_code=404, detail="Counterparty not found")

    total_amount = Decimal("0")
    try:
        sale = CounterpartySale(
            counterparty_id=payload.counterparty_id,
            created_by_id=current_user.id,
            branch_id=branch_id,
            total_amount=Decimal("0"),
        )
        db.add(sale)
        db.flush()

        for item in payload.items:
            product = db.get(Product, item.product_id)
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            quantity = Decimal(str(item.quantity))
            if quantity <= 0:
                raise HTTPException(status_code=400, detail="Количество должно быть больше нуля")
            if quantity != quantity.to_integral_value():
                raise HTTPException(status_code=400, detail="Количество должно быть целым числом")
            price = Decimal(str(item.price))
            line_total = quantity * price
            cost_snapshot = Decimal(str(product.purchase_price or 0))

            adjust_stock(db, branch_id, item.product_id, -int(quantity), allow_negative=True)
            product.quantity -= int(quantity)

            db.add(
                CounterpartySaleItem(
                    sale_id=sale.id,
                    product_id=item.product_id,
                    quantity=quantity,
                    price=price,
                    cost_price_snapshot=cost_snapshot,
                )
            )
            total_amount += line_total

        sale.total_amount = total_amount.quantize(Decimal("0.01"))
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(sale)
    return await get_counterparty_sale_detail(sale.id, db=db)


@router.get("/{sale_id}", response_model=sales_schema.CounterpartySaleDetail)
async def get_counterparty_sale_detail(sale_id: int, db: Session = Depends(get_db)):
    sale = db.execute(
        select(CounterpartySale)
        .where(CounterpartySale.id == sale_id)
        .options(
            joinedload(CounterpartySale.counterparty),
            joinedload(CounterpartySale.created_by),
            joinedload(CounterpartySale.branch),
            selectinload(CounterpartySale.items).selectinload(CounterpartySaleItem.product),
        )
    ).scalars().unique().one_or_none()

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    items: list[sales_schema.CounterpartySaleItemDetail] = []
    for item in sale.items:
        items.append(
            sales_schema.CounterpartySaleItemDetail(
                id=item.id,
                product_id=item.product_id,
                quantity=float(item.quantity),
                price=float(item.price),
                cost_price_snapshot=float(item.cost_price_snapshot) if item.cost_price_snapshot is not None else None,
                created_at=item.created_at,
                product_name=item.product.name if item.product else None,
            )
        )

    return sales_schema.CounterpartySaleDetail(
        id=sale.id,
        created_at=sale.created_at,
        counterparty_id=sale.counterparty_id,
        counterparty_name=sale.counterparty.name if sale.counterparty else None,
        counterparty_company_name=sale.counterparty.company_name if sale.counterparty else None,
        counterparty_phone=sale.counterparty.phone if sale.counterparty else None,
        total_amount=float(sale.total_amount or 0),
        created_by_id=sale.created_by_id,
        created_by_name=sale.created_by.name if sale.created_by else None,
        branch_id=sale.branch_id,
        branch_name=sale.branch.name if sale.branch else None,
        items=items,
    )

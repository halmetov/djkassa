from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user
from app.database.session import get_db
from app.models.entities import Client, Debt, Product, Sale, SaleItem, Stock
from app.models.user import User
from app.schemas import sales as sales_schema
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)


def _apply_date_filters(query, start_date: date | None, end_date: date | None):
    if start_date:
        query = query.where(Sale.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(Sale.created_at <= datetime.combine(end_date, time.max))
    return query


def _enforce_employee_scope(query, current_user: User):
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        query = query.where(Sale.branch_id == current_user.branch_id)
    return query


def _map_sale_to_summary(sale: Sale) -> sales_schema.SaleSummary:
    return sales_schema.SaleSummary(
        id=sale.id,
        created_at=sale.created_at,
        branch_id=sale.branch_id,
        branch_name=sale.branch.name if sale.branch else None,
        seller_id=sale.seller_id,
        seller_name=sale.seller.name if sale.seller else None,
        client_id=sale.client_id,
        client_name=sale.client.name if sale.client else None,
        total_amount=sale.total_amount,
        paid_cash=sale.paid_cash,
        paid_card=sale.paid_card,
        paid_debt=sale.paid_debt,
        payment_type=sale.payment_type,
    )


@router.get("", response_model=list[sales_schema.SaleSummary])
async def list_sales(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    seller_id: int | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Sale).options(
        joinedload(Sale.seller), joinedload(Sale.branch), joinedload(Sale.client)
    )
    query = _enforce_employee_scope(query, current_user)
    if branch_id:
        query = query.where(Sale.branch_id == branch_id)
    if seller_id:
        query = query.where(Sale.seller_id == seller_id)
    if client_id:
        query = query.where(Sale.client_id == client_id)
    query = _apply_date_filters(query, start_date, end_date).order_by(Sale.created_at.desc())
    sales = db.execute(query).scalars().unique().all()
    return [_map_sale_to_summary(sale) for sale in sales]


@router.post("", response_model=sales_schema.SaleDetail, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: sales_schema.SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "employee":
        branch_id = current_user.branch_id
        seller_id = current_user.id
        if branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
    else:
        branch_id = payload.branch_id
        seller_id = payload.seller_id or current_user.id

    if branch_id is None:
        raise HTTPException(status_code=400, detail="Не указан филиал для продажи")

    total = Decimal("0")
    sale = Sale(
        branch_id=branch_id,
        seller_id=seller_id,
        client_id=payload.client_id,
        paid_cash=payload.paid_cash,
        paid_card=payload.paid_card,
        paid_debt=payload.paid_debt,
        payment_type=payload.payment_type,
        total_amount=Decimal("0"),
    )
    db.add(sale)
    db.flush()

    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        stock = db.execute(
            select(Stock).where(Stock.branch_id == branch_id, Stock.product_id == item.product_id)
        ).scalar_one_or_none()
        if not stock or stock.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")

        price = Decimal(str(item.price))
        discount = Decimal(str(item.discount))
        quantity = Decimal(item.quantity)
        line_total = (price - discount) * quantity
        adjust_stock(db, branch_id, item.product_id, -item.quantity)
        product.quantity = max(product.quantity - item.quantity, 0)

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=item.price,
            discount=item.discount,
            total=float(line_total),
        )
        db.add(sale_item)
        total += line_total

    paid_total = (
        Decimal(str(payload.paid_cash))
        + Decimal(str(payload.paid_card))
        + Decimal(str(payload.paid_debt))
    )
    total = total.quantize(Decimal("0.01"))
    paid_total = paid_total.quantize(Decimal("0.01"))
    if paid_total != total:
        raise HTTPException(status_code=400, detail="Сумма оплаты не совпадает с итогом")

    sale.total_amount = total

    if payload.paid_debt > 0 and payload.client_id:
        client = db.get(Client, payload.client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        client.total_debt += payload.paid_debt
        debt = Debt(client_id=client.id, sale_id=sale.id, amount=payload.paid_debt)
        db.add(debt)

    db.commit()
    db.refresh(sale)
    db.refresh(sale, attribute_names=["items", "seller", "branch", "client"])
    return await get_sale_detail(sale.id, db=db, current_user=current_user)


def _assert_sale_access(sale: Sale | None, current_user: User):
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        if sale.branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Нет доступа к продаже")


@router.get("/{sale_id}", response_model=sales_schema.SaleDetail)
async def get_sale_detail(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = db.execute(
        select(Sale)
        .where(Sale.id == sale_id)
        .options(
            joinedload(Sale.seller),
            joinedload(Sale.branch),
            joinedload(Sale.client),
            joinedload(Sale.items).joinedload(SaleItem.product),
        )
    ).scalar_one_or_none()
    _assert_sale_access(sale, current_user)

    items: list[sales_schema.SaleItemDetail] = []
    for item in sale.items:
        product = item.product
        items.append(
            sales_schema.SaleItemDetail(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price,
                discount=item.discount,
                total=item.total,
                product_name=product.name if product else None,
                product_unit=product.unit if product else None,
            )
        )

    return sales_schema.SaleDetail(
        id=sale.id,
        created_at=sale.created_at,
        branch_id=sale.branch_id,
        branch_name=sale.branch.name if sale.branch else None,
        branch_address=sale.branch.address if sale.branch else None,
        seller_id=sale.seller_id,
        seller_name=sale.seller.name if sale.seller else None,
        client_id=sale.client_id,
        client_name=sale.client.name if sale.client else None,
        payment_type=sale.payment_type,
        total_amount=sale.total_amount,
        paid_cash=sale.paid_cash,
        paid_card=sale.paid_card,
        paid_debt=sale.paid_debt,
        items=items,
    )

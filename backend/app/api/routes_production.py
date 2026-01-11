from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user, require_production_access
from app.core.enums import UserRole
from app.database.session import get_db
from app.models import (
    Branch,
    ProductionExpense,
    ProductionOrder,
    ProductionOrderMaterial,
    ProductionOrderPayment,
    Stock,
    User,
)
from app.schemas import production as production_schema

router = APIRouter(redirect_slashes=False, dependencies=[Depends(require_production_access)])


WORKSHOP_NAME = "Цех"


def _get_workshop_branch(db: Session) -> Branch:
    branch = db.query(Branch).filter(Branch.name == WORKSHOP_NAME).first()
    if not branch:
        branch = Branch(name=WORKSHOP_NAME, active=True)
        db.add(branch)
        db.commit()
        db.refresh(branch)
    return branch


def _ensure_order(db: Session, order_id: int) -> ProductionOrder:
    order = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.materials),
            joinedload(ProductionOrder.payments),
        )
        .filter(ProductionOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    return order


@router.get("/orders", response_model=list[production_schema.ProductionOrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.materials),
            joinedload(ProductionOrder.payments),
        )
        .order_by(ProductionOrder.created_at.desc())
        .all()
    )
    return orders


@router.post("/orders", response_model=production_schema.ProductionOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: production_schema.ProductionOrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch = _get_workshop_branch(db)
    order = ProductionOrder(
        title=payload.title,
        amount=payload.amount or Decimal("0"),
        customer_name=payload.customer_name,
        description=payload.description,
        status=payload.status or "open",
        created_by_id=current_user.id,
        branch_id=payload.branch_id or branch.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/orders/{order_id}", response_model=production_schema.ProductionOrderOut)
def update_order(
    order_id: int,
    payload: production_schema.ProductionOrderUpdate,
    db: Session = Depends(get_db),
):
    order = _ensure_order(db, order_id)
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}", response_model=production_schema.ProductionOrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return _ensure_order(db, order_id)


@router.post("/orders/{order_id}/materials", response_model=production_schema.MaterialOut, status_code=status.HTTP_201_CREATED)
def add_material(
    order_id: int,
    payload: production_schema.MaterialAddCreate,
    db: Session = Depends(get_db),
):
    order = _ensure_order(db, order_id)
    branch_id = order.branch_id or _get_workshop_branch(db).id
    stock = (
        db.query(Stock)
        .filter(Stock.branch_id == branch_id, Stock.product_id == payload.product_id)
        .with_for_update()
        .first()
    )
    if not stock or stock.quantity < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недостаточно остатков на складе Цех")
    stock.quantity = stock.quantity - float(payload.quantity)
    material = ProductionOrderMaterial(
        order_id=order.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.post("/orders/{order_id}/payments", response_model=production_schema.PaymentOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    order_id: int,
    payload: production_schema.PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_order(db, order_id)
    payment = ProductionOrderPayment(
        order_id=order_id,
        employee_id=payload.employee_id,
        amount=payload.amount,
        note=payload.note,
        created_by_id=current_user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/expenses", response_model=list[production_schema.ProductionExpenseOut])
def list_expenses(
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(ProductionExpense)
    if start_date:
        query = query.filter(ProductionExpense.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(ProductionExpense.created_at <= datetime.combine(end_date, datetime.max.time()))
    return query.order_by(ProductionExpense.created_at.desc()).all()


@router.post("/expenses", response_model=production_schema.ProductionExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: production_schema.ProductionExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    branch_id = payload.branch_id
    if branch_id is None:
        branch = _get_workshop_branch(db)
        branch_id = branch.id
    expense = ProductionExpense(
        title=payload.title,
        amount=payload.amount,
        order_id=payload.order_id,
        created_by_id=current_user.id,
        branch_id=branch_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/stock")
def production_stock(db: Session = Depends(get_db)):
    branch = _get_workshop_branch(db)
    stocks = (
        db.query(Stock)
        .options(joinedload(Stock.product))
        .filter(Stock.branch_id == branch.id)
        .order_by(Stock.id.desc())
        .all()
    )
    return [
        {
            "id": stock.id,
            "product_id": stock.product_id,
            "product_name": stock.product.name if stock.product else None,
            "quantity": stock.quantity,
            "unit": stock.product.unit if stock.product else None,
            "barcode": stock.product.barcode if stock.product else None,
            "photo": stock.product.photo if stock.product else None,
        }
        for stock in stocks
    ]


@router.get("/employees", response_model=list[dict])
def production_employees(db: Session = Depends(get_db)):
    employees = db.query(User).filter(User.role != UserRole.ADMIN).all()
    return [
        {
            "id": emp.id,
            "name": emp.name,
            "role": emp.role.value if hasattr(emp.role, "value") else emp.role,
        }
        for emp in employees
    ]

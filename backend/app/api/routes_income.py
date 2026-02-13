from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth.security import get_current_user, require_admin, require_employee
from app.core.enums import UserRole
from app.database.session import get_db
from app.models.entities import Branch, Income, IncomeItem, Product
from app.models.user import User
from app.schemas import income as income_schema
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)


def _get_or_create_workshop(db: Session) -> Branch:
    workshop = db.query(Branch).filter(Branch.is_workshop.is_(True)).first()
    if workshop:
        return workshop
    workshop = db.query(Branch).filter(Branch.name == "Цех").first()
    if workshop:
        workshop.is_workshop = True
        db.commit()
        db.refresh(workshop)
        return workshop
    workshop = Branch(name="Цех", active=True, is_workshop=True)
    db.add(workshop)
    db.commit()
    db.refresh(workshop)
    return workshop


def _resolve_branch(branch_id: int | None, current_user: User, db: Session) -> int:
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_value == UserRole.EMPLOYEE.value:
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        return current_user.branch_id
    if role_value in {UserRole.PRODUCTION_MANAGER.value, UserRole.MANAGER.value}:
        return _get_or_create_workshop(db).id
    if branch_id is None:
        raise HTTPException(status_code=400, detail="Не указан филиал")
    return branch_id


@router.get("", response_model=list[income_schema.Income], dependencies=[Depends(require_employee)])
async def list_income(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    target_branch_id = _resolve_branch(branch_id, current_user, db) if branch_id or role_value in {UserRole.EMPLOYEE.value, UserRole.PRODUCTION_MANAGER.value} else None
    query = select(Income).order_by(Income.created_at.desc())
    if target_branch_id is not None:
        query = query.where(Income.branch_id == target_branch_id)
    result = db.execute(query)
    incomes = result.scalars().unique().all()
    for income in incomes:
        db.refresh(income, attribute_names=["items"])
    return incomes


@router.post(
    "",
    response_model=income_schema.Income,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_employee)],
)
async def create_income(
    payload: income_schema.IncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    branch_id = _resolve_branch(payload.branch_id, current_user, db)
    income = Income(branch_id=branch_id, created_by_id=current_user.id)
    db.add(income)
    db.flush()
    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        income_item = IncomeItem(
            income_id=income.id,
            product_id=item.product_id,
            quantity=item.quantity,
            purchase_price=item.purchase_price,
            sale_price=item.sale_price,
        )
        db.add(income_item)
        product.quantity += item.quantity
        product.purchase_price = item.purchase_price
        product.sale_price = item.sale_price
        adjust_stock(db, branch_id, item.product_id, item.quantity)
    db.commit()
    db.refresh(income)
    db.refresh(income, attribute_names=["items"])
    return income


@router.delete(
    "/{income_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_admin)],
)
async def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
):
    income = db.execute(
        select(Income).where(Income.id == income_id).options(selectinload(Income.items))
    ).scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=404, detail="Приход не найден")

    try:
        for item in income.items:
            product = db.get(Product, item.product_id)
            if product:
                product.quantity -= item.quantity
            adjust_stock(db, income.branch_id, item.product_id, -item.quantity, allow_negative=True)
        db.delete(income)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"status": "ok"}

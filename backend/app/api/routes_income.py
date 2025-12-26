from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import get_current_user, require_employee
from app.database.session import get_db
from app.models.entities import Income, IncomeItem, Product
from app.models.user import User
from app.schemas import income as income_schema
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)


def _resolve_branch(branch_id: int | None, current_user: User) -> int:
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        return current_user.branch_id
    if branch_id is None:
        raise HTTPException(status_code=400, detail="Не указан филиал")
    return branch_id


@router.get("", response_model=list[income_schema.Income], dependencies=[Depends(require_employee)])
async def list_income(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_branch_id = _resolve_branch(branch_id, current_user) if branch_id or current_user.role == "employee" else None
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
    branch_id = _resolve_branch(payload.branch_id, current_user)
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
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_employee)],
)
async def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=403, detail="Удаление приходов запрещено")

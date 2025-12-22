from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import get_current_user, require_admin, require_employee
from app.database.session import get_db
from app.models.entities import Branch, Product, Stock
from app.models.user import User
from app.schemas import branches as branch_schema

router = APIRouter(redirect_slashes=False)


@router.get(
    "",
    response_model=list[branch_schema.Branch],
    dependencies=[Depends(require_employee)],
)
async def list_branches(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    query = select(Branch)
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        query = query.where(Branch.id == current_user.branch_id)
    result = db.execute(query)
    return result.scalars().all()


@router.post("", response_model=branch_schema.Branch, dependencies=[Depends(require_admin)])
async def create_branch(payload: branch_schema.BranchCreate, db: Session = Depends(get_db)):
    branch = Branch(**payload.dict())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.put("/{branch_id}", response_model=branch_schema.Branch, dependencies=[Depends(require_admin)])
async def update_branch(branch_id: int, payload: branch_schema.BranchUpdate, db: Session = Depends(get_db)):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(branch, field, value)
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_branch(branch_id: int, db: Session = Depends(get_db)):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    db.delete(branch)
    db.commit()
    return None


@router.get("/{branch_id}/stock", dependencies=[Depends(require_employee)])
async def branch_stock(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_branch = branch_id
    if current_user.role == "employee":
        if current_user.branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
        if current_user.branch_id != branch_id:
            raise HTTPException(status_code=403, detail="Нет доступа к складу филиала")
        target_branch = current_user.branch_id

    result = db.execute(
        select(Stock, Product.name)
        .join(Product, Stock.product_id == Product.id)
        .where(Stock.branch_id == target_branch)
    )
    response = []
    for stock, product_name in result.all():
        response.append(
            {
                "id": stock.id,
                "product_id": stock.product_id,
                "product": product_name,
                "quantity": stock.quantity,
                "limit": stock.product.limit if stock.product else None,
            }
        )
    return response

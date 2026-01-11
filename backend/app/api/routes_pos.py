from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import get_current_user, require_employee
from app.database.session import get_db
from app.models.entities import Branch, Product, Stock
from app.models.user import User
from app.schemas.pos import PosProduct

router = APIRouter(redirect_slashes=False)


def _resolve_branch_scope(branch_id: int | None, current_user: User) -> int | None:
    if current_user.role == "admin":
        return branch_id
    if current_user.branch_id is None:
        raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")
    return current_user.branch_id


@router.get("/products", response_model=list[PosProduct], dependencies=[Depends(require_employee)])
async def search_products_for_pos(
    query: str | None = None,
    barcode: str | None = None,
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not query and not barcode:
        return []

    target_branch = _resolve_branch_scope(branch_id, current_user)

    stmt = (
        select(Product, Stock, Branch)
        .join(Stock, Stock.product_id == Product.id, isouter=True)
        .join(Branch, Stock.branch_id == Branch.id, isouter=True)
    )

    if barcode:
        stmt = stmt.where(Product.barcode == barcode)
    elif query:
        stmt = stmt.where(func.lower(Product.name).like(f"%{query.lower()}%"))

    if target_branch is not None:
        stmt = stmt.where(Stock.branch_id == target_branch)

    results = db.execute(stmt).all()
    items: list[PosProduct] = []
    for product, stock, branch in results:
        items.append(
            PosProduct(
                id=product.id,
                name=product.name,
                barcode=product.barcode,
                sale_price=product.sale_price,
                red_price=float(product.red_price) if product.red_price is not None else None,
                unit=product.unit,
                branch_id=branch.id if branch else None,
                branch_name=branch.name if branch else None,
                quantity=stock.quantity if stock else 0,
                updated_at=product.updated_at,
            )
        )

    return items

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, select
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user
from app.core.config import get_settings
from app.database.session import get_db
from app.models.entities import Branch, Product, Stock
from app.models.user import User
from app.schemas.cashier import CashierProduct

router = APIRouter(redirect_slashes=False)


def _get_sale_branch(db: Session) -> Branch:
    settings = get_settings()
    branch = db.execute(select(Branch).where(Branch.name == settings.sale_branch_name)).scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=400, detail=f"Филиал продажи '{settings.sale_branch_name}' не найден")
    return branch


@router.get("/products", response_model=list[CashierProduct])
async def list_cashier_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Employees without branch assignment still can sell from main store; no additional filter by user branch
    sale_branch = _get_sale_branch(db)
    query = (
        select(Product, Stock)
        .join(Stock, (Stock.product_id == Product.id) & (Stock.branch_id == sale_branch.id), isouter=True)
        .options(joinedload(Product.category))
        .order_by(
            case((Product.rating.is_(None) | (Product.rating == 0), 0), else_=1),
            Product.rating.asc(),
            Product.name.asc(),
        )
    )
    rows = db.execute(query).all()
    items: list[CashierProduct] = []
    for product, stock in rows:
        items.append(
            CashierProduct(
                id=product.id,
                name=product.name,
                barcode=product.barcode,
                sale_price=product.sale_price or 0,
                unit=product.unit,
                image_url=product.image_url,
                photo=product.photo,
                available_qty=stock.quantity if stock else 0,
                category=product.category.name if product.category else None,
                rating=product.rating or 0,
            )
        )
    return items

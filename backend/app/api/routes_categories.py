import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.security import require_admin, require_employee
from app.database.session import get_db
from app.models.entities import Category, Product
from app.schemas import categories as category_schema

router = APIRouter(redirect_slashes=False)
logger = logging.getLogger(__name__)


@router.get("", response_model=list[category_schema.Category], dependencies=[Depends(require_employee)])
async def list_categories(db: Session = Depends(get_db)):
    result = db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post("", response_model=category_schema.Category, dependencies=[Depends(require_employee)])
async def create_category(payload: category_schema.CategoryCreate, db: Session = Depends(get_db)):
    category = Category(name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/{category_id}", response_model=category_schema.Category, dependencies=[Depends(require_employee)])
async def update_category(category_id: int, payload: category_schema.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    category.name = payload.name
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    try:
        products = db.execute(select(Product).where(Product.category_id == category_id)).scalars().all()
        for product in products:
            product.category_id = None
        db.delete(category)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while deleting category %s", category_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return None

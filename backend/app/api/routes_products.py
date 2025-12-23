from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.security import admin_only_for_write, get_current_user, require_employee
from app.core.config import get_settings
from app.database.session import get_db
from app.models.entities import Branch, Category, Product, Stock
from app.models.user import User
from app.schemas import stock as stock_schema
from app.schemas import products as product_schema
from app.services.files import save_upload

logger = logging.getLogger(__name__)

router = APIRouter(redirect_slashes=False)


@router.get("", response_model=list[product_schema.Product], dependencies=[Depends(require_employee)])
async def list_products(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_branch_id = branch_id
    if current_user.role == "employee":
        target_branch_id = current_user.branch_id
        if target_branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")

    query = select(Product)
    if target_branch_id is not None:
        query = (
            query.join(Stock, Stock.product_id == Product.id)
            .where(Stock.branch_id == target_branch_id)
            .distinct()
        )

    result = db.execute(query)
    return result.scalars().all()


@router.post("", response_model=product_schema.Product, dependencies=[Depends(admin_only_for_write)])
async def create_product(payload: product_schema.ProductCreate, db: Session = Depends(get_db)):
    settings = get_settings()
    safe_payload = payload.model_dump(exclude_none=True)
    logger.info("Incoming product payload: %s", safe_payload)

    if payload.category_id is not None:
        category = db.get(Category, payload.category_id)
        if category is None:
            raise HTTPException(status_code=400, detail="Категория не найдена")

    try:
        product = Product(**safe_payload)
        db.add(product)
        db.commit()
        db.refresh(product)
        return product
    except HTTPException:
        db.rollback()
        logger.exception("Business validation error while creating product")
        raise
    except IntegrityError as exc:
        db.rollback()
        logger.error("Integrity error while creating product. payload=%s error=%s", safe_payload, exc)
        original = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        base_detail = "Integrity error"
        detail = f"{base_detail}: {original}"
        if not settings.debug:
            detail = base_detail + (
                ": duplicate or constraint violation"
                if "duplicate" in original.lower() or "unique" in original.lower()
                else ""
            )
        raise HTTPException(status_code=400, detail=detail) from exc
    except (ProgrammingError, OperationalError) as exc:
        db.rollback()
        logger.error("Database schema error while creating product. payload=%s error=%s", safe_payload, exc)
        original = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        detail = f"Database schema error: {original}"
        if not settings.debug:
            detail = "Database schema error: migration mismatch or missing column"
        raise HTTPException(status_code=500, detail=detail) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while creating product. payload=%s", safe_payload)
        original = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        detail = f"Database error: {original}" if settings.debug else "Database error"
        raise HTTPException(status_code=500, detail=detail) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        db.rollback()
        logger.exception("Unexpected error while creating product. payload=%s", safe_payload)
        detail = f"Unexpected error: {exc}" if settings.debug else "Unexpected error"
        raise HTTPException(status_code=500, detail=detail) from exc



@router.put(
    "/{product_id}",
    response_model=product_schema.Product,
    dependencies=[Depends(admin_only_for_write)],
)
async def update_product(product_id: int, payload: product_schema.ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = payload.model_dump(exclude_unset=True)
    logger.info("Updating product %s with payload: %s", product_id, updates)

    if "category_id" in updates and updates["category_id"] is not None:
        category = db.get(Category, updates["category_id"])
        if category is None:
            raise HTTPException(status_code=400, detail="Категория не найдена")

    try:
        for field, value in updates.items():
            setattr(product, field, value)
        db.commit()
        db.refresh(product)
        return product
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while updating product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        db.rollback()
        logger.exception("Unexpected error while updating product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(admin_only_for_write)],
)
async def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        db.delete(product)
        db.commit()
        return None
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while deleting product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        db.rollback()
        logger.exception("Unexpected error while deleting product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post(
    "/{product_id}/photo",
    response_model=product_schema.Product,
    dependencies=[Depends(admin_only_for_write)],
)
async def upload_photo(
    product_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Файл не передан")
        if file.content_type is None or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Разрешена только загрузка изображений")

        photo_name = await save_upload(file, subdir="products")
        public_url = f"{str(request.base_url).rstrip('/')}/static/{photo_name}"
        product.photo = public_url
        product.image_url = public_url
        db.commit()
        db.refresh(product)
        return product
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error while uploading photo for product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        db.rollback()
        logger.exception("Unexpected error while uploading photo for product %s", product_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/low-stock", response_model=list[stock_schema.LowStockItem], dependencies=[Depends(require_employee)])
async def low_stock(
    branch_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_branch_id = branch_id
    if current_user.role == "employee":
        target_branch_id = current_user.branch_id
        if target_branch_id is None:
            raise HTTPException(status_code=400, detail="Сотрудник не привязан к филиалу")

    query = (
        select(Stock, Product, Branch)
        .join(Product, Stock.product_id == Product.id)
        .join(Branch, Stock.branch_id == Branch.id)
        .where(Stock.quantity < Product.limit)
    )
    if target_branch_id is not None:
        query = query.where(Stock.branch_id == target_branch_id)

    result = db.execute(query)
    items: list[stock_schema.LowStockItem] = []
    for stock, product, branch in result.all():
        items.append(
            stock_schema.LowStockItem(
                id=product.id,
                name=product.name,
                branch=branch.name,
                quantity=stock.quantity,
                limit=product.limit or 0,
            )
        )
    return items

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.security import get_current_user, require_employee
from app.core.enums import MovementStatus
from app.database.session import get_db
from app.models.entities import Movement, MovementItem as MovementItemModel, Product, Stock
from app.models.user import User
from app.schemas.movements import (
    MovementCreate,
    MovementDetail,
    MovementItem as MovementItemSchema,
    MovementSummary,
)
from app.services.inventory import adjust_stock

router = APIRouter(redirect_slashes=False)

def _status_from_db(value: str) -> MovementStatus:
    if value in MovementStatus._value2member_map_:
        return MovementStatus(value)
    return MovementStatus.WAITING


def _validate_branch_access(branch_id: int, current_user: User) -> None:
    if branch_id is None:
        raise HTTPException(status_code=400, detail="Не указан филиал для перемещения")


def _ensure_movement_access(movement: Movement | None, current_user: User) -> Movement:
    if movement is None:
        raise HTTPException(status_code=404, detail="Перемещение не найдено")
    if current_user.role == "admin":
        return movement
    if current_user.branch_id is None:
        raise HTTPException(status_code=403, detail="Сотрудник не привязан к филиалу")
    if movement.from_branch_id != current_user.branch_id and movement.to_branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Нет доступа к перемещению")
    return movement


def _apply_filters(
    query,
    current_user: User,
    branch_id: Optional[int],
    status_filter: Optional[MovementStatus],
    start_date: Optional[date],
    end_date: Optional[date],
):
    if branch_id:
        query = query.where(
            (Movement.from_branch_id == branch_id) | (Movement.to_branch_id == branch_id)
        )
    if status_filter:
        query = query.where(Movement.status == status_filter.value)
    if start_date:
        query = query.where(Movement.created_at >= _date_bounds(start_date, True))
    if end_date:
        query = query.where(Movement.created_at <= _date_bounds(end_date, False))
    return query


def _date_bounds(dt: date, start: bool) -> datetime:
    return datetime.combine(dt, time.min if start else time.max)


@router.get("", response_model=list[MovementSummary], dependencies=[Depends(require_employee)])
async def list_movements(
    branch_id: int | None = None,
    status: MovementStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Movement).options(
        joinedload(Movement.from_branch),
        joinedload(Movement.to_branch),
        joinedload(Movement.processed_by),
        joinedload(Movement.created_by),
        selectinload(Movement.items).selectinload(MovementItemModel.product),
    )
    query = _apply_filters(query, current_user, branch_id, status, date_from, date_to)

    movements = db.execute(query.order_by(Movement.created_at.desc())).scalars().all()
    return [
        MovementSummary(
            id=m.id,
            from_branch_id=m.from_branch_id,
            to_branch_id=m.to_branch_id,
            status=_status_from_db(m.status),
            comment=m.comment,
            reason=m.reason,
            created_at=m.created_at,
            created_by_id=m.created_by_id,
            processed_by_id=m.processed_by_id,
            processed_at=m.processed_at,
            from_branch_name=m.from_branch.name if m.from_branch else None,
            to_branch_name=m.to_branch.name if m.to_branch else None,
            created_by_name=m.created_by.name if m.created_by else None,
            processed_by_name=m.processed_by.name if m.processed_by else None,
            items=[
                MovementItemSchema(
                    id=item.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    purchase_price=item.purchase_price,
                    selling_price=item.selling_price,
                    product_name=item.product.name if item.product else None,
                )
                for item in m.items
            ],
        )
        for m in movements
    ]


@router.post(
    "",
    response_model=MovementDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_employee)],
)
async def create_movement(
    payload: MovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.from_branch_id == payload.to_branch_id:
        raise HTTPException(status_code=400, detail="Нельзя перемещать в тот же филиал")

    _validate_branch_access(payload.from_branch_id, current_user)

    if not payload.items:
        raise HTTPException(status_code=400, detail="Список товаров пуст")

    for item in payload.items:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Товар {item.product_id} не найден")
        stock = db.execute(
            select(Stock).where(Stock.branch_id == payload.from_branch_id, Stock.product_id == item.product_id)
        ).scalar_one_or_none()
        available_qty = stock.quantity if stock else 0
        if available_qty < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Недостаточно остатка {product.name} в филиале-отправителе. "
                    f"Доступно: {available_qty}, запрошено: {item.quantity}"
                ),
            )

    movement = Movement(
        from_branch_id=payload.from_branch_id,
        to_branch_id=payload.to_branch_id,
        created_by_id=current_user.id,
        status=MovementStatus.WAITING.value,
        comment=payload.comment,
    )
    db.add(movement)
    db.flush()

    for item in payload.items:
        db.add(
            MovementItemModel(
                movement_id=movement.id,
                product_id=item.product_id,
                quantity=item.quantity,
                purchase_price=item.purchase_price,
                selling_price=item.selling_price,
            )
        )

    db.commit()
    db.refresh(movement)
    db.refresh(movement, attribute_names=["items", "from_branch", "to_branch", "created_by"])
    return await get_movement_detail(movement.id, db=db, current_user=current_user)


@router.post(
    "/{movement_id}/accept",
    response_model=MovementDetail,
    dependencies=[Depends(require_employee)],
)
async def accept_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.execute(
        select(Movement)
        .where(Movement.id == movement_id)
        .options(selectinload(Movement.items).selectinload(MovementItemModel.product))
    ).scalar_one_or_none()
    movement = _ensure_movement_access(movement, current_user)

    if movement.status != MovementStatus.WAITING.value:
        raise HTTPException(status_code=400, detail="Перемещение уже обработано")

    if current_user.role != "admin":
        if current_user.branch_id is None or movement.to_branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Подтверждать может только принимающий филиал")

    try:
        for item in movement.items:
            stock = adjust_stock(db, movement.from_branch_id, item.product_id, 0)
            if stock.quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Недостаточно остатка {item.product.name if item.product else item.product_id} на складе",
                )

        for item in movement.items:
            adjust_stock(db, movement.from_branch_id, item.product_id, -item.quantity)
            adjust_stock(db, movement.to_branch_id, item.product_id, item.quantity)

        movement.status = MovementStatus.DONE.value
        movement.processed_by_id = current_user.id
        movement.processed_at = datetime.utcnow()
        movement.reason = None
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(movement)
    return await get_movement_detail(movement_id, db=db, current_user=current_user)


@router.post(
    "/{movement_id}/reject",
    response_model=MovementDetail,
    dependencies=[Depends(require_employee)],
)
async def reject_movement(
    movement_id: int,
    reason: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.execute(
        select(Movement)
        .where(Movement.id == movement_id)
        .options(selectinload(Movement.items).selectinload(MovementItemModel.product))
    ).scalar_one_or_none()
    movement = _ensure_movement_access(movement, current_user)

    if movement.status != MovementStatus.WAITING.value:
        raise HTTPException(status_code=400, detail="Перемещение уже обработано")

    if current_user.role != "admin":
        if current_user.branch_id is None or movement.to_branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Отклонить может только принимающий филиал")

    try:
        movement.status = MovementStatus.REJECTED.value
        movement.processed_by_id = current_user.id
        movement.processed_at = datetime.utcnow()
        movement.reason = reason
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(movement)
    return await get_movement_detail(movement_id, db=db, current_user=current_user)


@router.get("/{movement_id}", response_model=MovementDetail, dependencies=[Depends(require_employee)])
async def get_movement_detail(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = db.execute(
        select(Movement)
        .where(Movement.id == movement_id)
        .options(
            joinedload(Movement.from_branch),
            joinedload(Movement.to_branch),
            joinedload(Movement.created_by),
            joinedload(Movement.processed_by),
            selectinload(Movement.items).selectinload(MovementItemModel.product),
        )
    ).scalar_one_or_none()
    movement = _ensure_movement_access(movement, current_user)

    items = [
        MovementItemSchema(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            purchase_price=item.purchase_price,
            selling_price=item.selling_price,
            product_name=item.product.name if item.product else None,
        )
        for item in movement.items
    ]

    return MovementDetail(
        id=movement.id,
        from_branch_id=movement.from_branch_id,
        to_branch_id=movement.to_branch_id,
        status=_status_from_db(movement.status),
        comment=movement.comment,
        reason=movement.reason,
        created_at=movement.created_at,
        created_by_id=movement.created_by_id,
        processed_by_id=movement.processed_by_id,
        processed_at=movement.processed_at,
        from_branch_name=movement.from_branch.name if movement.from_branch else None,
        to_branch_name=movement.to_branch.name if movement.to_branch else None,
        created_by_name=movement.created_by.name if movement.created_by else None,
        processed_by_name=movement.processed_by.name if movement.processed_by else None,
        items=items,
    )

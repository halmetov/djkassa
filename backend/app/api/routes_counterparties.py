from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.database.session import get_db
from app.models.entities import Counterparty
from app.schemas import counterparties as counterparty_schema

router = APIRouter(redirect_slashes=False, dependencies=[Depends(require_admin)])


@router.get("", response_model=list[counterparty_schema.Counterparty])
async def list_counterparties(
    q: str | None = None,
    limit: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Counterparty)
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                Counterparty.name.ilike(like),
                Counterparty.company_name.ilike(like),
                Counterparty.phone.ilike(like),
            )
        )
    query = query.order_by(Counterparty.created_at.desc())
    if limit:
        query = query.limit(limit)
    result = db.execute(query)
    return result.scalars().all()


@router.get("/{counterparty_id}", response_model=counterparty_schema.Counterparty)
async def get_counterparty(counterparty_id: int, db: Session = Depends(get_db)):
    counterparty = db.get(Counterparty, counterparty_id)
    if not counterparty:
        raise HTTPException(status_code=404, detail="Counterparty not found")
    return counterparty


@router.post("", response_model=counterparty_schema.Counterparty, status_code=status.HTTP_201_CREATED)
async def create_counterparty(
    payload: counterparty_schema.CounterpartyCreate,
    db: Session = Depends(get_db),
):
    counterparty = Counterparty(**payload.model_dump(exclude_unset=True))
    db.add(counterparty)
    db.commit()
    db.refresh(counterparty)
    return counterparty


@router.put("/{counterparty_id}", response_model=counterparty_schema.Counterparty)
async def update_counterparty(
    counterparty_id: int,
    payload: counterparty_schema.CounterpartyUpdate,
    db: Session = Depends(get_db),
):
    counterparty = db.get(Counterparty, counterparty_id)
    if not counterparty:
        raise HTTPException(status_code=404, detail="Counterparty not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(counterparty, field, value)
    db.commit()
    db.refresh(counterparty)
    return counterparty


@router.delete("/{counterparty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_counterparty(counterparty_id: int, db: Session = Depends(get_db)):
    counterparty = db.get(Counterparty, counterparty_id)
    if not counterparty:
        raise HTTPException(status_code=404, detail="Counterparty not found")
    db.delete(counterparty)
    db.commit()
    return None

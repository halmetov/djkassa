from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import require_employee
from app.database.session import get_db
from app.models.entities import Client
from app.schemas import clients as client_schema

router = APIRouter(redirect_slashes=False)


@router.get("", response_model=list[client_schema.Client], dependencies=[Depends(require_employee)])
async def list_clients(db: Session = Depends(get_db)):
    result = db.execute(select(Client))
    return result.scalars().all()


@router.post(
    "",
    response_model=client_schema.Client,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_employee)],
)
async def create_client(payload: client_schema.ClientCreate, db: Session = Depends(get_db)):
    client = Client(**payload.dict())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.put(
    "/{client_id}",
    response_model=client_schema.Client,
    dependencies=[Depends(require_employee)],
)
async def update_client(client_id: int, payload: client_schema.ClientUpdate, db: Session = Depends(get_db)):
    client = db.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client

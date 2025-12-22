from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None


class ClientCreate(ClientBase):
    total_debt: float = 0


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    total_debt: Optional[float] = None


class Client(ClientBase):
    id: int
    total_debt: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

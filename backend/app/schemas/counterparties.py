from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CounterpartyBase(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    debt: Optional[float] = None


class CounterpartyCreate(CounterpartyBase):
    pass


class CounterpartyUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    debt: Optional[float] = None


class Counterparty(CounterpartyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

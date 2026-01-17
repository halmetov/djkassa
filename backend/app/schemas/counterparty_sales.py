from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CounterpartySaleItemBase(BaseModel):
    product_id: int
    quantity: float
    price: float


class CounterpartySaleItemCreate(CounterpartySaleItemBase):
    pass


class CounterpartySaleItem(CounterpartySaleItemBase):
    id: int
    cost_price_snapshot: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CounterpartySaleItemDetail(CounterpartySaleItem):
    product_name: Optional[str] = None


class CounterpartySaleBase(BaseModel):
    counterparty_id: Optional[int] = None
    items: List[CounterpartySaleItemCreate]


class CounterpartySaleCreate(CounterpartySaleBase):
    pass


class CounterpartySaleSummary(BaseModel):
    id: int
    created_at: datetime
    counterparty_id: Optional[int] = None
    counterparty_name: Optional[str] = None
    counterparty_company_name: Optional[str] = None
    total_amount: float
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class CounterpartySaleDetail(CounterpartySaleSummary):
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    items: List[CounterpartySaleItemDetail]

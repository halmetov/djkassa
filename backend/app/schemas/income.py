from datetime import datetime
from typing import List

from pydantic import BaseModel


class IncomeItemBase(BaseModel):
    product_id: int
    quantity: int
    purchase_price: float
    sale_price: float


class IncomeItem(IncomeItemBase):
    id: int

    class Config:
        from_attributes = True


class IncomeBase(BaseModel):
    branch_id: int
    items: List[IncomeItemBase]


class IncomeCreate(IncomeBase):
    pass


class Income(IncomeBase):
    id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    items: List[IncomeItem]

    class Config:
        from_attributes = True

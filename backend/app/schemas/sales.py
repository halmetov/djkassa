from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class SaleItemBase(BaseModel):
    product_id: int
    quantity: int
    price: float
    discount: float = 0


class SaleItemCreate(SaleItemBase):
    pass


class SaleItem(SaleItemBase):
    id: int
    total: float

    class Config:
        from_attributes = True


class SaleItemDetail(SaleItem):
    product_name: Optional[str] = None
    product_unit: Optional[str] = None


class SaleBase(BaseModel):
    branch_id: int
    client_id: Optional[int] = None
    seller_id: Optional[int] = None
    items: List[SaleItemCreate]
    paid_cash: float = 0
    paid_card: float = 0
    paid_debt: float = 0
    payment_type: str = "cash"


class SaleCreate(SaleBase):
    pass


class SaleSummary(BaseModel):
    id: int
    created_at: datetime
    branch_id: int
    branch_name: Optional[str] = None
    seller_id: int
    seller_name: Optional[str] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    total_amount: float
    paid_cash: float
    paid_card: float
    paid_debt: float
    payment_type: str


class Sale(SaleBase):
    id: int
    seller_id: int
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[SaleItem]

    class Config:
        from_attributes = True


class SaleDetail(SaleSummary):
    branch_address: Optional[str] = None
    items: List[SaleItemDetail]

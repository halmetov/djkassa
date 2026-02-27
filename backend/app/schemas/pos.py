from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PosProduct(BaseModel):
    id: int
    name: str
    barcode: Optional[str]
    sale_price: float
    red_price: Optional[float] = None
    unit: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    quantity: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

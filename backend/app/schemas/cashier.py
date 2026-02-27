from typing import Optional
from pydantic import BaseModel


class CashierProduct(BaseModel):
    id: int
    name: str
    barcode: Optional[str] = None
    sale_price: float
    red_price: Optional[float] = None
    unit: Optional[str] = None
    image_url: Optional[str] = None
    photo: Optional[str] = None
    available_qty: float
    category: Optional[str] = None
    rating: Optional[int] = 0

    class Config:
        from_attributes = True

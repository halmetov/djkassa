from datetime import datetime

from pydantic import BaseModel


class Stock(BaseModel):
    id: int
    branch_id: int
    product_id: int
    quantity: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LowStockItem(BaseModel):
    id: int
    name: str
    branch: str
    quantity: int
    limit: int

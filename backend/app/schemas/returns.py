from datetime import datetime

from pydantic import BaseModel


class ReturnItemInput(BaseModel):
    sale_item_id: int
    quantity: int


class ReturnCreate(BaseModel):
    sale_id: int
    type: str
    items: list[ReturnItemInput] = []
    reason: str | None = None


class ReturnItem(BaseModel):
    id: int
    sale_item_id: int
    quantity: int
    amount: float
    product_id: int
    product_name: str | None = None

    class Config:
        from_attributes = True


class ReturnSummary(BaseModel):
    id: int
    sale_id: int
    branch_id: int
    branch_name: str | None
    created_by_id: int
    created_by_name: str | None
    client_name: str | None = None
    type: str
    total_amount: float
    created_at: datetime


class ReturnDetail(ReturnSummary):
    reason: str | None = None
    items: list[ReturnItem]

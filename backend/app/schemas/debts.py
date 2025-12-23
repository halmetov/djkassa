from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DebtPaymentCreate(BaseModel):
    client_id: int
    amount: float = Field(gt=0)
    payment_type: str = "cash"
    branch_id: Optional[int] = None


class DebtPayment(BaseModel):
    id: int
    client_id: int
    amount: float
    payment_type: str
    processed_by_id: Optional[int] = None
    branch_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

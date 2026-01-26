from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_serializer


class SalaryPaymentCreate(BaseModel):
    employee_id: int
    payment_type: Literal["advance", "salary"]
    amount: float
    comment: Optional[str] = None


class SalaryPaymentUserOut(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SalaryPaymentOut(BaseModel):
    id: int
    employee: SalaryPaymentUserOut
    payment_type: Literal["advance", "salary"]
    amount: float
    comment: Optional[str]
    created_at: datetime
    created_by_admin: SalaryPaymentUserOut

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: float) -> float:
        return float(value)


class SalaryPaymentListOut(BaseModel):
    items: list[SalaryPaymentOut]
    total_amount: float

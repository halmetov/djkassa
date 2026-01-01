from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_serializer, field_validator
from pydantic.config import ConfigDict


class ExpenseBase(BaseModel):
    title: str = Field(..., min_length=1)
    amount: float | int = 0
    branch_id: Optional[int] = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Название расхода не может быть пустым")
        return cleaned

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float | int) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return 0
        return max(0.0, numeric)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseOut(ExpenseBase):
    id: int
    created_at: datetime
    created_by_id: int
    created_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: float | int) -> float:
        return float(value)

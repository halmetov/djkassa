from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class ProductionOrderBase(BaseModel):
    title: str
    amount: Decimal = Field(default=0)
    customer_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "open"
    branch_id: Optional[int] = None


class ProductionOrderCreate(ProductionOrderBase):
    pass


class ProductionOrderUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[Decimal] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    branch_id: Optional[int] = None


class MaterialAddCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit_price: Optional[Decimal] = None


class PaymentCreate(BaseModel):
    employee_id: int
    amount: Decimal
    note: Optional[str] = None


class ProductionExpenseCreate(BaseModel):
    title: str
    amount: Decimal
    order_id: Optional[int] = None
    branch_id: Optional[int] = None


class MaterialOut(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit_price: Optional[Decimal]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentOut(BaseModel):
    id: int
    employee_id: int
    amount: Decimal
    note: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductionOrderOut(BaseModel):
    id: int
    title: str
    amount: Decimal
    customer_name: Optional[str]
    description: Optional[str]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    branch_id: Optional[int]
    materials: list[MaterialOut] = []
    payments: list[PaymentOut] = []

    model_config = ConfigDict(from_attributes=True)


class ProductionExpenseOut(BaseModel):
    id: int
    title: str
    amount: Decimal
    order_id: Optional[int]
    branch_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

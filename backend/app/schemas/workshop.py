from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_serializer
from pydantic.config import ConfigDict

from app.schemas import income as income_schema


class WorkshopEmployeeBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = Field(default=None, max_length=120)
    active: bool = True


class WorkshopEmployeeCreate(WorkshopEmployeeBase):
    pass


class WorkshopEmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = Field(default=None, max_length=120)
    active: Optional[bool] = None


class WorkshopEmployeeOut(WorkshopEmployeeBase):
    id: int
    total_salary: Decimal = Field(default=Decimal("0"))
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class WorkshopExpenseBase(BaseModel):
    title: str
    amount: Decimal = Field(default=Decimal("0"), ge=0)


class WorkshopExpenseCreate(WorkshopExpenseBase):
    pass


class WorkshopExpenseOut(WorkshopExpenseBase):
    id: int
    branch_id: Optional[int] = None
    created_at: Optional[datetime]
    created_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal | float) -> float:
        return float(value)


class WorkshopOrderBase(BaseModel):
    title: str
    amount: Decimal = Field(default=Decimal("0"))
    customer_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    photo: Optional[str] = None
    paid_amount: Optional[Decimal] = None


class WorkshopOrderCreate(WorkshopOrderBase):
    pass


class WorkshopOrderUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[Decimal] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class WorkshopOrderOut(WorkshopOrderBase):
    id: int
    status: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    closed_at: Optional[datetime]
    branch_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class WorkshopMaterialCreate(BaseModel):
    product_id: int
    quantity: Decimal
    unit: Optional[str] = None


class WorkshopMaterialOut(BaseModel):
    id: int
    product_id: int
    quantity: Decimal
    unit: Optional[str]
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class WorkshopPayoutCreate(BaseModel):
    employee_id: int
    amount: Decimal = Field(ge=0)
    note: Optional[str] = None


class WorkshopPayoutOut(BaseModel):
    id: int
    employee_id: int
    amount: Decimal
    note: Optional[str]
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class WorkshopOrderMaterialDetail(WorkshopMaterialOut):
    product_name: str
    product_barcode: Optional[str] = None


class WorkshopOrderPayoutDetail(WorkshopPayoutOut):
    employee_name: str
    employee_phone: Optional[str] = None
    employee_position: Optional[str] = None


class WorkshopOrderDetail(WorkshopOrderOut):
    materials: list[WorkshopOrderMaterialDetail] = []
    payouts: list[WorkshopOrderPayoutDetail] = []


class WorkshopClosePayload(BaseModel):
    paid_amount: Decimal = Field(ge=0)
    note: Optional[str] = None


class WorkshopClosureOut(BaseModel):
    id: int
    order_id: int
    order_amount: Decimal
    paid_amount: Decimal
    note: Optional[str]
    closed_at: Optional[datetime]
    closed_by_user_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class WorkshopReportFilter(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class WorkshopStockProduct(BaseModel):
    id: int
    product_id: int
    name: str
    quantity: Decimal | float
    available_qty: Decimal | float | None = None
    unit: Optional[str] = None
    barcode: Optional[str] = None
    photo: Optional[str] = None
    image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WorkshopEmployeeSearchOut(BaseModel):
    id: int
    full_name: str
    phone: Optional[str] = None
    salary_total: Decimal
    position: Optional[str] = None


class WorkshopIncomeItem(BaseModel):
    product_id: int
    quantity: int
    purchase_price: float
    sale_price: float


class WorkshopIncomeCreate(BaseModel):
    items: list[WorkshopIncomeItem]


class WorkshopIncomeStock(BaseModel):
    product_id: int
    branch_id: int
    quantity: int | float


class WorkshopIncomeResponse(BaseModel):
    income: income_schema.Income
    stock: list[WorkshopIncomeStock]


class WorkshopIncomeProduct(BaseModel):
    id: int
    name: str
    unit: Optional[str] = None
    barcode: Optional[str] = None
    photo: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None

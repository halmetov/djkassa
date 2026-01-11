from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_serializer, field_validator
from pydantic.config import ConfigDict


class ProductBase(BaseModel):
    name: str
    category_id: Optional[int] = None
    unit: str | None = "шт"
    barcode: Optional[str] = None
    purchase_price: float | None = 0
    sale_price: float | None = 0
    wholesale_price: float | None = 0
    red_price: Optional[float] = None
    limit: int | None = 0
    rating: int | None = 0
    image_url: str | None = None
    photo: str | None = None

    model_config = ConfigDict(extra="ignore")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Название товара не может быть пустым")
        return cleaned

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, value: int | None) -> int | None:
        if value is None:
            return value
        return max(0, value)


class ProductCreate(ProductBase):
    name: str = Field(..., min_length=1)


class ProductUpdate(ProductBase):
    name: str | None = Field(default=None, min_length=1)
    rating: int | None = None


class Product(ProductBase):
    id: int
    quantity: int
    rating: int | None = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("red_price")
    def serialize_red_price(self, value: Decimal | float | None) -> float | None:
        return float(value) if value is not None else None

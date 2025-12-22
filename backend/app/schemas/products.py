from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict


class ProductBase(BaseModel):
    name: str
    category_id: Optional[int] = None
    unit: str | None = "шт"
    barcode: Optional[str] = None
    purchase_price: float | None = 0
    sale_price: float | None = 0
    wholesale_price: float | None = 0
    limit: int | None = 0
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


class ProductCreate(ProductBase):
    name: str = Field(..., min_length=1)


class ProductUpdate(ProductBase):
    name: str | None = Field(default=None, min_length=1)


class Product(ProductBase):
    id: int
    quantity: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

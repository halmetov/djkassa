from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.core.enums import MovementStatus


class MovementItemBase(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    purchase_price: Optional[float] = None
    selling_price: Optional[float] = None


class MovementItemCreate(MovementItemBase):
    pass


class MovementItem(MovementItemBase):
    id: int
    product_name: Optional[str] = None

    class Config:
        from_attributes = True


class MovementCreate(BaseModel):
    from_branch_id: int
    to_branch_id: int
    comment: Optional[str] = None
    items: List[MovementItemCreate]


class MovementBase(BaseModel):
    id: int
    from_branch_id: int
    to_branch_id: int
    status: MovementStatus
    comment: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime
    created_by_id: Optional[int] = None
    processed_by_id: Optional[int] = None
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MovementDetail(MovementBase):
    from_branch_name: Optional[str] = None
    to_branch_name: Optional[str] = None
    created_by_name: Optional[str] = None
    processed_by_name: Optional[str] = None
    items: List[MovementItem]


class MovementSummary(MovementBase):
    from_branch_name: Optional[str] = None
    to_branch_name: Optional[str] = None
    created_by_name: Optional[str] = None
    processed_by_name: Optional[str] = None
    items: List[MovementItem]

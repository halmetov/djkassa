from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    active: bool = True


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BranchBase):
    pass


class Branch(BranchBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.core.enums import UserRole


class UserBase(BaseModel):
    name: str
    login: str
    role: UserRole = UserRole.EMPLOYEE
    active: bool = True
    branch_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    active: Optional[bool] = None
    password: Optional[str] = None
    branch_id: Optional[int] = None


class User(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

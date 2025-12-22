from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    user_id: int
    role: str
    branch_id: int | None = None
    exp: int


class LoginRequest(BaseModel):
    login: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthUser(BaseModel):
    id: int
    login: str
    name: str
    role: str
    active: bool
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None

    class Config:
        from_attributes = True

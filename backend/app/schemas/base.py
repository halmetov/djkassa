from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Timestamped(BaseModel):
    created_at: datetime
    updated_at: datetime


class Paginated(BaseModel):
    total: int
    items: list


class Message(BaseModel):
    message: str


class IDSchema(BaseModel):
    id: int

    class Config:
        from_attributes = True

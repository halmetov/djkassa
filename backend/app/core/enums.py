import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class MovementStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"

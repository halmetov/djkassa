import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"
    PRODUCTION_MANAGER = "production_manager"
    MANAGER = "manager"


class MovementStatus(str, enum.Enum):
    WAITING = "waiting"
    DONE = "done"
    REJECTED = "rejected"

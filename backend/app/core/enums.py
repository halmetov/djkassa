import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class MovementStatus(str, enum.Enum):
    WAITING = "waiting"
    DONE = "done"
    REJECTED = "rejected"

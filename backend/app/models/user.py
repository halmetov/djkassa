from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.enums import UserRole
from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    login = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        Enum(
            UserRole,
            name="user_roles",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    active = Column(Boolean, default=True)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    branch = relationship("Branch", back_populates="users")

    incomes = relationship(
        "Income",
        back_populates="created_by",
        cascade="all, delete-orphan",
    )

    sales = relationship(
        "Sale",
        back_populates="seller",
        cascade="all, delete-orphan",
    )

    processed_returns = relationship(
        "Return",
        back_populates="created_by",
        cascade="all, delete-orphan",
    )

    movements_created = relationship(
        "Movement",
        back_populates="created_by",
        foreign_keys="Movement.created_by_id",
        cascade="all, delete-orphan",
    )

    processed_movements = relationship(
        "Movement",
        foreign_keys="Movement.processed_by_id",
        back_populates="processed_by",
        cascade="all, delete-orphan",
    )

    debt_payments = relationship(
        "DebtPayment",
        back_populates="processed_by",
        foreign_keys="DebtPayment.processed_by_id",
        cascade="all, delete-orphan",
    )

    created_debt_payments = relationship(
        "DebtPayment",
        back_populates="created_by",
        foreign_keys="DebtPayment.created_by_id",
        cascade="all, delete-orphan",
    )

    logs = relationship(
        "Log",
        back_populates="created_by",
        cascade="all, delete-orphan",
    )

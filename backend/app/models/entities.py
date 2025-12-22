from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import MovementStatus
from app.database.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

# Re-export the User model to keep backwards compatibility for existing imports.
from .user import User


class Category(Base, TimestampMixin):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)

    products: Mapped[List[Product]] = relationship(back_populates="category")


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    photo: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="шт", server_default=text("'шт'"))
    barcode: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    purchase_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0, server_default=text("0"))
    sale_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0, server_default=text("0"))
    wholesale_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0, server_default=text("0"))
    limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0, server_default=text("0"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))

    category: Mapped[Optional[Category]] = relationship(back_populates="products")
    stocks: Mapped[List[Stock]] = relationship(back_populates="product")


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    address: Mapped[Optional[str]] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    stock_items: Mapped[List[Stock]] = relationship(back_populates="branch")
    users: Mapped[List["User"]] = relationship("User", back_populates="branch")
    outgoing_movements: Mapped[List["Movement"]] = relationship(
        "Movement", back_populates="from_branch", foreign_keys="Movement.from_branch_id"
    )
    incoming_movements: Mapped[List["Movement"]] = relationship(
        "Movement", back_populates="to_branch", foreign_keys="Movement.to_branch_id"
    )


class Stock(Base, TimestampMixin):
    __tablename__ = "stock"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)

    branch: Mapped[Branch] = relationship(back_populates="stock_items")
    product: Mapped[Product] = relationship(back_populates="stocks")


class Movement(Base, TimestampMixin):
    __tablename__ = "movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    from_branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    to_branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"))
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default=MovementStatus.DRAFT.value)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    from_branch: Mapped[Branch] = relationship(
        "Branch", foreign_keys=[from_branch_id], back_populates="outgoing_movements"
    )
    to_branch: Mapped[Branch] = relationship(
        "Branch", foreign_keys=[to_branch_id], back_populates="incoming_movements"
    )
    created_by: Mapped[Optional["User"]] = relationship("User", back_populates="movements_created")
    items: Mapped[List["MovementItem"]] = relationship(
        "MovementItem", back_populates="movement", cascade="all, delete-orphan"
    )


class MovementItem(Base):
    __tablename__ = "movement_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_id: Mapped[int] = mapped_column(ForeignKey("movements.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer)
    purchase_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selling_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    movement: Mapped[Movement] = relationship("Movement", back_populates="items")
    product: Mapped[Product] = relationship("Product")


class Income(Base, TimestampMixin):
    __tablename__ = "income"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    branch_id: Mapped[int] = mapped_column(
        ForeignKey("branches.id"),
        nullable=False,
    )

    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    created_by: Mapped["User"] = relationship("User", back_populates="incomes")
    branch: Mapped[Branch] = relationship()
    items: Mapped[List[IncomeItem]] = relationship(back_populates="income", cascade="all, delete-orphan")


class IncomeItem(Base):
    __tablename__ = "income_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    income_id: Mapped[int] = mapped_column(ForeignKey("income.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    purchase_price: Mapped[float] = mapped_column(Float)
    sale_price: Mapped[float] = mapped_column(Float)

    income: Mapped[Income] = relationship(back_populates="items")


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    total_debt: Mapped[float] = mapped_column(Float, default=0)

    debts: Mapped[List[Debt]] = relationship(back_populates="client")
    sales: Mapped[List[Sale]] = relationship(back_populates="client")


class Sale(Base, TimestampMixin):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id"), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    paid_cash: Mapped[float] = mapped_column(Float, default=0)
    paid_card: Mapped[float] = mapped_column(Float, default=0)
    paid_debt: Mapped[float] = mapped_column(Float, default=0)
    payment_type: Mapped[str] = mapped_column(String(50), default="cash")

    seller: Mapped["User"] = relationship("User", back_populates="sales")
    branch: Mapped[Branch] = relationship()
    client: Mapped[Optional[Client]] = relationship(back_populates="sales")
    items: Mapped[List[SaleItem]] = relationship(
        back_populates="sale", cascade="all, delete-orphan"
    )
    returns: Mapped[List["Return"]] = relationship(
        back_populates="sale", cascade="all, delete-orphan"
    )


class SaleItem(Base):
    __tablename__ = "sales_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    discount: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)

    sale: Mapped[Sale] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class Debt(Base, TimestampMixin):
    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"))
    amount: Mapped[float] = mapped_column(Float)
    paid: Mapped[float] = mapped_column(Float, default=0)

    client: Mapped[Client] = relationship(back_populates="debts")


class Return(Base, TimestampMixin):
    __tablename__ = "returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"))
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    type: Mapped[str] = mapped_column(Enum("by_receipt", "by_item", name="return_type"))
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    sale: Mapped[Sale] = relationship(back_populates="returns")
    branch: Mapped[Branch] = relationship()
    created_by: Mapped["User"] = relationship("User", back_populates="processed_returns")
    items: Mapped[List["ReturnItem"]] = relationship(
        "ReturnItem", back_populates="return_entry", cascade="all, delete-orphan"
    )


class ReturnItem(Base):
    __tablename__ = "return_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("returns.id", ondelete="CASCADE"))
    sale_item_id: Mapped[int] = mapped_column(ForeignKey("sales_items.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    amount: Mapped[float] = mapped_column(Float)

    return_entry: Mapped[Return] = relationship(back_populates="items")
    sale_item: Mapped[SaleItem] = relationship()


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(255))
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    created_by: Mapped[Optional["User"]] = relationship("User", back_populates="logs")

from __future__ import annotations

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import MovementStatus
from app.database.base import Base
from app.models.mixins import TimestampMixin
from decimal import Decimal

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
    red_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True, default=None)
    limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0, server_default=text("0"))
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0, server_default=text("0"))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))

    category: Mapped[Optional[Category]] = relationship(back_populates="products")
    stocks: Mapped[List[Stock]] = relationship(back_populates="product")


class Branch(Base, TimestampMixin):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    address: Mapped[Optional[str]] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_workshop: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))

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
    __table_args__ = (UniqueConstraint("branch_id", "product_id", name="uq_stock_branch_product"),)

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
    processed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=MovementStatus.WAITING.value)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    from_branch: Mapped[Branch] = relationship(
        "Branch", foreign_keys=[from_branch_id], back_populates="outgoing_movements"
    )
    to_branch: Mapped[Branch] = relationship(
        "Branch", foreign_keys=[to_branch_id], back_populates="incoming_movements"
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", back_populates="movements_created", foreign_keys=[created_by_id]
    )
    processed_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[processed_by_id], back_populates="processed_movements"
    )
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


class Expense(Base, TimestampMixin):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)

    created_by: Mapped["User"] = relationship("User")
    branch: Mapped[Optional[Branch]] = relationship("Branch")


class ProductionOrder(Base, TimestampMixin):
    __tablename__ = "production_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", server_default=text("'open'"))
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)

    created_by: Mapped[Optional["User"]] = relationship("User")
    branch: Mapped[Optional[Branch]] = relationship("Branch")
    materials: Mapped[List["ProductionOrderMaterial"]] = relationship(
        "ProductionOrderMaterial", back_populates="order", cascade="all, delete-orphan"
    )
    payments: Mapped[List["ProductionOrderPayment"]] = relationship(
        "ProductionOrderPayment", back_populates="order", cascade="all, delete-orphan"
    )


class ProductionOrderMaterial(Base, TimestampMixin):
    __tablename__ = "production_order_materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("production_orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    unit_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)

    order: Mapped[ProductionOrder] = relationship("ProductionOrder", back_populates="materials")
    product: Mapped[Product] = relationship("Product")


class ProductionOrderPayment(Base, TimestampMixin):
    __tablename__ = "production_order_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("production_orders.id", ondelete="CASCADE"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    order: Mapped[ProductionOrder] = relationship("ProductionOrder", back_populates="payments")
    employee: Mapped["User"] = relationship("User", foreign_keys=[employee_id])
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])


class ProductionExpense(Base, TimestampMixin):
    __tablename__ = "production_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("production_orders.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)

    order: Mapped[Optional[ProductionOrder]] = relationship("ProductionOrder")
    created_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by_id])
    branch: Mapped[Optional[Branch]] = relationship("Branch")


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
    debt_payments: Mapped[List["DebtPayment"]] = relationship(back_populates="client")


class Counterparty(Base, TimestampMixin):
    __tablename__ = "counterparties"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    debt: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True, default=None)

    sales: Mapped[List["CounterpartySale"]] = relationship(back_populates="counterparty")


class CounterpartySale(Base, TimestampMixin):
    __tablename__ = "counterparty_sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    counterparty_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("counterparties.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    branch_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0")
    )

    counterparty: Mapped[Optional[Counterparty]] = relationship(back_populates="sales")
    created_by: Mapped[Optional["User"]] = relationship("User")
    branch: Mapped[Optional[Branch]] = relationship("Branch")
    items: Mapped[List["CounterpartySaleItem"]] = relationship(
        back_populates="sale", cascade="all, delete-orphan"
    )


class CounterpartySaleItem(Base):
    __tablename__ = "counterparty_sale_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("counterparty_sales.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_price_snapshot: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    sale: Mapped["CounterpartySale"] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


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
    apply_to_debt: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    debt_offset_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
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


class DebtPayment(Base, TimestampMixin):
    __tablename__ = "debt_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    debt_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("debts.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    payment_type: Mapped[str] = mapped_column(String(50), default="cash")
    processed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)

    client: Mapped[Client] = relationship(back_populates="debt_payments")
    processed_by: Mapped[Optional["User"]] = relationship(
        "User", back_populates="debt_payments", foreign_keys=[processed_by_id]
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User", back_populates="created_debt_payments", foreign_keys=[created_by_id]
    )
    debt: Mapped[Optional[Debt]] = relationship("Debt")
    branch: Mapped[Optional[Branch]] = relationship("Branch")


class Log(Base):
    __tablename__ = "logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(255))
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    created_by: Mapped[Optional["User"]] = relationship("User", back_populates="logs")


class WorkshopEmployee(Base, TimestampMixin):
    __tablename__ = "workshop_employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, default="")
    total_salary: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0")
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class WorkshopOrder(Base, TimestampMixin):
    __tablename__ = "workshop_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="open", server_default=text("'open'"))
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"))
    photo: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    paid_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )

    created_by_user: Mapped[Optional["User"]] = relationship("User")
    branch: Mapped[Optional[Branch]] = relationship("Branch")
    materials: Mapped[list["WorkshopOrderMaterial"]] = relationship(
        "WorkshopOrderMaterial", back_populates="order", cascade="all, delete-orphan"
    )
    payouts: Mapped[list["WorkshopOrderPayout"]] = relationship(
        "WorkshopOrderPayout", back_populates="order", cascade="all, delete-orphan"
    )
    closure: Mapped[Optional["WorkshopOrderClosure"]] = relationship(
        "WorkshopOrderClosure", back_populates="order", uselist=False, cascade="all, delete-orphan"
    )


class WorkshopOrderMaterial(Base, TimestampMixin):
    __tablename__ = "workshop_order_materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("workshop_orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    order: Mapped[WorkshopOrder] = relationship("WorkshopOrder", back_populates="materials")
    product: Mapped[Product] = relationship("Product")


class WorkshopOrderPayout(Base, TimestampMixin):
    __tablename__ = "workshop_order_payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("workshop_orders.id", ondelete="CASCADE"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("workshop_employees.id", ondelete="CASCADE"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    order: Mapped[WorkshopOrder] = relationship("WorkshopOrder", back_populates="payouts")
    employee: Mapped[WorkshopEmployee] = relationship("WorkshopEmployee")


class WorkshopSalaryTransaction(Base):
    __tablename__ = "workshop_salary_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("workshop_employees.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    employee: Mapped[Optional[WorkshopEmployee]] = relationship("WorkshopEmployee")
    created_by: Mapped[Optional["User"]] = relationship("User")


class WorkshopOrderClosure(Base, TimestampMixin):
    __tablename__ = "workshop_order_closures"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("workshop_orders.id", ondelete="CASCADE"), unique=True
    )
    order_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"), server_default=text("0"))
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    order: Mapped[WorkshopOrder] = relationship("WorkshopOrder", back_populates="closure")
    closed_by_user: Mapped[Optional["User"]] = relationship("User")

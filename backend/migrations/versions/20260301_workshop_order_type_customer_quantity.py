"""workshop order/customer dictionaries and quantity extensions

Revision ID: 20260301_workshop_order_type_customer_quantity
Revises: 20250319_add_salary_payments
Create Date: 2026-03-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260301_workshop_order_type_customer_quantity"
down_revision = "20250319_add_salary_payments"
branch_labels = None
depends_on = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def _has_fk(inspector, table_name: str, fk_name: str) -> bool:
    return any(fk.get("name") == fk_name for fk in inspector.get_foreign_keys(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not inspector.has_table("workshop_order_types"):
        op.create_table(
            "workshop_order_types",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False, unique=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not inspector.has_table("workshop_customers"):
        op.create_table(
            "workshop_customers",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("debt", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )

    inspector = inspect(bind)

    if inspector.has_table("workshop_orders"):
        if not _has_column(inspector, "workshop_orders", "order_type_id"):
            op.add_column("workshop_orders", sa.Column("order_type_id", sa.Integer(), nullable=True))
        if not _has_column(inspector, "workshop_orders", "quantity"):
            op.add_column("workshop_orders", sa.Column("quantity", sa.Integer(), nullable=True, server_default=sa.text("1")))
        if not _has_column(inspector, "workshop_orders", "customer_id"):
            op.add_column("workshop_orders", sa.Column("customer_id", sa.Integer(), nullable=True))

    if inspector.has_table("workshop_order_templates"):
        if not _has_column(inspector, "workshop_order_templates", "amount"):
            op.add_column("workshop_order_templates", sa.Column("amount", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")))
        if not _has_column(inspector, "workshop_order_templates", "order_type_id"):
            op.add_column("workshop_order_templates", sa.Column("order_type_id", sa.Integer(), nullable=True))
        if not _has_column(inspector, "workshop_order_templates", "quantity"):
            op.add_column("workshop_order_templates", sa.Column("quantity", sa.Integer(), nullable=True, server_default=sa.text("1")))
        if not _has_column(inspector, "workshop_order_templates", "customer_id"):
            op.add_column("workshop_order_templates", sa.Column("customer_id", sa.Integer(), nullable=True))
        if not _has_column(inspector, "workshop_order_templates", "photo"):
            op.add_column("workshop_order_templates", sa.Column("photo", sa.String(length=500), nullable=True))

    if inspector.has_table("workshop_order_materials"):
        if not _has_column(inspector, "workshop_order_materials", "per_unit_qty"):
            op.add_column("workshop_order_materials", sa.Column("per_unit_qty", sa.Numeric(12, 2), nullable=True))
        if not _has_column(inspector, "workshop_order_materials", "total_qty"):
            op.add_column("workshop_order_materials", sa.Column("total_qty", sa.Numeric(12, 2), nullable=True))

    if inspector.has_table("workshop_order_payouts"):
        if not _has_column(inspector, "workshop_order_payouts", "per_unit_amount"):
            op.add_column("workshop_order_payouts", sa.Column("per_unit_amount", sa.Numeric(12, 2), nullable=True))
        if not _has_column(inspector, "workshop_order_payouts", "total_amount"):
            op.add_column("workshop_order_payouts", sa.Column("total_amount", sa.Numeric(12, 2), nullable=True))

    inspector = inspect(bind)

    if inspector.has_table("workshop_orders") and inspector.has_table("workshop_order_types") and not _has_fk(inspector, "workshop_orders", "fk_workshop_orders_order_type_id"):
        op.create_foreign_key(
            "fk_workshop_orders_order_type_id",
            "workshop_orders",
            "workshop_order_types",
            ["order_type_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if inspector.has_table("workshop_orders") and inspector.has_table("workshop_customers") and not _has_fk(inspector, "workshop_orders", "fk_workshop_orders_customer_id"):
        op.create_foreign_key(
            "fk_workshop_orders_customer_id",
            "workshop_orders",
            "workshop_customers",
            ["customer_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if inspector.has_table("workshop_order_templates") and inspector.has_table("workshop_order_types") and not _has_fk(inspector, "workshop_order_templates", "fk_workshop_order_templates_order_type_id"):
        op.create_foreign_key(
            "fk_workshop_order_templates_order_type_id",
            "workshop_order_templates",
            "workshop_order_types",
            ["order_type_id"],
            ["id"],
            ondelete="SET NULL",
        )
    if inspector.has_table("workshop_order_templates") and inspector.has_table("workshop_customers") and not _has_fk(inspector, "workshop_order_templates", "fk_workshop_order_templates_customer_id"):
        op.create_foreign_key(
            "fk_workshop_order_templates_customer_id",
            "workshop_order_templates",
            "workshop_customers",
            ["customer_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if inspector.has_table("workshop_order_templates"):
        if _has_fk(inspector, "workshop_order_templates", "fk_workshop_order_templates_customer_id"):
            op.drop_constraint("fk_workshop_order_templates_customer_id", "workshop_order_templates", type_="foreignkey")
        if _has_fk(inspector, "workshop_order_templates", "fk_workshop_order_templates_order_type_id"):
            op.drop_constraint("fk_workshop_order_templates_order_type_id", "workshop_order_templates", type_="foreignkey")

    if inspector.has_table("workshop_orders"):
        if _has_fk(inspector, "workshop_orders", "fk_workshop_orders_customer_id"):
            op.drop_constraint("fk_workshop_orders_customer_id", "workshop_orders", type_="foreignkey")
        if _has_fk(inspector, "workshop_orders", "fk_workshop_orders_order_type_id"):
            op.drop_constraint("fk_workshop_orders_order_type_id", "workshop_orders", type_="foreignkey")

    inspector = inspect(bind)

    if inspector.has_table("workshop_order_payouts"):
        if _has_column(inspector, "workshop_order_payouts", "total_amount"):
            op.drop_column("workshop_order_payouts", "total_amount")
        if _has_column(inspector, "workshop_order_payouts", "per_unit_amount"):
            op.drop_column("workshop_order_payouts", "per_unit_amount")

    if inspector.has_table("workshop_order_materials"):
        if _has_column(inspector, "workshop_order_materials", "total_qty"):
            op.drop_column("workshop_order_materials", "total_qty")
        if _has_column(inspector, "workshop_order_materials", "per_unit_qty"):
            op.drop_column("workshop_order_materials", "per_unit_qty")

    if inspector.has_table("workshop_order_templates"):
        for col in ["photo", "customer_id", "quantity", "order_type_id", "amount"]:
            if _has_column(inspector, "workshop_order_templates", col):
                op.drop_column("workshop_order_templates", col)

    if inspector.has_table("workshop_orders"):
        for col in ["customer_id", "quantity", "order_type_id"]:
            if _has_column(inspector, "workshop_orders", col):
                op.drop_column("workshop_orders", col)

    if inspector.has_table("workshop_customers"):
        op.drop_table("workshop_customers")
    if inspector.has_table("workshop_order_types"):
        op.drop_table("workshop_order_types")

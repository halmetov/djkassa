"""add workshop order unit price

Revision ID: 20260303_add_workshop_order_unit_price
Revises: 20260302_add_workshop_order_debt_amount
Create Date: 2026-03-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260303_add_workshop_order_unit_price"
down_revision = "20260302_add_workshop_order_debt_amount"
branch_labels = None
depends_on = None


def _has_column(inspector, table_name: str, column_name: str) -> bool:
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("workshop_orders") and not _has_column(inspector, "workshop_orders", "unit_price"):
        op.add_column("workshop_orders", sa.Column("unit_price", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("workshop_orders") and _has_column(inspector, "workshop_orders", "unit_price"):
        op.drop_column("workshop_orders", "unit_price")

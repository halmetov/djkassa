"""convert workshop material and stock quantities to numeric

Revision ID: 20260305_decimal_workshop_quantities
Revises: 20260304_add_manager_user_role
Create Date: 2026-03-05 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260305_decimal_workshop_quantities"
down_revision = "20260304_add_manager_user_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "stock",
        "quantity",
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 3),
        existing_nullable=False,
        postgresql_using="quantity::numeric(12,3)",
    )

    op.alter_column(
        "workshop_order_materials",
        "quantity",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Numeric(12, 3),
        existing_nullable=False,
        postgresql_using="quantity::numeric(12,3)",
    )
    op.alter_column(
        "workshop_order_materials",
        "per_unit_qty",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Numeric(12, 3),
        existing_nullable=True,
        postgresql_using="per_unit_qty::numeric(12,3)",
    )
    op.alter_column(
        "workshop_order_materials",
        "total_qty",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Numeric(12, 3),
        existing_nullable=True,
        postgresql_using="total_qty::numeric(12,3)",
    )

    op.alter_column(
        "workshop_order_template_items",
        "quantity",
        existing_type=sa.Numeric(12, 2),
        type_=sa.Numeric(12, 3),
        existing_nullable=False,
        postgresql_using="quantity::numeric(12,3)",
    )


def downgrade() -> None:
    op.alter_column(
        "workshop_order_template_items",
        "quantity",
        existing_type=sa.Numeric(12, 3),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using="quantity::numeric(12,2)",
    )

    op.alter_column(
        "workshop_order_materials",
        "total_qty",
        existing_type=sa.Numeric(12, 3),
        type_=sa.Numeric(12, 2),
        existing_nullable=True,
        postgresql_using="total_qty::numeric(12,2)",
    )
    op.alter_column(
        "workshop_order_materials",
        "per_unit_qty",
        existing_type=sa.Numeric(12, 3),
        type_=sa.Numeric(12, 2),
        existing_nullable=True,
        postgresql_using="per_unit_qty::numeric(12,2)",
    )
    op.alter_column(
        "workshop_order_materials",
        "quantity",
        existing_type=sa.Numeric(12, 3),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using="quantity::numeric(12,2)",
    )

    op.alter_column(
        "stock",
        "quantity",
        existing_type=sa.Numeric(12, 3),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using="round(quantity)::integer",
    )

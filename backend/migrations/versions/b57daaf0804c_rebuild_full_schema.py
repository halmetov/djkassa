"""rebuild full schema

Revision ID: b57daaf0804c
Revises: 20240901_initial
Create Date: 2026-01-06 17:09:00.035683

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

from app.database.base import Base

# Ensure all models are imported so Base.metadata is fully populated
import app.models  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'b57daaf0804c'
down_revision = '20240901_initial'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    metadata = Base.metadata
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    tables_in_order = [
        metadata.tables["production_orders"],
        metadata.tables["workshop_employees"],
        metadata.tables["workshop_orders"],
        metadata.tables["production_order_materials"],
        metadata.tables["production_order_payments"],
        metadata.tables["production_expenses"],
        metadata.tables["workshop_order_materials"],
        metadata.tables["workshop_order_payouts"],
        metadata.tables["workshop_order_closures"],
    ]

    for table in tables_in_order:
        if table.name in existing_tables:
            continue
        table.create(bind=bind, checkfirst=True)


def downgrade():
    bind = op.get_bind()
    metadata = Base.metadata
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())

    tables_in_reverse_order = [
        "workshop_order_closures",
        "workshop_order_payouts",
        "workshop_order_materials",
        "production_order_payments",
        "production_order_materials",
        "production_expenses",
        "workshop_orders",
        "workshop_employees",
        "production_orders",
    ]

    for table_name in tables_in_reverse_order:
        if table_name not in existing_tables:
            continue
        metadata.tables[table_name].drop(bind=bind, checkfirst=True)

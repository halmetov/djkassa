"""initial schema

Revision ID: 20240901_initial
Revises: 
Create Date: 2026-01-04 14:19:15.870340

"""

from alembic import op
import sqlalchemy as sa
from app.database.base import Base

# Ensure metadata is fully populated
import app.models  # noqa: F401


# revision identifiers, used by Alembic.
revision = '20240901_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    metadata = Base.metadata

    tables = [
        metadata.tables["categories"],
        metadata.tables["branches"],
        metadata.tables["users"],
        metadata.tables["products"],
        metadata.tables["stock"],
        metadata.tables["movements"],
        metadata.tables["movement_items"],
        metadata.tables["income"],
        metadata.tables["income_items"],
        metadata.tables["expenses"],
        metadata.tables["clients"],
        metadata.tables["sales"],
        metadata.tables["sales_items"],
        metadata.tables["debts"],
        metadata.tables["debt_payments"],
        metadata.tables["returns"],
        metadata.tables["return_items"],
        metadata.tables["logs"],
    ]

    metadata.create_all(bind=bind, tables=tables, checkfirst=True)


def downgrade():
    bind = op.get_bind()
    metadata = Base.metadata

    tables = [
        metadata.tables["return_items"],
        metadata.tables["returns"],
        metadata.tables["debt_payments"],
        metadata.tables["debts"],
        metadata.tables["sales_items"],
        metadata.tables["sales"],
        metadata.tables["clients"],
        metadata.tables["expenses"],
        metadata.tables["income_items"],
        metadata.tables["income"],
        metadata.tables["movement_items"],
        metadata.tables["movements"],
        metadata.tables["stock"],
        metadata.tables["products"],
        metadata.tables["logs"],
        metadata.tables["users"],
        metadata.tables["branches"],
        metadata.tables["categories"],
    ]

    metadata.drop_all(bind=bind, tables=tables, checkfirst=True)

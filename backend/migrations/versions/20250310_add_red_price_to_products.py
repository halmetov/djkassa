"""add red price to products

Revision ID: 20250310_add_red_price_to_products
Revises: 20250309_return_debt_offset
Create Date: 2025-03-10 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250310_add_red_price_to_products"
down_revision = "20250309_return_debt_offset"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "red_price" not in columns:
        op.add_column(
            "products",
            sa.Column("red_price", sa.Numeric(12, 2), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "red_price" in columns:
        op.drop_column("products", "red_price")

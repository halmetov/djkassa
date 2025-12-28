"""Add rating to products

Revision ID: 1b2f3e9b1a8e
Revises: 0f78a5e29f1e
Create Date: 2025-05-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1b2f3e9b1a8e"
down_revision = "0f78a5e29f1e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("rating", sa.Integer(), nullable=True, server_default="0"),
    )
    op.execute("UPDATE products SET rating = 0 WHERE rating IS NULL")


def downgrade() -> None:
    op.drop_column("products", "rating")

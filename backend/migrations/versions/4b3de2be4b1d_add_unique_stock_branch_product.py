"""Add unique constraint to stock branch/product pair

Revision ID: 4b3de2be4b1d
Revises: 2a3c4d5e6f7a
Create Date: 2025-06-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4b3de2be4b1d'
down_revision = '2a3c4d5e6f7a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM stock s
            USING stock s2
            WHERE s.id < s2.id
              AND s.branch_id = s2.branch_id
              AND s.product_id = s2.product_id
            """
        )
    )
    op.create_unique_constraint(
        "uq_stock_branch_product", "stock", ["branch_id", "product_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_stock_branch_product", "stock", type_="unique")

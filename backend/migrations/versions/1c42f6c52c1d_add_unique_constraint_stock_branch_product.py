"""Add unique constraint for stock branch/product pair

Revision ID: 1c42f6c52c1d
Revises: 97559c7015f6
Create Date: 2025-05-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1c42f6c52c1d"
down_revision = "97559c7015f6"
branch_labels = None
depends_on = None


def upgrade():
    # Remove duplicate stock rows if they exist to allow adding the unique constraint
    op.execute(
        """
        DELETE FROM stock s
        USING stock s_dup
        WHERE s.branch_id = s_dup.branch_id
          AND s.product_id = s_dup.product_id
          AND s.id > s_dup.id
        """
    )

    op.create_unique_constraint("uq_stock_branch_product", "stock", ["branch_id", "product_id"])


def downgrade():
    op.drop_constraint("uq_stock_branch_product", "stock", type_="unique")

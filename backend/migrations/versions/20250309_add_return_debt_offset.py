"""add return debt offset fields

Revision ID: 20250309_return_debt_offset
Revises: b57daaf0804c
Create Date: 2025-03-09 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250309_return_debt_offset"
down_revision = "b57daaf0804c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "returns",
        sa.Column("apply_to_debt", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "returns",
        sa.Column("debt_offset_amount", sa.Numeric(12, 2), nullable=True),
    )


def downgrade():
    op.drop_column("returns", "debt_offset_amount")
    op.drop_column("returns", "apply_to_debt")

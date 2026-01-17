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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("returns")}
    if "apply_to_debt" not in columns:
        op.add_column(
            "returns",
            sa.Column("apply_to_debt", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    if "debt_offset_amount" not in columns:
        op.add_column(
            "returns",
            sa.Column("debt_offset_amount", sa.Numeric(12, 2), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("returns")}
    if "debt_offset_amount" in columns:
        op.drop_column("returns", "debt_offset_amount")
    if "apply_to_debt" in columns:
        op.drop_column("returns", "apply_to_debt")

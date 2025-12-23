"""Add debt_payments table

Revision ID: d5e5d45f742a
Revises: 3e6dbe6c92e1
Create Date: 2025-01-15 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d5e5d45f742a"
down_revision = "3e6dbe6c92e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "debt_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("payment_type", sa.String(length=50), nullable=False, server_default="cash"),
        sa.Column("processed_by_id", sa.Integer(), nullable=True),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name="fk_debt_payments_branch_id_branches", ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], name="fk_debt_payments_client_id_clients", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["processed_by_id"], ["users.id"], name="fk_debt_payments_processed_by_id_users", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("debt_payments")

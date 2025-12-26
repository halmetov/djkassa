"""Add debt payment links and created by

Revision ID: 0f78a5e29f1e
Revises: d5e5d45f742a
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0f78a5e29f1e"
down_revision = "d5e5d45f742a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("debt_payments") as batch_op:
        batch_op.add_column(sa.Column("debt_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("created_by_id", sa.Integer(), nullable=True))

    with op.batch_alter_table("debt_payments") as batch_op:
        batch_op.create_foreign_key(
            "fk_debt_payments_debt_id_debts",
            "debts",
            ["debt_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_foreign_key(
            "fk_debt_payments_created_by_id_users",
            "users",
            ["created_by_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("debt_payments") as batch_op:
        batch_op.drop_constraint(
            "fk_debt_payments_created_by_id_users", type_="foreignkey"
        )
        batch_op.drop_constraint("fk_debt_payments_debt_id_debts", type_="foreignkey")

    with op.batch_alter_table("debt_payments") as batch_op:
        batch_op.drop_column("created_by_id")
        batch_op.drop_column("debt_id")

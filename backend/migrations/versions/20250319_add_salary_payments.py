"""add salary payments

Revision ID: 20250319_add_salary_payments
Revises: 20250318_add_workshop_order_templates
Create Date: 2025-03-19 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250319_add_salary_payments"
down_revision = "20250318_add_workshop_order_templates"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("salary_payments"):
        op.create_table(
            "salary_payments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), nullable=False),
            sa.Column("created_by_admin_id", sa.Integer(), nullable=False),
            sa.Column("payment_type", sa.String(length=20), nullable=False),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_admin_id"], ["users.id"], ondelete="CASCADE"),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("salary_payments"):
        op.drop_table("salary_payments")

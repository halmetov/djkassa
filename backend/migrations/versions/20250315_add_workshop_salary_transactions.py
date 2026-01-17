"""add workshop salary transactions

Revision ID: 20250315_add_workshop_salary_transactions
Revises: 20250310_add_red_price_to_products
Create Date: 2025-03-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250315_add_workshop_salary_transactions"
down_revision = "20250310_add_red_price_to_products"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("workshop_salary_transactions"):
        op.create_table(
            "workshop_salary_transactions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("employee_id", sa.Integer(), nullable=True),
            sa.Column("type", sa.String(length=20), nullable=True),
            sa.Column("amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_by_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["employee_id"], ["workshop_employees.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("workshop_salary_transactions"):
        op.drop_table("workshop_salary_transactions")

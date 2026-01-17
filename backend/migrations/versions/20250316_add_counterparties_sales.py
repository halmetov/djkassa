"""add counterparties and wholesale sales

Revision ID: 20250316_add_counterparties_sales
Revises: 20250315_add_workshop_salary_transactions
Create Date: 2025-03-16 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250316_add_counterparties_sales"
down_revision = "20250315_add_workshop_salary_transactions"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("counterparties"):
        op.create_table(
            "counterparties",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("company_name", sa.String(length=255), nullable=True),
            sa.Column("phone", sa.String(length=50), nullable=True),
            sa.Column("debt", sa.Numeric(12, 2), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
        )

    if not inspector.has_table("counterparty_sales"):
        op.create_table(
            "counterparty_sales",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("counterparty_id", sa.Integer(), nullable=True),
            sa.Column("created_by_id", sa.Integer(), nullable=True),
            sa.Column("branch_id", sa.Integer(), nullable=True),
            sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["counterparty_id"], ["counterparties.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        )

    if not inspector.has_table("counterparty_sale_items"):
        op.create_table(
            "counterparty_sale_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("sale_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("price", sa.Numeric(12, 2), nullable=False),
            sa.Column("cost_price_snapshot", sa.Numeric(12, 2), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True, server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
            sa.ForeignKeyConstraint(["sale_id"], ["counterparty_sales.id"], ondelete="CASCADE"),
        )

    if inspector.has_table("counterparty_sales"):
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("counterparty_sales")}
        if "ix_counterparty_sales_created_at" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_counterparty_sales_created_at ON counterparty_sales (created_at)"
            )
        if "ix_counterparty_sales_counterparty_id" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_counterparty_sales_counterparty_id ON counterparty_sales (counterparty_id)"
            )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("counterparty_sales"):
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("counterparty_sales")}
        if "ix_counterparty_sales_created_at" in existing_indexes:
            op.drop_index("ix_counterparty_sales_created_at", table_name="counterparty_sales")
        if "ix_counterparty_sales_counterparty_id" in existing_indexes:
            op.drop_index("ix_counterparty_sales_counterparty_id", table_name="counterparty_sales")

    if inspector.has_table("counterparty_sale_items"):
        op.drop_table("counterparty_sale_items")

    if inspector.has_table("counterparty_sales"):
        op.drop_table("counterparty_sales")

    if inspector.has_table("counterparties"):
        op.drop_table("counterparties")

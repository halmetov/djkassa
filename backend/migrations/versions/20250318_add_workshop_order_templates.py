"""add workshop order templates

Revision ID: 20250318_add_workshop_order_templates
Revises: 20250316_add_counterparties_sales
Create Date: 2025-03-18 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250318_add_workshop_order_templates"
down_revision = "20250316_add_counterparties_sales"
branch_labels = None
depends_on = None


def _has_index(inspector: sa.inspect, table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _has_fk(inspector: sa.inspect, table_name: str, fk_name: str) -> bool:
    return any(fk.get("name") == fk_name for fk in inspector.get_foreign_keys(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("workshop_order_templates"):
        op.create_table(
            "workshop_order_templates",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("branch_id", sa.Integer(), nullable=False),
            sa.Column("created_by_id", sa.Integer(), nullable=True),
            sa.Column(
                "active",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        )

    if inspector.has_table("workshop_order_templates") and not _has_index(
        inspector, "workshop_order_templates", "ix_workshop_order_templates_branch_name"
    ):
        op.create_index(
            "ix_workshop_order_templates_branch_name",
            "workshop_order_templates",
            ["branch_id", "name"],
        )

    if not inspector.has_table("workshop_order_template_items"):
        op.create_table(
            "workshop_order_template_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("template_id", sa.Integer(), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column(
                "quantity",
                sa.Numeric(12, 2),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
            ),
            sa.ForeignKeyConstraint(
                ["template_id"],
                ["workshop_order_templates.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        )

    if inspector.has_table("workshop_order_template_items") and not _has_index(
        inspector, "workshop_order_template_items", "ix_workshop_order_template_items_template_id"
    ):
        op.create_index(
            "ix_workshop_order_template_items_template_id",
            "workshop_order_template_items",
            ["template_id"],
        )

    if inspector.has_table("workshop_orders"):
        columns = [column["name"] for column in inspector.get_columns("workshop_orders")]
        if "template_id" not in columns:
            op.add_column("workshop_orders", sa.Column("template_id", sa.Integer(), nullable=True))
        if inspector.has_table("workshop_order_templates") and not _has_fk(
            inspector, "workshop_orders", "fk_workshop_orders_template_id"
        ):
            op.create_foreign_key(
                "fk_workshop_orders_template_id",
                "workshop_orders",
                "workshop_order_templates",
                ["template_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("workshop_orders"):
        if _has_fk(inspector, "workshop_orders", "fk_workshop_orders_template_id"):
            op.drop_constraint("fk_workshop_orders_template_id", "workshop_orders", type_="foreignkey")
        columns = [column["name"] for column in inspector.get_columns("workshop_orders")]
        if "template_id" in columns:
            op.drop_column("workshop_orders", "template_id")

    if inspector.has_table("workshop_order_template_items"):
        if _has_index(inspector, "workshop_order_template_items", "ix_workshop_order_template_items_template_id"):
            op.drop_index(
                "ix_workshop_order_template_items_template_id",
                table_name="workshop_order_template_items",
            )
        op.drop_table("workshop_order_template_items")

    if inspector.has_table("workshop_order_templates"):
        if _has_index(inspector, "workshop_order_templates", "ix_workshop_order_templates_branch_name"):
            op.drop_index(
                "ix_workshop_order_templates_branch_name",
                table_name="workshop_order_templates",
            )
        op.drop_table("workshop_order_templates")

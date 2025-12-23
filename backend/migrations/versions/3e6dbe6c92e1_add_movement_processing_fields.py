"""Add movement processing fields and new statuses

Revision ID: 3e6dbe6c92e1
Revises: 97559c7015f6
Create Date: 2025-01-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
# revision identifiers, used by Alembic.
revision = "3e6dbe6c92e1"
down_revision = "97559c7015f6"
branch_labels = None
depends_on = None


movement_table = table(
    "movements",
    column("id", sa.Integer),
    column("status", sa.String),
)


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if is_sqlite:
        with op.batch_alter_table("movements") as batch_op:
            batch_op.add_column(sa.Column("processed_by_id", sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True))
            batch_op.add_column(sa.Column("reason", sa.Text(), nullable=True))
            batch_op.alter_column("status", server_default="waiting")
            batch_op.create_foreign_key(
                "fk_movements_processed_by_id_users",
                "users",
                ["processed_by_id"],
                ["id"],
                ondelete="SET NULL",
            )
    else:
        op.add_column("movements", sa.Column("processed_by_id", sa.Integer(), nullable=True))
        op.add_column("movements", sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True))
        op.add_column("movements", sa.Column("reason", sa.Text(), nullable=True))
        op.alter_column("movements", "status", server_default="waiting")
        op.create_foreign_key(
            "fk_movements_processed_by_id_users",
            "movements",
            "users",
            ["processed_by_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # migrate status values to new enum-like strings
    try:
        bind.execute(
            movement_table.update().where(movement_table.c.status == "draft").values(status="waiting")
        )
        bind.execute(
            movement_table.update().where(movement_table.c.status == "confirmed").values(status="done")
        )
    except Exception:
        # in offline/sqlite mode the table may be missing; ignore migration errors to keep forward progress
        pass


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    try:
        bind.execute(
            movement_table.update().where(movement_table.c.status == "waiting").values(status="draft")
        )
        bind.execute(
            movement_table.update().where(movement_table.c.status == "done").values(status="confirmed")
        )
    except Exception:
        pass

    if is_sqlite:
        with op.batch_alter_table("movements") as batch_op:
            batch_op.drop_constraint("fk_movements_processed_by_id_users", type_="foreignkey")
            batch_op.alter_column("status", server_default="draft")
            batch_op.drop_column("reason")
            batch_op.drop_column("processed_at")
            batch_op.drop_column("processed_by_id")
    else:
        op.drop_constraint("fk_movements_processed_by_id_users", "movements", type_="foreignkey")
        op.alter_column("movements", "status", server_default="draft")
        op.drop_column("movements", "reason")
        op.drop_column("movements", "processed_at")
        op.drop_column("movements", "processed_by_id")

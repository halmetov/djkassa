"""add manager value to user_roles enum

Revision ID: 20260304_add_manager_user_role
Revises: 20260303_add_workshop_order_unit_price
Create Date: 2026-03-04 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260304_add_manager_user_role"
down_revision = "20260303_add_workshop_order_unit_price"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_roles') THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'user_roles' AND e.enumlabel = 'manager'
                ) THEN
                    ALTER TYPE user_roles ADD VALUE 'manager';
                END IF;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely in-place.
    # Intentionally left as no-op to keep downgrade predictable.
    pass

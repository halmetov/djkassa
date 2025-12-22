from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.auth.security import get_password_hash
from app.core.config import get_settings
from app.core.enums import UserRole
from app.database.session import SessionLocal
from app.models import Branch, User

logger = logging.getLogger(__name__)


def seed() -> None:
    settings = get_settings()
    if not settings.debug and settings.environment != "dev":
        logger.warning("Seeding skipped because DEBUG is disabled and environment is not dev.")
        return

    with SessionLocal() as db:
        try:
            branch = db.execute(select(Branch).where(Branch.name == "Главный")).scalar_one_or_none()
            if branch is None:
                branch = Branch(name="Главный", address=None, active=True)
                db.add(branch)
                db.flush()

            admin = db.execute(select(User).where(User.login == "admin")).scalar_one_or_none()
            if admin is None:
                admin = User(
                    name="Admin",
                    login="admin",
                    password_hash=get_password_hash(settings.admin_password),
                    role=UserRole.ADMIN,
                    active=True,
                    branch=branch,
                )
                db.add(admin)
            else:
                admin.role = UserRole.ADMIN
                admin.active = True
                if settings.admin_password:
                    admin.password_hash = get_password_hash(settings.admin_password)
                if admin.branch is None:
                    admin.branch = branch

            db.commit()
            logger.info("Seed data applied successfully.")
        except SQLAlchemyError:
            db.rollback()
            logger.exception("Failed to seed database.")
            raise


def main() -> None:
    seed()


if __name__ == "__main__":
    main()

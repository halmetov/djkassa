from __future__ import annotations

import logging
import sys
from contextlib import contextmanager
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.security import get_password_hash, verify_password
from app.core.config import Settings
from app.database.migrations import run_migrations_on_startup
from app.database.session import SessionLocal
from app.models import Branch, User

logger = logging.getLogger(__name__)


def _get_admin_password(settings: Settings) -> str:
    if not settings.admin_password:
        logger.warning("ADMIN_PASSWORD is empty; using fallback default password 'admin'")
        return "admin"
    return settings.admin_password


@contextmanager
def _session_scope() -> Iterable[Session]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_connection() -> None:
    logger.info("Checking database connectivity")
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database is not available")
        raise
    logger.info("Database connection OK")


def apply_migrations(settings: Settings) -> None:
    logger.info("Applying migrations on startup (upgrade head)")
    run_migrations_on_startup(settings)
    logger.info("Migrations applied successfully")


def ensure_admin_user(settings: Settings) -> None:
    password = _get_admin_password(settings)
    with _session_scope() as db:
        sale_branch = (
            db.query(Branch)
            .filter(Branch.name == (settings.sale_branch_name or "Магазин"))
            .first()
        )
        admin = db.query(User).filter(User.login == "admin").first()
        if admin is None:
            logger.info("Admin user not found; creating default admin")
            admin = User(
                name="Admin",
                login="admin",
                password_hash=get_password_hash(password),
                role="admin",
                active=True,
                branch=sale_branch,
            )
            db.add(admin)
            logger.info("Admin user created")
        else:
            if not verify_password(password, admin.password_hash):
                logger.info("Updating admin password from ADMIN_PASSWORD environment variable")
                admin.password_hash = get_password_hash(password)
            if not admin.active:
                logger.info("Reactivating admin user")
                admin.active = True
            if sale_branch and admin.branch_id is None:
                logger.info("Binding admin to default sale branch '%s'", sale_branch.name)
                admin.branch = sale_branch


def ensure_default_branches(settings: Settings) -> None:
    default_names = [
        settings.sale_branch_name or "Магазин",
        "Склад1",
        "Склад2",
    ]
    created = 0
    with _session_scope() as db:
        for name in default_names:
            exists = db.query(Branch).filter(Branch.name == name).first()
            if exists:
                continue
            branch = Branch(name=name, active=True)
            db.add(branch)
            created += 1
    if created:
        logger.info("Created %s default branches", created)
    else:
        logger.info("Default branches already exist")


def bootstrap(settings: Settings) -> None:
    logger.info("Starting application bootstrap")
    check_database_connection()
    apply_migrations(settings)
    ensure_default_branches(settings)
    ensure_admin_user(settings)
    logger.info("Bootstrap completed successfully")


def main() -> None:
    from app.core.config import get_settings

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    settings = get_settings()
    bootstrap(settings)


if __name__ == "__main__":
    main()

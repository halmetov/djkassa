from __future__ import annotations

import logging
import sys
import time
import traceback
from contextlib import contextmanager
from threading import Thread
from typing import Callable, Iterable

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


def apply_migrations(settings: Settings, *, timeout_seconds: float = 30.0) -> None:
    env = (settings.environment or "").lower()
    if env == "dev":
        logger.info("Environment is 'dev'; skipping automatic migrations on startup. Run alembic upgrade head manually if needed.")
        return

    if not settings.auto_run_migrations:
        logger.info("Automatic migrations disabled via configuration; skipping startup migrations")
        return

    logger.info("Applying migrations on startup (upgrade head) in background thread")
    result: dict[str, object | None] = {"error": None, "traceback": None}

    def _run() -> None:
        worker_start = time.perf_counter()
        logger.info("[migrations] Worker starting (upgrade head)")
        try:
            run_migrations_on_startup(settings, raise_on_error=False)
        except Exception as exc:  # pragma: no cover - runtime safeguard
            result["error"] = exc
            result["traceback"] = traceback.format_exc()
            logger.error(
                "[migrations] Worker failed after %.2fs", time.perf_counter() - worker_start, exc_info=exc
            )
        else:
            logger.info("[migrations] Worker finished successfully in %.2fs", time.perf_counter() - worker_start)

    start = time.perf_counter()
    thread = Thread(target=_run, name="alembic-upgrade-worker", daemon=True)
    thread.start()
    thread.join(timeout_seconds)
    elapsed = time.perf_counter() - start

    if thread.is_alive():
        logger.warning(
            "Migrations still running after %.2fs (timeout=%.0fs); continuing startup while migration thread remains in background",
            elapsed,
            timeout_seconds,
        )
    elif result.get("error"):
        logger.error(
            "Migrations finished with errors after %.2fs; API will still start. Error: %s\n%s",
            elapsed,
            result["error"],
            result.get("traceback", ""),
        )
    else:
        logger.info("Migrations applied successfully in %.2fs", elapsed)


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


def _run_step(name: str, func: Callable[[], None]) -> None:
    logger.info("[bootstrap] START %s", name)
    start = time.perf_counter()
    try:
        func()
    except Exception:
        elapsed = time.perf_counter() - start
        logger.exception("[bootstrap] FAILED %s | elapsed=%.2fs", name, elapsed)
    else:
        elapsed = time.perf_counter() - start
        logger.info("[bootstrap] DONE %s | elapsed=%.2fs", name, elapsed)


def bootstrap(settings: Settings) -> None:
    logger.info("Starting application bootstrap")
    overall_start = time.perf_counter()

    steps: list[tuple[str, Callable[[], None]]] = [
        ("check db", check_database_connection),
        ("run migrations", lambda: apply_migrations(settings)),
        ("seed branches", lambda: ensure_default_branches(settings)),
        ("seed admin user", lambda: ensure_admin_user(settings)),
    ]

    for name, func in steps:
        _run_step(name, func)

    logger.info("Bootstrap completed | total_elapsed=%.2fs", time.perf_counter() - overall_start)


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

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import TYPE_CHECKING

from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.database.base import Base
from app.database.session import engine

LOGGER = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_CONFIG_PATH = BACKEND_DIR / "alembic.ini"
MIGRATIONS_PATH = BACKEND_DIR / "migrations"

if TYPE_CHECKING:  # pragma: no cover - only for type checkers
    from alembic.config import Config


def _safe_import_alembic():
    try:
        from alembic import command  # type: ignore
        from alembic.config import Config  # type: ignore
    except ModuleNotFoundError:
        LOGGER.warning(
            "Alembic is not installed; skipping automatic migrations. "
            "Install Alembic to enable database migrations."
        )
        return None, None
    return command, Config


def _list_migration_files() -> list[Path]:
    versions_dir = MIGRATIONS_PATH / "versions"
    if not versions_dir.exists():
        return []
    return [path for path in versions_dir.glob("*.py") if path.name != "__init__.py"]


def _should_bootstrap_schema(settings: Settings) -> bool:
    env = (settings.environment or "").lower()
    return settings.debug or env == "dev"


def _bootstrap_schema_when_empty(settings: Settings) -> bool:
    if _list_migration_files():
        return False

    if not _should_bootstrap_schema(settings):
        LOGGER.info(
            "No migration files found but environment is not dev/debug; skipping automatic schema creation."
        )
        return False

    LOGGER.warning(
        "No Alembic migrations found in %s. Creating tables directly from models (dev-only fallback).",
        MIGRATIONS_PATH / "versions",
    )
    Base.metadata.create_all(bind=engine)
    return True


def create_alembic_config(settings: Settings):
    _, Config = _safe_import_alembic()
    if Config is None:
        return None

    if not ALEMBIC_CONFIG_PATH.exists():
        LOGGER.warning("alembic.ini not found at %s; skipping migrations", ALEMBIC_CONFIG_PATH)
        return None

    config = Config(str(ALEMBIC_CONFIG_PATH))
    config.set_main_option("script_location", str(MIGRATIONS_PATH))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    config.attributes["configure_logger"] = False
    return config


def _generate_revision_if_needed(command, config: Config, message: str) -> None:
    def process_revision_directives(context, revision, directives):
        if directives and directives[0].upgrade_ops.is_empty():
            LOGGER.info("No schema changes detected; skipping revision generation.")
            directives[:] = []

    config.attributes["process_revision_directives"] = process_revision_directives
    command.revision(config, message=message, autogenerate=True)
    config.attributes.pop("process_revision_directives", None)


def run_migrations_on_startup(settings: Settings, *, raise_on_error: bool = True) -> None:
    if _bootstrap_schema_when_empty(settings):
        LOGGER.info("Schema created directly from models because no migrations were found (dev/debug mode).")
        return

    if not settings.auto_run_migrations:
        LOGGER.info("Automatic migrations disabled; skipping upgrade.")
        return

    command, _ = _safe_import_alembic()
    if command is None:
        if raise_on_error:
            raise RuntimeError("Alembic is not installed; cannot run migrations.")
        return

    config = create_alembic_config(settings)
    if config is None:
        if raise_on_error:
            raise RuntimeError("Alembic configuration not found; cannot run migrations.")
        return

    try:
        autogenerate = settings.should_autogenerate_migrations
        if autogenerate:
            LOGGER.info("Autogenerate enabled via configuration; generating revision if needed.")
            _generate_revision_if_needed(command, config, "Auto generated migration")
        else:
            LOGGER.info("Autogenerate disabled; applying existing migrations only.")
        upgrade_start = time.perf_counter()
        LOGGER.info("Alembic upgrade to head starting")
        command.upgrade(config, "head")
        LOGGER.info("Alembic upgrade to head finished in %.2fs", time.perf_counter() - upgrade_start)
    except OperationalError as exc:
        LOGGER.error("Automatic migrations failed; database is not reachable", exc_info=True)
        if raise_on_error:
            raise
    except Exception as exc:
        error_message = str(exc)
        if "Multiple head revisions are present" in error_message:
            LOGGER.error(
                "Alembic detected multiple heads. Run 'alembic heads' and merge them (alembic merge <head1> <head2> ...).",
                exc_info=True,
            )
        else:
            LOGGER.exception("Failed to run automatic migrations")
        if raise_on_error:
            raise


def upgrade_head(settings: Settings) -> None:
    command, _ = _safe_import_alembic()
    if command is None:
        raise SystemExit("Alembic is not installed. Install dependencies and try again.")

    config = create_alembic_config(settings)
    if config is None:
        raise SystemExit("Alembic configuration not found; cannot run migrations.")

    LOGGER.info("Applying migrations up to head.")
    try:
        command.upgrade(config, "head")
    except Exception as exc:
        error_message = str(exc)
        if "Multiple head revisions are present" in error_message:
            LOGGER.error(
                "Alembic detected multiple heads. Merge revisions first: alembic heads && alembic merge <head1> <head2> ...",
                exc_info=True,
            )
        raise


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run Alembic migrations")
    parser.add_argument(
        "command",
        nargs="?",
        default="upgrade",
        choices=["upgrade"],
        help="Migration command to run (only 'upgrade' to head is supported).",
    )
    args = parser.parse_args()

    settings = Settings()
    if args.command == "upgrade":
        upgrade_head(settings)


if __name__ == "__main__":
    main()

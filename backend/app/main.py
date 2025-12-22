import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import (
    routes_auth,
    routes_branches,
    routes_categories,
    routes_clients,
    routes_income,
    routes_products,
    routes_reports,
    routes_pos,
    routes_returns,
    routes_movements,
    routes_sales,
    routes_users,
)
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.database.session import SessionLocal
from app.database.migrations import run_migrations_on_startup
from app.auth.security import get_password_hash, verify_password
from app.models.user import User
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

import app.models  # noqa: F401 - ensure models are imported for metadata

settings = get_settings()
logger = logging.getLogger(__name__)

# Configure root logger for better debugging (useful for login errors, etc.)
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)

app = FastAPI(title="Kassa API", version="1.0.0", redirect_slashes=False)
app.router.redirect_slashes = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_origin_regex=settings.allowed_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)


def is_database_available() -> bool:
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        logger.exception(
            "Database is not available; skipping migrations and admin bootstrap during startup."
        )
        return False


@app.on_event("startup")
def on_startup() -> None:
    if not is_database_available():
        return

    try:
        run_migrations_on_startup(settings)
    except Exception:
        logger.exception("Startup migrations failed; continuing without applying migrations.")

    try:
        with SessionLocal() as db:
            admin = db.query(User).filter(User.login == "admin").first()
            desired_password = settings.admin_password
            if admin is None:
                new_admin = User(
                    name="Admin",
                    login="admin",
                    password_hash=get_password_hash(desired_password),
                    role="admin",
                    active=True,
                )
                db.add(new_admin)
                db.commit()
                logger.info("Bootstrap admin user created with provided credentials.")
            else:
                if desired_password and not verify_password(desired_password, admin.password_hash):
                    admin.password_hash = get_password_hash(desired_password)
                    db.commit()
                    logger.info("Bootstrap admin password updated from ADMIN_PASSWORD.")
    except SQLAlchemyError:
        logger.exception("Database is not available during startup; skipping admin bootstrap.")

app.include_router(routes_auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(routes_users.router, prefix="/api/users", tags=["users"])
app.include_router(routes_categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(routes_products.router, prefix="/api/products", tags=["products"])
app.include_router(routes_branches.router, prefix="/api/branches", tags=["branches"])
app.include_router(routes_income.router, prefix="/api/income", tags=["income"])
app.include_router(routes_sales.router, prefix="/api/sales", tags=["sales"])
app.include_router(routes_clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(routes_pos.router, prefix="/api/pos", tags=["pos"])
app.include_router(routes_reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(routes_returns.router, prefix="/api/returns", tags=["returns"])
app.include_router(routes_movements.router, prefix="/api/movements", tags=["movements"])

media_root = settings.media_root_path
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=media_root), name="static")


@app.get("/api/health", tags=["system"])
def api_healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

import logging
import sys
import time
from contextlib import asynccontextmanager
from pprint import pformat

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
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
    routes_cashier,
    routes_users,
    routes_debts,
    routes_expenses,
)
from app.bootstrap import bootstrap
from app.core.config import get_settings
from app.core.errors import register_error_handlers

import app.models  # noqa: F401 - ensure models are imported for metadata

settings = get_settings()
logger = logging.getLogger(__name__)

# Configure root logger for better debugging (useful for login errors, etc.)
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)


def log_startup_configuration() -> None:
    logger.info("Starting FastAPI application")
    logger.info("Environment: %s | Debug: %s", settings.environment, settings.debug)
    logger.info("Database URL: %s (location: %s)", settings.safe_database_url, settings.database_location)
    logger.info("Media root: %s", settings.media_root_path)
    logger.info("CORS allowed origins: %s", ", ".join(settings.allowed_cors_origins))
    logger.info(
        "Settings snapshot (safe):\n%s",
        pformat(settings.safe_settings_dump()),
    )


def log_registered_routes(application: FastAPI) -> None:
    route_entries: list[str] = []
    for route in application.routes:
        methods = getattr(route, "methods", None)
        if not methods:
            continue
        filtered_methods = sorted(method for method in methods if method not in {"HEAD", "OPTIONS"})
        if not filtered_methods:
            continue
        route_entries.append(f"{','.join(filtered_methods)} {route.path}")

    for entry in sorted(set(route_entries)):
        logger.info("Route registered: %s", entry)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_startup_configuration()
    logger.info("Application startup: running bootstrap")
    try:
        bootstrap(settings)
    except Exception as exc:
        logger.exception("Application bootstrap failed")
        raise SystemExit("Application failed to start; see logs above for details.") from exc
    yield
    logger.info("Application shutdown complete")


app = FastAPI(title="Kassa API", version="1.0.0", redirect_slashes=False, lifespan=lifespan)
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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    route_path = getattr(request.scope.get("route"), "path", request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "Request failed | method=%s path=%s elapsed_ms=%.2f",
            request.method,
            route_path,
            elapsed_ms,
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    status_code = getattr(response, "status_code", 500)
    log_method = logger.info if status_code < 400 else logger.warning if status_code < 500 else logger.error
    log_method(
        "Request completed | method=%s path=%s status=%s elapsed_ms=%.2f",
        request.method,
        route_path,
        status_code,
        elapsed_ms,
    )
    return response

app.include_router(routes_auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(routes_users.router, prefix="/api/users", tags=["users"])
app.include_router(routes_categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(routes_products.router, prefix="/api/products", tags=["products"])
app.include_router(routes_branches.router, prefix="/api/branches", tags=["branches"])
app.include_router(routes_income.router, prefix="/api/income", tags=["income"])
app.include_router(routes_sales.router, prefix="/api/sales", tags=["sales"])
app.include_router(routes_clients.router, prefix="/api/clients", tags=["clients"])
app.include_router(routes_pos.router, prefix="/api/pos", tags=["pos"])
app.include_router(routes_cashier.router, prefix="/api/cashier", tags=["cashier"])
app.include_router(routes_reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(routes_returns.router, prefix="/api/returns", tags=["returns"])
app.include_router(routes_movements.router, prefix="/api/movements", tags=["movements"])
app.include_router(routes_debts.router, prefix="/api/debts", tags=["debts"])
app.include_router(routes_expenses.router, prefix="/api/expenses", tags=["expenses"])

media_root = settings.media_root_path
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=media_root), name="static")

log_registered_routes(app)


@app.get("/api/health", tags=["system"])
def api_healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

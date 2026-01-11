import logging
import sys
import time
from contextlib import asynccontextmanager
from pprint import pformat

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    routes_production,
    routes_workshop,
)
from app.auth.security import reject_manager
from app.bootstrap import bootstrap
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.database.base import Base

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
    if settings.debug:
        table_names = sorted(Base.metadata.tables)
        logger.debug("SQLAlchemy metadata tables loaded: %s", ", ".join(table_names))


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
    startup_start = time.perf_counter()
    try:
        bootstrap(settings)
    except Exception:
        logger.exception(
            "Application bootstrap failed; API will continue to start regardless of bootstrap errors"
        )
    logger.info("Application startup complete. elapsed=%.2fs", time.perf_counter() - startup_start)
    yield
    logger.info("Application shutdown complete")


app = FastAPI(title="Kassa API", version="1.0.0", redirect_slashes=False, lifespan=lifespan)
app.router.redirect_slashes = False

cors_origins = set(settings.allowed_cors_origins)
cors_origins.update(
    {
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(cors_origins),
    allow_origin_regex=settings.allowed_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
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


# Ensure cache headers are explicit so SPA shell stays fresh while assets can be cached
@app.middleware("http")
async def cache_control(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    if request.method == "GET" and path.startswith("/assets/"):
        response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
    elif request.method == "GET" and not path.startswith(("/api", "/static")):
        response.headers["Cache-Control"] = "no-store"

    return response


# Keep CORSMiddleware as the outermost wrapper so error responses also carry CORS headers
app.user_middleware = sorted(
    app.user_middleware, key=lambda middleware: 0 if middleware.cls is CORSMiddleware else 1
)
app.middleware_stack = app.build_middleware_stack()

app.include_router(routes_auth.router, prefix="/api/auth", tags=["auth"])
manager_restricted = [Depends(reject_manager)]
app.include_router(routes_users.router, prefix="/api/users", tags=["users"], dependencies=manager_restricted)
app.include_router(routes_categories.router, prefix="/api/categories", tags=["categories"], dependencies=manager_restricted)
app.include_router(routes_products.router, prefix="/api/products", tags=["products"], dependencies=manager_restricted)
app.include_router(routes_branches.router, prefix="/api/branches", tags=["branches"], dependencies=manager_restricted)
app.include_router(routes_income.router, prefix="/api/income", tags=["income"], dependencies=manager_restricted)
app.include_router(routes_sales.router, prefix="/api/sales", tags=["sales"], dependencies=manager_restricted)
app.include_router(routes_clients.router, prefix="/api/clients", tags=["clients"], dependencies=manager_restricted)
app.include_router(routes_pos.router, prefix="/api/pos", tags=["pos"], dependencies=manager_restricted)
app.include_router(routes_cashier.router, prefix="/api/cashier", tags=["cashier"], dependencies=manager_restricted)
app.include_router(routes_reports.router, prefix="/api/reports", tags=["reports"], dependencies=manager_restricted)
app.include_router(routes_returns.router, prefix="/api/returns", tags=["returns"], dependencies=manager_restricted)
app.include_router(routes_movements.router, prefix="/api/movements", tags=["movements"], dependencies=manager_restricted)
app.include_router(routes_debts.router, prefix="/api/debts", tags=["debts"], dependencies=manager_restricted)
app.include_router(routes_expenses.router, prefix="/api/expenses", tags=["expenses"], dependencies=manager_restricted)
app.include_router(
    routes_production.router, prefix="/api/production", tags=["production"], dependencies=manager_restricted
)
app.include_router(routes_workshop.router, tags=["workshop"])

media_root = settings.media_root_path
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=media_root), name="static")

log_registered_routes(app)


frontend_dist_dir = settings.project_root / "frontend" / "dist"
frontend_index = frontend_dist_dir / "index.html"

assets_dir = frontend_dist_dir / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")
    logger.info("Serving frontend assets from %s", assets_dir)
else:
    logger.warning("Frontend assets directory not found at %s; assets mount skipped", assets_dir)


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    protected_prefixes = ("api", "static", "assets", "docs", "redoc", "openapi.json")
    if any(full_path.startswith(prefix) for prefix in protected_prefixes):
        raise HTTPException(status_code=404, detail="Not found")

    if frontend_index.exists():
        return FileResponse(frontend_index)

    logger.error(
        "SPA fallback attempted but frontend build is missing | path=%s index=%s", full_path, frontend_index
    )
    raise HTTPException(status_code=503, detail="Frontend build not found; run npm run build")


@app.get("/api/health", tags=["system"])
def api_healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health", tags=["system"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

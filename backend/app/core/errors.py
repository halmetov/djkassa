from __future__ import annotations

import logging
import traceback
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _build_base_payload(request: Request, *, error_type: str, detail: str, trace: str | None = None) -> dict[str, Any]:
    settings = get_settings()
    request_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "detail": detail,
        "error_type": error_type,
        "path": request.url.path,
        "method": request.method,
        "request_id": request_id,
    }
    if settings.debug and trace:
        payload["trace"] = trace
    return payload


def _log_exception(exc: BaseException) -> str:
    trace = traceback.format_exc()
    logger.exception("Unhandled application error", exc_info=exc)
    return trace


def register_error_handlers(app: FastAPI) -> None:
    def _safe_add_exception_handler(exc_cls: type[BaseException], handler):
        if not isinstance(exc_cls, type):
            logger.error("Skipping handler registration: %r is not a class", exc_cls)
            return
        app.add_exception_handler(exc_cls, handler)

    async def integrity_error_handler(request: Request, exc: IntegrityError):  # type: ignore[override]
        trace = _log_exception(exc)
        payload = _build_base_payload(
            request,
            error_type="IntegrityError",
            detail=f"Integrity error: {exc.orig}",
            trace=trace,
        )
        return JSONResponse(status_code=400, content=payload)

    async def db_schema_error_handler(request: Request, exc: SQLAlchemyError):  # type: ignore[override]
        trace = _log_exception(exc)
        detail_message = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        payload = _build_base_payload(
            request,
            error_type=exc.__class__.__name__,
            detail=f"DB schema mismatch: {detail_message}",
            trace=trace,
        )
        status_code = 500
        return JSONResponse(status_code=status_code, content=payload)

    async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):  # type: ignore[override]
        trace = _log_exception(exc)
        detail_message = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
        payload = _build_base_payload(
            request,
            error_type="SQLAlchemyError",
            detail=f"Database error: {detail_message}",
            trace=trace,
        )
        return JSONResponse(status_code=500, content=payload)

    async def validation_error_handler(request: Request, exc: ValidationError | RequestValidationError):  # type: ignore[override]
        trace = _log_exception(exc)
        error_details = exc.errors()
        if error_details:
            first_error = error_details[0]
            location = ".".join(str(part) for part in first_error.get("loc", []) if part not in {"body"})
            msg = first_error.get("msg", "Validation error")
            if location:
                detail = f"Validation error: field '{location}' - {msg}"
            else:
                detail = f"Validation error: {msg}"
        else:
            detail = "Validation error"
        payload = _build_base_payload(
            request,
            error_type="ValidationError",
            detail=detail,
            trace=trace,
        )
        return JSONResponse(status_code=422, content=payload)

    async def http_exception_handler(request: Request, exc: StarletteHTTPException):  # type: ignore[override]
        trace = _log_exception(exc)
        detail_message = exc.detail if exc.detail else exc.__class__.__name__
        payload = _build_base_payload(
            request,
            error_type="HTTPException",
            detail=str(detail_message),
            trace=trace,
        )
        return JSONResponse(status_code=exc.status_code, content=payload)

    async def unhandled_error_handler(request: Request, exc: Exception):  # type: ignore[override]
        trace = _log_exception(exc)
        payload = _build_base_payload(
            request,
            error_type=exc.__class__.__name__,
            detail="Internal server error",
            trace=trace,
        )
        return JSONResponse(status_code=500, content=payload)

    _safe_add_exception_handler(IntegrityError, integrity_error_handler)
    for error_cls in (ProgrammingError, OperationalError):
        _safe_add_exception_handler(error_cls, db_schema_error_handler)
    _safe_add_exception_handler(SQLAlchemyError, sqlalchemy_error_handler)
    for error_cls in (ValidationError, RequestValidationError):
        _safe_add_exception_handler(error_cls, validation_error_handler)
    _safe_add_exception_handler(StarletteHTTPException, http_exception_handler)
    _safe_add_exception_handler(Exception, unhandled_error_handler)

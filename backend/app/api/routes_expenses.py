from __future__ import annotations

import logging
import traceback
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user, require_employee, require_admin
from app.core.enums import UserRole
from app.database.session import get_db
from app.models.entities import Branch, Expense
from app.models.user import User
from app.schemas.expenses import ExpenseCreate, ExpenseOut

router = APIRouter(redirect_slashes=False)
logger = logging.getLogger(__name__)


def _get_date_range(start_date: date | None, end_date: date | None) -> tuple[datetime, datetime]:
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(start_date or today, time.min, tzinfo=timezone.utc)
    end_boundary = end_date or today
    end = datetime.combine(end_boundary, time.max, tzinfo=timezone.utc)
    return start, end


def _resolve_branch_id(current_user: User, branch_id: int | None) -> int | None:
    role_value = current_user.role.value if isinstance(current_user.role, UserRole) else current_user.role
    if role_value == UserRole.ADMIN.value:
        return branch_id

    user_branch_id = current_user.branch_id
    if branch_id is None:
        return user_branch_id
    if user_branch_id is not None and branch_id != user_branch_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для этого филиала")
    return branch_id


def _handle_expense_db_error(message: str, exc: SQLAlchemyError, *, trace_id: str) -> JSONResponse:
    logger.exception("%s | trace_id=%s", message, trace_id, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": message, "error_code": "expenses_database_error", "trace_id": trace_id},
    )


def _log_expense_call(origin: str | None, method: str, status_code: int, trace_id: str) -> None:
    logger.info(
        "Expenses request | origin=%s method=%s status=%s trace_id=%s",
        origin or "-",
        method,
        status_code,
        trace_id,
    )


def _log_request_entry(request: Request, current_user: User | None, trace_id: str) -> None:
    headers = request.headers
    origin = headers.get("origin") or "-"
    auth_header = headers.get("authorization")
    logger.info(
        "Expenses handler start | method=%s path=%s query=%s origin=%s auth_present=%s user_id=%s trace_id=%s",
        request.method,
        request.url.path,
        request.url.query,
        origin,
        bool(auth_header),
        getattr(current_user, "id", None),
        trace_id,
    )


def _unexpected_error_response(request: Request, exc: Exception, trace_id: str) -> JSONResponse:
    logger.error(
        "Unexpected expenses error | method=%s path=%s trace_id=%s\n%s",
        request.method,
        request.url.path,
        trace_id,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error_code": "expenses_unexpected_error",
            "trace_id": trace_id,
        },
    )


@router.options("")
async def expenses_preflight() -> JSONResponse:
    """Explicit preflight responder to keep browsers happy on strict CORS setups."""
    return JSONResponse(status_code=status.HTTP_200_OK, content={"status": "ok"})


@router.get("", response_model=list[ExpenseOut], dependencies=[Depends(require_employee)])
async def list_expenses(
    request: Request,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trace_id = getattr(request.state, "trace_id", None) or str(uuid.uuid4())
    request.state.trace_id = trace_id
    origin = request.headers.get("origin")

    _log_request_entry(request, current_user, trace_id)

    try:
        start_dt, end_dt = _get_date_range(start_date, end_date)
        branch_id = _resolve_branch_id(current_user, None)
        query = (
            select(Expense)
            .options(joinedload(Expense.created_by))
            .where(Expense.created_at >= start_dt, Expense.created_at <= end_dt)
            .order_by(Expense.created_at.desc())
        )
        if branch_id is not None:
            query = query.where(Expense.branch_id == branch_id)
        expenses = db.execute(query).scalars().unique().all()
    except HTTPException as exc:
        _log_expense_call(origin, request.method, exc.status_code, trace_id)
        raise
    except SQLAlchemyError as exc:
        _log_expense_call(origin, request.method, status.HTTP_500_INTERNAL_SERVER_ERROR, trace_id)
        return _handle_expense_db_error("Не удалось получить список расходов", exc, trace_id=trace_id)
    except Exception as exc:  # pragma: no cover - defensive logging for unexpected errors
        _log_expense_call(origin, request.method, status.HTTP_500_INTERNAL_SERVER_ERROR, trace_id)
        return _unexpected_error_response(request, exc, trace_id)

    response_payload = []
    for expense in expenses:
        validated = ExpenseOut.model_validate(expense, from_attributes=True)
        response_payload.append(
            validated.model_copy(
                update={
                    "created_by_name": expense.created_by.name if expense.created_by else None,
                    "amount": float(expense.amount),
                }
            )
        )
    _log_expense_call(origin, request.method, status.HTTP_200_OK, trace_id)
    return response_payload


@router.post(
    "",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_employee)],
)
async def create_expense(
    request: Request,
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trace_id = getattr(request.state, "trace_id", None) or str(uuid.uuid4())
    request.state.trace_id = trace_id
    origin = request.headers.get("origin")

    _log_request_entry(request, current_user, trace_id)

    try:
        branch_id = _resolve_branch_id(current_user, payload.branch_id)
        if branch_id is not None:
            branch = db.get(Branch, branch_id)
            if branch is None:
                raise HTTPException(status_code=400, detail="Филиал не найден")

        logger.debug(
            "Expense creation prepared | title=%s amount=%s branch_id=%s user_id=%s trace_id=%s",
            payload.title,
            payload.amount,
            branch_id,
            current_user.id,
            trace_id,
        )
        expense = Expense(
            title=payload.title,
            amount=Decimal(str(payload.amount)),
            created_by_id=current_user.id,
            branch_id=branch_id,
        )
        db.add(expense)
        logger.debug("Expense added to session | trace_id=%s", trace_id)
        db.commit()
        logger.info("Expense committed | expense_id=%s trace_id=%s", expense.id, trace_id)
        db.refresh(expense)
        logger.debug(
            "Expense refreshed | expense_id=%s created_at=%s trace_id=%s",
            expense.id,
            expense.created_at,
            trace_id,
        )
    except HTTPException as exc:
        _log_expense_call(origin, request.method, exc.status_code, trace_id)
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        _log_expense_call(origin, request.method, status.HTTP_500_INTERNAL_SERVER_ERROR, trace_id)
        return _handle_expense_db_error("Не удалось сохранить расход", exc, trace_id=trace_id)
    except Exception as exc:  # pragma: no cover - defensive logging for unexpected errors
        db.rollback()
        _log_expense_call(origin, request.method, status.HTTP_500_INTERNAL_SERVER_ERROR, trace_id)
        return _unexpected_error_response(request, exc, trace_id)

    _log_expense_call(origin, request.method, status.HTTP_201_CREATED, trace_id)
    validated_expense = ExpenseOut.model_validate(expense, from_attributes=True)
    response_payload = validated_expense.model_copy(
        update={"created_by_name": current_user.name, "amount": float(expense.amount)}
    )
    logger.info(
        "Expense response prepared | expense_id=%s trace_id=%s", expense.id, trace_id
    )
    return response_payload


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Расход не найден")
    db.delete(expense)
    db.commit()
    return None

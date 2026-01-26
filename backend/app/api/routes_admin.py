from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user, require_admin
from app.core.enums import UserRole
from app.database.session import get_db
from app.models.entities import SalaryPayment
from app.models.user import User
from app.schemas import salary_payments as salary_schema

router = APIRouter(redirect_slashes=False, dependencies=[Depends(require_admin)])


def _get_almaty_month_bounds(month: str | None) -> tuple[datetime, datetime]:
    almaty_tz = ZoneInfo("Asia/Almaty")
    if month:
        try:
            period_start = datetime.strptime(month, "%Y-%m").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM.") from exc
    else:
        now_almaty = datetime.now(almaty_tz)
        period_start = now_almaty.date().replace(day=1)

    last_day = monthrange(period_start.year, period_start.month)[1]
    start_local = datetime(period_start.year, period_start.month, 1, tzinfo=almaty_tz)
    end_local = datetime(
        period_start.year,
        period_start.month,
        last_day,
        23,
        59,
        59,
        999999,
        tzinfo=almaty_tz,
    )
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _as_user_out(user: User) -> salary_schema.SalaryPaymentUserOut:
    return salary_schema.SalaryPaymentUserOut(id=user.id, name=user.name)


@router.get("/employees", response_model=list[salary_schema.SalaryPaymentUserOut])
async def list_salary_employees(db: Session = Depends(get_db)):
    users = db.execute(select(User).where(User.role != UserRole.ADMIN).order_by(User.name)).scalars().all()
    return [_as_user_out(user) for user in users]


@router.post(
    "/salary-payments",
    response_model=salary_schema.SalaryPaymentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_salary_payment(
    payload: salary_schema.SalaryPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    amount_value = float(payload.amount)
    if amount_value <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    employee = db.get(User, payload.employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    role_value = employee.role.value if isinstance(employee.role, UserRole) else employee.role
    if role_value == UserRole.ADMIN.value:
        raise HTTPException(status_code=400, detail="Employee must not be admin")

    payment = SalaryPayment(
        employee_id=employee.id,
        created_by_admin_id=current_user.id,
        payment_type=payload.payment_type,
        amount=Decimal(str(amount_value)),
        comment=payload.comment.strip() if payload.comment else None,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return salary_schema.SalaryPaymentOut(
        id=payment.id,
        employee=_as_user_out(employee),
        payment_type=payment.payment_type,
        amount=float(payment.amount),
        comment=payment.comment,
        created_at=payment.created_at,
        created_by_admin=_as_user_out(current_user),
    )


@router.get("/salary-payments", response_model=salary_schema.SalaryPaymentListOut)
async def list_salary_payments(
    month: str | None = None,
    employee_id: int | None = None,
    db: Session = Depends(get_db),
):
    start_dt, end_dt = _get_almaty_month_bounds(month)
    filters = [SalaryPayment.created_at >= start_dt, SalaryPayment.created_at <= end_dt]
    if employee_id:
        filters.append(SalaryPayment.employee_id == employee_id)

    payments = (
        db.execute(
            select(SalaryPayment)
            .options(joinedload(SalaryPayment.employee), joinedload(SalaryPayment.created_by))
            .where(*filters)
            .order_by(SalaryPayment.created_at.desc())
        )
        .scalars()
        .all()
    )

    total_amount = db.execute(select(func.coalesce(func.sum(SalaryPayment.amount), 0)).where(*filters)).scalar_one()

    items = [
        salary_schema.SalaryPaymentOut(
            id=payment.id,
            employee=_as_user_out(payment.employee),
            payment_type=payment.payment_type,
            amount=float(payment.amount),
            comment=payment.comment,
            created_at=payment.created_at,
            created_by_admin=_as_user_out(payment.created_by),
        )
        for payment in payments
    ]

    return salary_schema.SalaryPaymentListOut(items=items, total_amount=float(total_amount or 0))

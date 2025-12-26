from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import get_current_user, require_employee
from app.database.session import get_db
from app.models.entities import Client, Debt, DebtPayment
from app.models.user import User
from app.schemas.debts import DebtPayment as DebtPaymentSchema
from app.schemas.debts import DebtPaymentCreate

router = APIRouter(redirect_slashes=False)


@router.post(
    "/pay",
    response_model=DebtPaymentSchema,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_employee)],
)
async def pay_off_debt(
    payload: DebtPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Клиент не найден")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Сумма должна быть больше 0")

    if current_user.role != "admin":
        if current_user.branch_id is None:
            raise HTTPException(status_code=403, detail="Сотрудник не привязан к филиалу")
        if payload.branch_id and payload.branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Нельзя указать другой филиал для оплаты долга")

    branch_id = payload.branch_id or current_user.branch_id

    try:
        amount_decimal = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
        current_debt = Decimal(str(client.total_debt or 0)).quantize(Decimal("0.01"))
        applied_amount = min(amount_decimal, current_debt) if current_debt > 0 else amount_decimal

        remaining = applied_amount
        targeted_debts: list[Debt] = []
        if payload.debt_id:
            targeted = db.get(Debt, payload.debt_id)
            if not targeted or targeted.client_id != client.id:
                raise HTTPException(status_code=404, detail="Долг не найден")
            targeted_debts.append(targeted)

        if not targeted_debts:
            targeted_debts = (
                db.execute(
                    select(Debt)
                    .where(Debt.client_id == client.id, Debt.amount > Debt.paid)
                    .order_by(Debt.created_at)
                )
                .scalars()
                .all()
            )

        for debt in targeted_debts:
            debt_remaining = Decimal(str(debt.amount)) - Decimal(str(debt.paid or 0))
            if debt_remaining <= 0:
                continue
            portion = min(remaining, debt_remaining)
            debt.paid = float(Decimal(str(debt.paid or 0)) + portion)
            remaining -= portion
            if remaining <= 0:
                break

        client.total_debt = float(max(current_debt - applied_amount, Decimal("0")))

        debt_payment = DebtPayment(
            client_id=client.id,
            debt_id=payload.debt_id,
            amount=applied_amount,
            payment_type=payload.payment_type,
            processed_by_id=current_user.id,
            created_by_id=current_user.id,
            branch_id=branch_id,
        )
        db.add(debt_payment)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(debt_payment)
    return debt_payment

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from core.models import Order, OrderItem, Payment, Customer, CustomerDebt, DebtPayment
from common.utils import to_decimal


def _compute_payment_status(total: Decimal, paid: Decimal) -> str:
    if paid == 0:
        return "unpaid"
    if paid < total:
        return "partial"
    if paid == total:
        return "paid"
    if paid < 0:
        return "debt"
    return "paid"


async def create_order(*, user, branch, customer: Customer | None, items_data, discount: Decimal, manual_extra: Decimal, note: str = "") -> Order:
    async with transaction.async_atomic():
        order = await Order.objects.acreate(
            branch=branch,
            customer=customer,
            created_by=user,
            status="new",
            payment_status="unpaid",
            discount=discount,
            manual_extra=manual_extra,
            total=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            debt_amount=Decimal("0.00"),
            note=note,
        )
        total = Decimal("0.00")
        for item in items_data:
            qty = to_decimal(item["qty"])
            price = to_decimal(item["price"])
            line_total = qty * price
            total += line_total
            await OrderItem.objects.acreate(order=order, product=item["product"], qty=qty, price=price, line_total=line_total)
        total = total - discount + manual_extra
        order.total = total
        order.payment_status = _compute_payment_status(total, order.paid_amount)
        order.debt_amount = total - order.paid_amount
        await order.asave(update_fields=["total", "payment_status", "debt_amount"])
    return order


async def add_payment(order: Order, *, user, method: str, amount: Decimal) -> Payment:
    async with transaction.async_atomic():
        payment = await Payment.objects.acreate(order=order, created_by=user, method=method, amount=amount)
        order.paid_amount += amount
        order.debt_amount = max(order.total - order.paid_amount, Decimal("0.00"))
        order.payment_status = _compute_payment_status(order.total, order.paid_amount)
        await order.asave(update_fields=["paid_amount", "debt_amount", "payment_status"])
    return payment


async def ensure_debt(order: Order) -> CustomerDebt:
    customer = order.customer
    if not customer:
        raise ValueError("Для создания долга нужен клиент")
    debt, _ = await CustomerDebt.objects.aget_or_create(
        order=order, defaults={"customer": customer, "amount": order.debt_amount}
    )
    updated = False
    if debt.amount != order.debt_amount:
        debt.amount = order.debt_amount
        updated = True
    if debt.amount <= 0:
        debt.is_closed = True
        debt.closed_at = timezone.now()
        debt.amount = Decimal("0.00")
        updated = True
    if updated:
        await debt.asave(update_fields=["amount", "is_closed", "closed_at"])
    return debt


async def add_debt_payment(debt: CustomerDebt, *, user, amount: Decimal) -> DebtPayment:
    async with transaction.async_atomic():
        payment = await DebtPayment.objects.acreate(debt=debt, created_by=user, amount=amount)
        debt.amount -= amount
        if debt.amount <= 0:
            debt.is_closed = True
            debt.closed_at = timezone.now()
            debt.amount = Decimal("0.00")
        await debt.asave(update_fields=["amount", "is_closed", "closed_at"])
    return payment

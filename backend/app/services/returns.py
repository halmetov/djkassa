from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from app.models.entities import Return


@dataclass
class ReturnBreakdown:
    total: float
    cash: float
    card: float
    debt: float


def calculate_return_breakdowns(returns: Iterable[Return]) -> dict[int, ReturnBreakdown]:
    breakdowns: dict[int, ReturnBreakdown] = {}
    returns_by_sale: dict[int, list[Return]] = defaultdict(list)

    for return_entry in returns:
        if return_entry.sale_id is not None:
            returns_by_sale[return_entry.sale_id].append(return_entry)

    for sale_returns in returns_by_sale.values():
        if not sale_returns:
            continue
        sale = sale_returns[0].sale
        if sale is None:
            continue

        cash_pool = float(sale.paid_cash or 0)
        card_pool = float(sale.paid_card or 0)
        debt_pool = float(sale.paid_debt or 0)

        for entry in sorted(sale_returns, key=lambda r: r.created_at):
            total_amount = float(sum(item.amount for item in entry.items) or 0)
            debt_offset = float(entry.debt_offset_amount or 0)
            if debt_offset > 0:
                debt_used = min(debt_offset, total_amount)
                cash_used = max(total_amount - debt_used, 0)
                breakdowns[entry.id] = ReturnBreakdown(
                    total=total_amount,
                    cash=cash_used,
                    card=0,
                    debt=debt_used,
                )
                continue

            remaining = total_amount

            debt_used = min(remaining, debt_pool)
            debt_pool -= debt_used
            remaining -= debt_used

            cash_used = min(remaining, cash_pool)
            cash_pool -= cash_used
            remaining -= cash_used

            card_used = min(remaining, card_pool)
            card_pool -= card_used
            remaining -= card_used

            if remaining > 0:
                card_used += remaining
                remaining = 0

            breakdowns[entry.id] = ReturnBreakdown(
                total=total_amount,
                cash=cash_used,
                card=card_used,
                debt=debt_used,
            )

    return breakdowns

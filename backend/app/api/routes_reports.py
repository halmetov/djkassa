from fastapi import APIRouter, Depends
from datetime import date, datetime, time, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.security import require_admin
from app.database.session import get_db
from app.models.entities import Branch, Client, Debt, DebtPayment, Product, Return, Sale, SaleItem, User
from app.schemas import reports as report_schema
from app.services.returns import calculate_return_breakdowns

router = APIRouter(redirect_slashes=False)


def _apply_date_filters(query, start_date: date | None, end_date: date | None, column=Sale.created_at):
    if start_date:
        query = query.where(column >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(column <= datetime.combine(end_date, time.max))
    return query


@router.get(
    "/summary",
    response_model=report_schema.SummaryResponse,
    dependencies=[Depends(require_admin)],
)
async def get_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    seller_id: int | None = None,
    db: Session = Depends(get_db),
):
    if start_date and not end_date:
        end_date = start_date
    if end_date and not start_date:
        start_date = end_date
    start_date = start_date or date.today()
    end_date = end_date or start_date
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)

    sale_filters = [Sale.created_at >= start_dt, Sale.created_at <= end_dt]
    if branch_id:
        sale_filters.append(Sale.branch_id == branch_id)
    if seller_id:
        sale_filters.append(Sale.seller_id == seller_id)

    sales_total, cash_total, card_total, _ = db.execute(
        select(
            func.coalesce(func.sum(Sale.total_amount), 0),
            func.coalesce(func.sum(Sale.paid_cash), 0),
            func.coalesce(func.sum(Sale.paid_card), 0),
            func.coalesce(func.sum(Sale.paid_debt), 0),
        ).where(*sale_filters)
    ).one()

    return_query = (
        select(Return)
        .options(
            selectinload(Return.items),
            joinedload(Return.sale),
        )
        .where(Return.created_at >= start_dt, Return.created_at <= end_dt)
    )
    if branch_id:
        return_query = return_query.where(Return.branch_id == branch_id)
    if seller_id:
        return_query = return_query.where(Return.created_by_id == seller_id)
    return_entries = db.execute(return_query).scalars().unique().all()
    return_breakdowns = calculate_return_breakdowns(return_entries)
    refunds_total = sum(b.total for b in return_breakdowns.values())
    refunds_cash = sum(b.cash for b in return_breakdowns.values())
    refunds_card = sum(b.card for b in return_breakdowns.values())
    refunds_debt = sum(b.debt for b in return_breakdowns.values())

    debt_filters = [
        DebtPayment.created_at >= start_dt,
        DebtPayment.created_at <= end_dt,
    ]
    if branch_id:
        debt_filters.append(DebtPayment.branch_id == branch_id)
    if seller_id:
        debt_filters.append(DebtPayment.processed_by_id == seller_id)

    debt_payment_cash, debt_payment_card, debt_payments_amount = db.execute(
        select(
            func.coalesce(
                func.sum(
                    case((DebtPayment.payment_type == "cash", DebtPayment.amount), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((DebtPayment.payment_type != "cash", DebtPayment.amount), else_=0)
                ),
                0,
            ),
            func.coalesce(func.sum(DebtPayment.amount), 0),
        ).where(*debt_filters)
    ).one()

    debt_created_query = select(func.coalesce(func.sum(Debt.amount), 0)).select_from(Debt)
    if branch_id or seller_id:
        debt_created_query = debt_created_query.select_from(Debt.__table__.join(Sale, Debt.sale_id == Sale.id))
        if branch_id:
            debt_created_query = debt_created_query.where(Sale.branch_id == branch_id)
        if seller_id:
            debt_created_query = debt_created_query.where(Sale.seller_id == seller_id)
    debt_created_query = debt_created_query.where(Debt.created_at >= start_dt, Debt.created_at <= end_dt)
    debts_created_amount = db.execute(debt_created_query).scalar() or 0

    total_debt_all_clients = db.execute(select(func.coalesce(func.sum(Client.total_debt), 0))).scalar() or 0

    cash_sales_net = float(cash_total or 0) - float(refunds_cash)
    card_sales_net = float(card_total or 0) - float(refunds_card)
    debt_payments_amount = float(debt_payments_amount or 0)
    debts_created_amount = float(debts_created_amount or 0)

    cash_total_value = cash_sales_net + float(debt_payment_cash or 0)
    card_total_value = card_sales_net + float(debt_payment_card or 0)

    sales_total_value = float(sales_total or 0) - float(refunds_total)

    grand_total = cash_sales_net + card_sales_net + debts_created_amount + debt_payments_amount - float(refunds_debt)

    return report_schema.SummaryResponse(
        start_date=start_date,
        end_date=end_date,
        cash_total=cash_total_value,
        card_total=card_total_value,
        debts_created_amount=debts_created_amount,
        debt_payments_amount=debt_payments_amount,
        refunds_total=float(refunds_total or 0),
        sales_total=sales_total_value,
        grand_total=grand_total,
        total_debt_all_clients=float(total_debt_all_clients or 0),
    )


@router.get(
    "/summary/operations",
    response_model=report_schema.ReportsResponse,
    dependencies=[Depends(require_admin)],
)
async def get_operations_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    seller_id: int | None = None,
    db: Session = Depends(get_db),
):
    branch_clause_sale = Sale.branch_id == branch_id if branch_id else None

    base_query = select(Sale, User.name, Branch.name).join(User).join(Branch)
    if branch_clause_sale is not None:
        base_query = base_query.where(branch_clause_sale)
    if seller_id:
        base_query = base_query.where(Sale.seller_id == seller_id)
    sales_result = db.execute(_apply_date_filters(base_query, start_date, end_date))
    operations = []
    for sale, seller_name, branch_name in sales_result.all():
        operations.append(
            report_schema.SaleSummary(
                id=sale.id,
                entry_type="sale",
                created_at=sale.created_at,
                seller=seller_name,
                branch=branch_name,
                total_amount=sale.total_amount,
                payment_type=sale.payment_type,
                paid_cash=sale.paid_cash,
                paid_card=sale.paid_card,
                paid_debt=sale.paid_debt,
            )
        )

    return_query = (
        select(Return)
        .options(
            joinedload(Return.branch),
            joinedload(Return.created_by),
            selectinload(Return.items),
            joinedload(Return.sale),
        )
        .order_by(Return.created_at.desc())
    )
    if branch_id:
        return_query = return_query.where(Return.branch_id == branch_id)
    if seller_id:
        return_query = return_query.where(Return.created_by_id == seller_id)
    return_query = _apply_date_filters(return_query, start_date, end_date, Return.created_at)
    return_entries = db.execute(return_query).scalars().unique().all()
    return_breakdowns = calculate_return_breakdowns(return_entries)

    for entry in return_entries:
        breakdown = return_breakdowns.get(entry.id)
        total_amount = breakdown.total if breakdown else sum(item.amount for item in entry.items)
        operations.append(
            report_schema.SaleSummary(
                id=entry.id,
                entry_type="return",
                created_at=entry.created_at,
                seller=entry.created_by.name if entry.created_by else "-",
                branch=entry.branch.name if entry.branch else "-",
                total_amount=-float(total_amount),
                payment_type="return",
                paid_cash=-(breakdown.cash if breakdown else total_amount),
                paid_card=-(breakdown.card if breakdown else 0),
                paid_debt=-(breakdown.debt if breakdown else 0),
            )
        )

    debt_query = select(
        DebtPayment.id,
        DebtPayment.created_at,
        DebtPayment.payment_type,
        DebtPayment.amount,
        Branch.name,
        User.name,
    ).join(Branch, DebtPayment.branch_id == Branch.id, isouter=True).join(
        User, DebtPayment.processed_by_id == User.id, isouter=True
    )
    if branch_id:
        debt_query = debt_query.where(DebtPayment.branch_id == branch_id)
    if seller_id:
        debt_query = debt_query.where(DebtPayment.processed_by_id == seller_id)
    debt_query = _apply_date_filters(debt_query, start_date, end_date, DebtPayment.created_at)
    for row in db.execute(debt_query):
        amount = float(row[3] or 0)
        operations.append(
            report_schema.SaleSummary(
                id=row[0],
                entry_type="debt_payment",
                created_at=row[1],
                seller=row[5] or "-",
                branch=row[4] or "-",
                total_amount=amount,
                payment_type=row[2],
                paid_cash=amount if row[2] == "cash" else 0,
                paid_card=amount if row[2] != "cash" else 0,
                paid_debt=0,
            )
        )

    operations.sort(key=lambda op: op.created_at, reverse=True)

    by_day_map: dict[date, report_schema.DailyReport] = {}
    by_seller_map: dict[str, float] = {}
    by_branch_map: dict[str, float] = {}

    for op in operations:
        op_date = op.created_at.date()
        if op_date not in by_day_map:
            by_day_map[op_date] = report_schema.DailyReport(day=op_date, total_sales=0, total_credit=0)
        by_day = by_day_map[op_date]
        by_day.total_sales += op.total_amount
        by_day.total_credit += op.paid_debt

        if op.seller:
            by_seller_map[op.seller] = by_seller_map.get(op.seller, 0) + op.total_amount
        if op.branch:
            by_branch_map[op.branch] = by_branch_map.get(op.branch, 0) + op.total_amount

    by_day = list(by_day_map.values())
    by_day.sort(key=lambda entry: entry.day)
    by_seller = [report_schema.StaffReport(seller=name, total=total) for name, total in by_seller_map.items()]
    by_branch = [report_schema.BranchReport(branch=name, total=total) for name, total in by_branch_map.items()]

    return report_schema.ReportsResponse(sales=operations, by_day=by_day, by_seller=by_seller, by_branch=by_branch)


@router.get(
    "/analytics",
    response_model=report_schema.AnalyticsResponse,
    dependencies=[Depends(require_admin)],
)
async def get_analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    seller_id: int | None = None,
    db: Session = Depends(get_db),
):
    if not start_date or not end_date:
        end_date = end_date or date.today()
        start_date = start_date or (end_date - timedelta(days=30))
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)
    branch_clause = Sale.branch_id == branch_id if branch_id else None
    seller_clause = Sale.seller_id == seller_id if seller_id else None

    totals_filters = [
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt,
    ]
    if branch_clause is not None:
        totals_filters.append(branch_clause)
    if seller_clause is not None:
        totals_filters.append(seller_clause)

    total_sales, total_credit, total_receipts, total_cash, total_kaspi = db.execute(
        select(
            func.sum(Sale.total_amount),
            func.sum(Sale.paid_debt),
            func.count(Sale.id),
            func.sum(Sale.paid_cash),
            func.sum(Sale.paid_card),
        ).where(*totals_filters)
    ).one()

    returns_query = (
        select(Return)
        .options(
            selectinload(Return.items),
            joinedload(Return.sale),
        )
        .where(Return.created_at >= start_dt, Return.created_at <= end_dt)
    )
    if branch_id:
        returns_query = returns_query.where(Return.branch_id == branch_id)
    if seller_id:
        returns_query = returns_query.where(Return.created_by_id == seller_id)

    return_entries = db.execute(returns_query).scalars().unique().all()
    return_breakdowns = calculate_return_breakdowns(return_entries)
    refunds_total = sum(b.total for b in return_breakdowns.values())
    refunds_cash = sum(b.cash for b in return_breakdowns.values())
    refunds_card = sum(b.card for b in return_breakdowns.values())
    refunds_debt = sum(b.debt for b in return_breakdowns.values())

    debt_filters = [
        DebtPayment.created_at >= start_dt,
        DebtPayment.created_at <= end_dt,
    ]
    if branch_id:
        debt_filters.append(DebtPayment.branch_id == branch_id)
    if seller_id:
        debt_filters.append(DebtPayment.processed_by_id == seller_id)

    debt_cash, debt_card = db.execute(
        select(
            func.coalesce(
                func.sum(
                    case((DebtPayment.payment_type == "cash", DebtPayment.amount), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((DebtPayment.payment_type != "cash", DebtPayment.amount), else_=0)
                ),
                0,
            ),
        ).where(*debt_filters)
    ).one()

    net_total_sales = float(total_sales or 0) - float(refunds_total)
    net_total_sales += float(debt_cash or 0) + float(debt_card or 0)

    net_cash = float(total_cash or 0) - float(refunds_cash) + float(debt_cash or 0)
    net_card = float(total_kaspi or 0) - float(refunds_card) + float(debt_card or 0)

    credit_total = float(total_credit or 0) - float(refunds_debt)

    payment_breakdown = report_schema.PaymentBreakdown(
        cash=net_cash,
        kaspi=net_card,
        credit=credit_total,
    )

    daily_map: dict[date, report_schema.DailyReport] = {}

    sales_by_day_rows = db.execute(
        select(
            func.date(Sale.created_at),
            func.sum(Sale.total_amount),
            func.sum(Sale.paid_debt),
        )
        .where(*totals_filters)
        .group_by(func.date(Sale.created_at))
    ).all()
    for day, total_amount, credit_amount in sales_by_day_rows:
        daily_map.setdefault(day, report_schema.DailyReport(day=day, total_sales=0, total_credit=0))
        entry = daily_map[day]
        entry.total_sales += float(total_amount or 0)
        entry.total_credit += float(credit_amount or 0)

    for entry, breakdown in ((ret, return_breakdowns.get(ret.id)) for ret in return_entries):
        day = entry.created_at.date()
        daily_map.setdefault(day, report_schema.DailyReport(day=day, total_sales=0, total_credit=0))
        refund = breakdown.total if breakdown else sum(item.amount for item in entry.items)
        debt_refund = breakdown.debt if breakdown else 0
        daily_map[day].total_sales -= float(refund or 0)
        daily_map[day].total_credit -= float(debt_refund or 0)

    debt_by_day_rows = db.execute(
        select(
            func.date(DebtPayment.created_at),
            func.sum(DebtPayment.amount),
        )
        .where(*debt_filters)
        .group_by(func.date(DebtPayment.created_at))
    ).all()
    for day, amount in debt_by_day_rows:
        daily_map.setdefault(day, report_schema.DailyReport(day=day, total_sales=0, total_credit=0))
        entry = daily_map[day]
        entry.total_sales += float(amount or 0)

    sales_by_date = list(daily_map.values())
    sales_by_date.sort(key=lambda row: row.day)

    top_products_query = db.execute(
        select(
            Product.id,
            Product.name,
            func.sum(SaleItem.quantity),
            func.sum(SaleItem.quantity * SaleItem.price),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .where(*totals_filters)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.quantity * SaleItem.price).desc())
        .limit(10)
    )
    top_products = [
        report_schema.ProductPerformance(
            product_id=row[0],
            name=row[1],
            quantity=float(row[2] or 0),
            revenue=float(row[3] or 0),
        )
        for row in top_products_query.all()
    ]

    return report_schema.AnalyticsResponse(
        sales_by_date=sales_by_date,
        payment_breakdown=payment_breakdown,
        top_products=top_products,
        total_sales=net_total_sales,
        total_debt=credit_total,
        total_receipts=int(total_receipts or 0),
        refunds_cash=refunds_cash,
        refunds_card=refunds_card,
        refunds_debt=refunds_debt,
        refunds_total=refunds_total,
    )

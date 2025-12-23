from fastapi import APIRouter, Depends
from datetime import date, datetime, time, timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.database.session import get_db
from app.models.entities import Branch, DebtPayment, Product, Return, ReturnItem, Sale, SaleItem, User
from app.schemas import reports as report_schema

router = APIRouter(redirect_slashes=False)


def _apply_date_filters(query, start_date: date | None, end_date: date | None):
    if start_date:
        query = query.where(Sale.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(Sale.created_at <= datetime.combine(end_date, time.max))
    return query


@router.get(
    "/summary",
    response_model=report_schema.ReportsResponse,
    dependencies=[Depends(require_admin)],
)
async def get_summary(
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

    return_query = select(
        Return.id,
        Return.created_at,
        Return.branch_id,
        Return.created_by_id,
        Branch.name,
        User.name,
        func.coalesce(func.sum(ReturnItem.amount), 0),
    ).join(Branch, Return.branch_id == Branch.id).join(User, Return.created_by_id == User.id).join(
        ReturnItem, ReturnItem.return_id == Return.id
    )
    if branch_id:
        return_query = return_query.where(Return.branch_id == branch_id)
    if seller_id:
        return_query = return_query.where(Return.created_by_id == seller_id)
    return_query = return_query.group_by(
        Return.id,
        Return.created_at,
        Return.branch_id,
        Return.created_by_id,
        Branch.name,
        User.name,
    )
    return_query = _apply_date_filters(return_query, start_date, end_date, Return.created_at)
    for row in db.execute(return_query):
        operations.append(
            report_schema.SaleSummary(
                id=row[0],
                entry_type="return",
                created_at=row[1],
                seller=row[5],
                branch=row[4],
                total_amount=-(float(row[6]) if row[6] else 0),
                payment_type="return",
                paid_cash=-(float(row[6]) if row[6] else 0),
                paid_card=0,
                paid_debt=0,
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

    returns_filters = [
        Return.created_at >= start_dt,
        Return.created_at <= end_dt,
    ]
    if branch_id:
        returns_filters.append(Return.branch_id == branch_id)
    if seller_id:
        returns_filters.append(Return.created_by_id == seller_id)

    total_returns = db.execute(
        select(func.coalesce(func.sum(ReturnItem.amount), 0)).select_from(Return).join(ReturnItem).where(
            *returns_filters
        )
    ).scalar_one()

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

    net_total_sales = float(total_sales or 0) - float(total_returns or 0)
    net_total_sales += float(debt_cash or 0) + float(debt_card or 0)

    net_cash = float(total_cash or 0) - float(total_returns or 0) + float(debt_cash or 0)
    net_card = float(total_kaspi or 0) + float(debt_card or 0)

    payment_breakdown = report_schema.PaymentBreakdown(
        cash=net_cash,
        kaspi=net_card,
        credit=float(total_credit or 0),
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

    returns_by_day_rows = db.execute(
        select(
            func.date(Return.created_at),
            func.sum(ReturnItem.amount),
        )
        .join(ReturnItem)
        .where(*returns_filters)
        .group_by(func.date(Return.created_at))
    ).all()
    for day, amount in returns_by_day_rows:
        daily_map.setdefault(day, report_schema.DailyReport(day=day, total_sales=0, total_credit=0))
        entry = daily_map[day]
        entry.total_sales -= float(amount or 0)

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
        total_debt=float(total_credit or 0),
        total_receipts=int(total_receipts or 0),
    )

from fastapi import APIRouter, Depends
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.database.session import get_db
from app.models.entities import Branch, Product, Sale, SaleItem, User
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
    db: Session = Depends(get_db),
):
    branch_clause = Sale.branch_id == branch_id if branch_id else None

    base_query = select(Sale, User.name, Branch.name).join(User).join(Branch)
    if branch_clause is not None:
        base_query = base_query.where(branch_clause)
    sales_result = db.execute(_apply_date_filters(base_query, start_date, end_date))
    sales = []
    for sale, seller_name, branch_name in sales_result.all():
        sales.append(
            report_schema.SaleSummary(
                id=sale.id,
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
    by_day_query = db.execute(
        _apply_date_filters(
            (
                select(
                    func.date(Sale.created_at),
                    func.sum(Sale.total_amount),
                    func.sum(Sale.paid_debt),
                )
                .where(branch_clause)
                if branch_clause is not None
                else select(
                    func.date(Sale.created_at),
                    func.sum(Sale.total_amount),
                    func.sum(Sale.paid_debt),
                )
            ).group_by(func.date(Sale.created_at)),
            start_date,
            end_date,
        )
    )
    by_day = [
        report_schema.DailyReport(day=row[0], total_sales=row[1] or 0, total_credit=row[2] or 0)
        for row in by_day_query.all()
    ]
    by_seller_query = db.execute(
        _apply_date_filters(
            (
                select(User.name, func.sum(Sale.total_amount))
                .join(Sale, Sale.seller_id == User.id)
                .where(branch_clause)
                if branch_clause is not None
                else select(User.name, func.sum(Sale.total_amount)).join(Sale, Sale.seller_id == User.id)
            ).group_by(User.name),
            start_date,
            end_date,
        )
    )
    by_seller = [report_schema.StaffReport(seller=row[0], total=row[1] or 0) for row in by_seller_query.all()]
    by_branch_query = db.execute(
        _apply_date_filters(
            (
                select(Branch.name, func.sum(Sale.total_amount))
                .join(Sale, Sale.branch_id == Branch.id)
                .where(branch_clause)
                if branch_clause is not None
                else select(Branch.name, func.sum(Sale.total_amount)).join(Sale, Sale.branch_id == Branch.id)
            ).group_by(Branch.name),
            start_date,
            end_date,
        )
    )
    by_branch = [report_schema.BranchReport(branch=row[0], total=row[1] or 0) for row in by_branch_query.all()]
    return report_schema.ReportsResponse(sales=sales, by_day=by_day, by_seller=by_seller, by_branch=by_branch)


@router.get(
    "/analytics",
    response_model=report_schema.AnalyticsResponse,
    dependencies=[Depends(require_admin)],
)
async def get_analytics(
    start_date: date | None = None,
    end_date: date | None = None,
    branch_id: int | None = None,
    db: Session = Depends(get_db),
):
    if not start_date or not end_date:
        end_date = end_date or date.today()
        start_date = start_date or (end_date - timedelta(days=30))
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)
    branch_clause = Sale.branch_id == branch_id if branch_id else None
    totals_query = db.execute(
        select(
            func.sum(Sale.total_amount),
            func.sum(Sale.paid_debt),
            func.count(Sale.id),
            func.sum(Sale.paid_cash),
            func.sum(Sale.paid_card),
        ).where(
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt,
            *( [branch_clause] if branch_clause is not None else [] ),
        )
    )
    total_sales, total_credit, total_receipts, total_cash, total_kaspi = totals_query.one()
    payment_breakdown = report_schema.PaymentBreakdown(
        cash=float(total_cash or 0), kaspi=float(total_kaspi or 0), credit=float(total_credit or 0)
    )
    sales_by_day_query = db.execute(
        select(
            func.date(Sale.created_at),
            func.sum(Sale.total_amount),
            func.sum(Sale.paid_debt),
            func.count(Sale.id),
        )
        .where(
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt,
            *( [branch_clause] if branch_clause is not None else [] ),
        )
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
    )
    sales_by_date = [
        report_schema.DailyReport(day=row[0], total_sales=row[1] or 0, total_credit=row[2] or 0)
        for row in sales_by_day_query.all()
    ]
    top_products_query = db.execute(
        select(
            Product.id,
            Product.name,
            func.sum(SaleItem.quantity),
            func.sum(SaleItem.quantity * SaleItem.price),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .where(
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt,
            *( [branch_clause] if branch_clause is not None else [] ),
        )
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
        total_sales=float(total_sales or 0),
        total_debt=float(total_credit or 0),
        total_receipts=int(total_receipts or 0),
    )

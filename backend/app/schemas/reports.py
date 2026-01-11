from datetime import date, datetime
from typing import List

from pydantic import BaseModel


class SaleSummary(BaseModel):
    id: int
    entry_type: str = "sale"
    created_at: datetime
    seller: str
    branch: str
    total_amount: float
    payment_type: str
    paid_cash: float
    paid_card: float
    paid_debt: float


class DailyReport(BaseModel):
    day: date
    total_sales: float
    total_credit: float


class StaffReport(BaseModel):
    seller: str
    total: float


class BranchReport(BaseModel):
    branch: str
    total: float


class ReportsResponse(BaseModel):
    sales: List[SaleSummary]
    by_day: List[DailyReport]
    by_seller: List[StaffReport]
    by_branch: List[BranchReport]


class PaymentBreakdown(BaseModel):
    cash: float
    kaspi: float
    credit: float


class ProductPerformance(BaseModel):
    product_id: int
    name: str
    quantity: float
    revenue: float


class AnalyticsResponse(BaseModel):
    sales_by_date: List[DailyReport]
    payment_breakdown: PaymentBreakdown
    top_products: List[ProductPerformance]
    total_sales: float
    total_debt: float
    total_receipts: int
    refunds_total: float
    refunds_cash: float
    refunds_card: float
    refunds_debt: float


class SummaryResponse(BaseModel):
    start_date: date
    end_date: date
    cash_total: float
    card_total: float
    debt_payments_total: float
    returns_total: float
    new_debts_total: float
    cashbox_total: float
    debts_created_amount: float
    debt_payments_amount: float
    refunds_total: float
    sales_total: float
    grand_total: float
    total_debt_all_clients: float


class ProfitReportResponse(BaseModel):
    month: str
    sales_total: float
    cogs_total: float
    expenses_total: float
    profit: float

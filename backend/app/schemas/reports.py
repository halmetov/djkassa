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

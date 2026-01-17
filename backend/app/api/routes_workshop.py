from __future__ import annotations

from datetime import datetime, date
import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth.security import get_current_user, require_production_access, require_workshop_only
from app.database.session import get_db
from app.models import (
    Branch,
    Income,
    Expense,
    IncomeItem,
    Product,
    Stock,
    User,
    WorkshopEmployee,
    WorkshopOrder,
    WorkshopOrderClosure,
    WorkshopOrderMaterial,
    WorkshopOrderPayout,
    WorkshopSalaryTransaction,
)
from app.schemas import branches as branch_schema
from app.schemas import workshop as workshop_schema
from app.services.files import save_upload
from app.services.inventory import adjust_stock
from app.services.workshop import get_workshop_branch_id

router = APIRouter(prefix="/api/workshop", dependencies=[Depends(require_workshop_only)])
logger = logging.getLogger(__name__)


def _get_workshop_branch(db: Session) -> Branch:
    branch_id = get_workshop_branch_id(db)
    branch = db.get(Branch, branch_id)
    if branch:
        return branch
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Workshop branch not found",
    )


def _parse_month(month: Optional[str]) -> tuple[datetime, datetime, str]:
    if month:
        try:
            start = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month format") from exc
    else:
        today = datetime.utcnow()
        start = datetime(today.year, today.month, 1)
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    return start, end, start.strftime("%Y-%m")


@router.get("/branch", response_model=branch_schema.Branch)
def get_workshop_branch(db: Session = Depends(get_db)) -> Branch:
    return _get_workshop_branch(db)


@router.get("/expenses", response_model=list[workshop_schema.WorkshopExpenseOut])
def list_workshop_expenses(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    branch_id = get_workshop_branch_id(db)
    query = (
        db.query(Expense)
        .options(joinedload(Expense.created_by))
        .filter(Expense.branch_id == branch_id)
    )
    if start_date:
        query = query.filter(Expense.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Expense.created_at <= datetime.combine(end_date, datetime.max.time()))
    expenses = query.order_by(Expense.created_at.desc()).all()
    results: list[workshop_schema.WorkshopExpenseOut] = []
    for expense in expenses:
        validated = workshop_schema.WorkshopExpenseOut.model_validate(expense, from_attributes=True)
        results.append(
            validated.model_copy(
                update={"created_by_name": expense.created_by.name if expense.created_by else None}
            )
        )
    return results


@router.post(
    "/expenses",
    response_model=workshop_schema.WorkshopExpenseOut,
    status_code=status.HTTP_201_CREATED,
)
def create_workshop_expense(
    payload: workshop_schema.WorkshopExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    branch_id = get_workshop_branch_id(db)
    expense = Expense(
        title=payload.title.strip(),
        amount=Decimal(str(payload.amount)),
        created_by_id=current_user.id,
        branch_id=branch_id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    validated = workshop_schema.WorkshopExpenseOut.model_validate(expense, from_attributes=True)
    return validated.model_copy(update={"created_by_name": current_user.name})


@router.get("/employees", response_model=list[workshop_schema.WorkshopEmployeeOut])
def list_employees(
    request: Request,
    search: Optional[str] = Query(None, alias="q"),
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log_request(request, current_user)
    query = db.query(WorkshopEmployee)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (WorkshopEmployee.first_name.ilike(term))
            | (WorkshopEmployee.last_name.ilike(term))
            | (WorkshopEmployee.phone.ilike(term))
            | (WorkshopEmployee.position.ilike(term))
        )
    return query.order_by(WorkshopEmployee.id.desc()).limit(limit).all()


@router.post("/employees", response_model=workshop_schema.WorkshopEmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(payload: workshop_schema.WorkshopEmployeeCreate, db: Session = Depends(get_db)):
    employee = WorkshopEmployee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.put("/employees/{employee_id}", response_model=workshop_schema.WorkshopEmployeeOut)
def update_employee(employee_id: int, payload: workshop_schema.WorkshopEmployeeUpdate, db: Session = Depends(get_db)):
    employee = db.get(WorkshopEmployee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = db.get(WorkshopEmployee, employee_id)
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    db.delete(employee)
    db.commit()
    return None


@router.get("/employees/search", response_model=list[workshop_schema.WorkshopEmployeeSearchOut])
def search_employees(
    request: Request,
    q: Optional[str] = Query(None, alias="q"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log_request(request, current_user)
    query = db.query(WorkshopEmployee).filter(WorkshopEmployee.active.is_(True))
    if q:
        term = f"%{q}%"
        query = query.filter(
            (WorkshopEmployee.first_name.ilike(term))
            | (WorkshopEmployee.last_name.ilike(term))
            | (WorkshopEmployee.phone.ilike(term))
            | (WorkshopEmployee.position.ilike(term))
        )
    employees = query.order_by(WorkshopEmployee.id.desc()).limit(limit).all()
    results: list[workshop_schema.WorkshopEmployeeSearchOut] = []
    for employee in employees:
        full_name = " ".join(filter(None, [employee.first_name, employee.last_name]))
        results.append(
            workshop_schema.WorkshopEmployeeSearchOut(
                id=employee.id,
                full_name=full_name.strip() or employee.first_name,
                phone=employee.phone,
                salary_total=employee.total_salary,
                position=employee.position,
            )
        )
    return results


@router.get("/orders", response_model=list[workshop_schema.WorkshopOrderOut])
def list_orders(db: Session = Depends(get_db)):
    branch = _get_workshop_branch(db)
    return (
        db.query(WorkshopOrder)
        .filter(WorkshopOrder.branch_id == branch.id)
        .order_by(WorkshopOrder.created_at.desc())
        .all()
    )


@router.post("/orders", response_model=workshop_schema.WorkshopOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: workshop_schema.WorkshopOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    branch = _get_workshop_branch(db)
    order = WorkshopOrder(
        title=payload.title,
        amount=payload.amount or Decimal("0"),
        customer_name=payload.customer_name,
        description=payload.description,
        created_by_user_id=current_user.id,
        branch_id=branch.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def _get_order(db: Session, order_id: int) -> WorkshopOrder:
    order = db.get(WorkshopOrder, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Заказ не найден")
    return order


def _serialize_order_detail(order: WorkshopOrder, db: Session) -> workshop_schema.WorkshopOrderDetail:
    db.refresh(order, attribute_names=["materials", "payouts"])
    material_rows: list[workshop_schema.WorkshopOrderMaterialDetail] = []
    for material in order.materials:
        product = db.get(Product, material.product_id)
        material_rows.append(
            workshop_schema.WorkshopOrderMaterialDetail(
                id=material.id,
                product_id=material.product_id,
                quantity=material.quantity,
                unit=material.unit,
                created_at=material.created_at,
                product_name=product.name if product else "",
                product_barcode=product.barcode if product else None,
            )
        )
    payout_rows: list[workshop_schema.WorkshopOrderPayoutDetail] = []
    for payout in order.payouts:
        employee = db.get(WorkshopEmployee, payout.employee_id)
        full_name = " ".join(
            filter(None, [employee.first_name if employee else None, employee.last_name if employee else None])
        ).strip()
        payout_rows.append(
            workshop_schema.WorkshopOrderPayoutDetail(
                id=payout.id,
                employee_id=payout.employee_id,
                amount=payout.amount,
                note=payout.note,
                created_at=payout.created_at,
                employee_name=full_name or (employee.first_name if employee else ""),
                employee_phone=employee.phone if employee else None,
                employee_position=employee.position if employee else None,
            )
        )
    return workshop_schema.WorkshopOrderDetail(
        id=order.id,
        title=order.title,
        amount=order.amount,
        customer_name=order.customer_name,
        description=order.description,
        status=order.status,
        created_at=order.created_at,
        updated_at=order.updated_at,
        closed_at=order.closed_at,
        branch_id=order.branch_id,
        photo=order.photo,
        paid_amount=order.paid_amount,
        materials=material_rows,
        payouts=payout_rows,
    )


def _assert_order_open(order: WorkshopOrder) -> None:
    if order.status == "closed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is closed")


@router.get("/orders/{order_id}", response_model=workshop_schema.WorkshopOrderDetail)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    return _serialize_order_detail(order, db)


@router.put("/orders/{order_id}", response_model=workshop_schema.WorkshopOrderOut)
def update_order(order_id: int, payload: workshop_schema.WorkshopOrderUpdate, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    _assert_order_open(order)
    if payload.status == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Use close endpoint to close order")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    db.delete(order)
    db.commit()
    return None


@router.post("/orders/{order_id}/photo", response_model=workshop_schema.WorkshopOrderOut)
async def upload_order_photo(
    order_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    order = _get_order(db, order_id)
    _assert_order_open(order)
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл не передан")
    if file.content_type is None or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Разрешена только загрузка изображений")

    photo_name = await save_upload(file, subdir="workshop_orders")
    public_url = f"{str(request.base_url).rstrip('/')}/static/{photo_name}"
    order.photo = public_url
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/materials", response_model=workshop_schema.WorkshopMaterialOut, status_code=status.HTTP_201_CREATED)
def add_material(order_id: int, payload: workshop_schema.WorkshopMaterialCreate, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    _assert_order_open(order)
    workshop_branch = _get_workshop_branch(db)
    if order.branch_id != workshop_branch.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Можно списывать только со склада цеха")
    if payload.quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be positive")
    stock = (
        db.query(Stock)
        .filter(Stock.branch_id == workshop_branch.id, Stock.product_id == payload.product_id)
        .with_for_update()
        .first()
    )
    if not stock or stock.quantity < float(payload.quantity):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недостаточно остатков на складе")
    stock.quantity = stock.quantity - float(payload.quantity)
    material = WorkshopOrderMaterial(
        order_id=order.id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit=payload.unit,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/orders/{order_id}/materials", response_model=list[workshop_schema.WorkshopMaterialOut])
def list_materials(order_id: int, db: Session = Depends(get_db)):
    _get_order(db, order_id)
    return (
        db.query(WorkshopOrderMaterial)
        .filter(WorkshopOrderMaterial.order_id == order_id)
        .order_by(WorkshopOrderMaterial.created_at.desc())
        .all()
    )


@router.post("/orders/{order_id}/payouts", response_model=workshop_schema.WorkshopPayoutOut, status_code=status.HTTP_201_CREATED)
def add_payout(order_id: int, payload: workshop_schema.WorkshopPayoutCreate, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    _assert_order_open(order)
    employee = db.get(WorkshopEmployee, payload.employee_id)
    if not employee or not employee.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сотрудник не найден")
    payout = WorkshopOrderPayout(order_id=order.id, employee_id=employee.id, amount=payload.amount, note=payload.note)
    employee.total_salary = (employee.total_salary or Decimal("0")) + payload.amount
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return payout


@router.get("/orders/{order_id}/payouts", response_model=list[workshop_schema.WorkshopPayoutOut])
def list_payouts(order_id: int, db: Session = Depends(get_db)):
    _get_order(db, order_id)
    return (
        db.query(WorkshopOrderPayout)
        .filter(WorkshopOrderPayout.order_id == order_id)
        .order_by(WorkshopOrderPayout.created_at.desc())
        .all()
    )


@router.post("/orders/{order_id}/close", response_model=workshop_schema.WorkshopClosureOut)
def close_order(
    order_id: int,
    payload: workshop_schema.WorkshopClosePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = _get_order(db, order_id)
    if payload.paid_amount < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="paid_amount must be non-negative")
    if order.status == "closed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is closed")
    now = datetime.utcnow()
    order.status = "closed"
    order.closed_at = now
    order.paid_amount = payload.paid_amount
    closure = WorkshopOrderClosure(
        order_id=order.id,
        order_amount=order.amount or Decimal("0"),
        paid_amount=payload.paid_amount,
        note=payload.note,
        closed_at=now,
        closed_by_user_id=current_user.id,
    )
    db.add(closure)
    db.commit()
    db.refresh(closure)
    return closure


@router.get("/income/products", response_model=list[workshop_schema.WorkshopIncomeProduct])
def workshop_income_products(
    search: Optional[str] = Query(None, alias="q"), db: Session = Depends(get_db)
):
    query = db.query(Product)
    if search:
        term = f"%{search}%"
        query = query.filter((Product.name.ilike(term)) | (Product.barcode.ilike(term)))
    products = query.order_by(Product.name.asc()).limit(50).all()
    return [
        workshop_schema.WorkshopIncomeProduct(
            id=product.id,
            name=product.name,
            unit=product.unit,
            barcode=product.barcode,
            photo=product.photo or product.image_url,
            purchase_price=product.purchase_price,
            sale_price=product.sale_price,
        )
        for product in products
    ]


@router.post(
    "/income",
    response_model=workshop_schema.WorkshopIncomeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workshop_income(
    payload: workshop_schema.WorkshopIncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    branch = _get_workshop_branch(db)
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет товаров для прихода")
    income = Income(branch_id=branch.id, created_by_id=current_user.id)
    db.add(income)
    db.flush()
    stock_updates: list[workshop_schema.WorkshopIncomeStock] = []
    for item in payload.items:
        if item.quantity <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be positive")
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item.product_id} not found",
            )
        income_item = IncomeItem(
            income_id=income.id,
            product_id=item.product_id,
            quantity=item.quantity,
            purchase_price=item.purchase_price,
            sale_price=item.sale_price,
        )
        db.add(income_item)
        product.quantity += item.quantity
        product.purchase_price = item.purchase_price
        product.sale_price = item.sale_price
        stock = adjust_stock(db, branch.id, item.product_id, item.quantity)
        stock_updates.append(
            workshop_schema.WorkshopIncomeStock(
                product_id=item.product_id, branch_id=branch.id, quantity=stock.quantity
            )
        )
    db.commit()
    db.refresh(income)
    db.refresh(income, attribute_names=["items"])
    return workshop_schema.WorkshopIncomeResponse(income=income, stock=stock_updates)


@router.get("/report", response_model=list[workshop_schema.WorkshopClosureOut])
def report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(WorkshopOrderClosure)
    if start_date:
        query = query.filter(WorkshopOrderClosure.closed_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(WorkshopOrderClosure.closed_at <= datetime.combine(end_date, datetime.max.time()))
    return query.order_by(WorkshopOrderClosure.closed_at.desc()).all()


@router.get("/reports/summary", response_model=workshop_schema.WorkshopReportSummaryOut)
def workshop_report_summary(
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    start, end, month_label = _parse_month(month)
    branch_id = get_workshop_branch_id(db)
    orders_total = (
        db.query(func.coalesce(func.sum(WorkshopOrder.amount), 0))
        .filter(
            WorkshopOrder.branch_id == branch_id,
            WorkshopOrder.created_at >= start,
            WorkshopOrder.created_at < end,
        )
        .scalar()
        or 0
    )
    materials_cogs = (
        db.query(func.coalesce(func.sum(WorkshopOrderMaterial.quantity * Product.purchase_price), 0))
        .join(WorkshopOrder, WorkshopOrder.id == WorkshopOrderMaterial.order_id)
        .join(Product, Product.id == WorkshopOrderMaterial.product_id)
        .filter(
            WorkshopOrder.branch_id == branch_id,
            WorkshopOrder.created_at >= start,
            WorkshopOrder.created_at < end,
        )
        .scalar()
        or 0
    )
    expenses_total = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.branch_id == branch_id,
            Expense.created_at >= start,
            Expense.created_at < end,
        )
        .scalar()
        or 0
    )
    salary_payout_total = (
        db.query(func.coalesce(func.sum(WorkshopSalaryTransaction.amount), 0))
        .filter(
            WorkshopSalaryTransaction.type == "payout",
            WorkshopSalaryTransaction.created_at >= start,
            WorkshopSalaryTransaction.created_at < end,
        )
        .scalar()
        or 0
    )
    salary_bonus_total = (
        db.query(func.coalesce(func.sum(WorkshopSalaryTransaction.amount), 0))
        .filter(
            WorkshopSalaryTransaction.type == "bonus",
            WorkshopSalaryTransaction.created_at >= start,
            WorkshopSalaryTransaction.created_at < end,
        )
        .scalar()
        or 0
    )
    orders_total = Decimal(str(orders_total))
    materials_cogs = Decimal(str(materials_cogs))
    expenses_total = Decimal(str(expenses_total))
    salary_payout_total = Decimal(str(salary_payout_total))
    salary_bonus_total = Decimal(str(salary_bonus_total))
    salary_total = salary_payout_total + salary_bonus_total
    orders_margin = orders_total - materials_cogs
    net_profit = orders_margin - (expenses_total + salary_total)

    return workshop_schema.WorkshopReportSummaryOut(
        month=month_label,
        orders_total=orders_total,
        materials_cogs=materials_cogs,
        orders_margin=orders_margin,
        expenses_total=expenses_total,
        salary_payout_total=salary_payout_total,
        salary_bonus_total=salary_bonus_total,
        salary_total=salary_total,
        net_profit=net_profit,
    )


@router.get("/salary/summary", response_model=list[workshop_schema.WorkshopSalarySummaryItem])
def workshop_salary_summary(
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_production_access),
):
    start, end, _ = _parse_month(month)
    employees = db.query(WorkshopEmployee).order_by(WorkshopEmployee.id.asc()).all()
    order_payouts = dict(
        db.query(
            WorkshopOrderPayout.employee_id,
            func.coalesce(func.sum(WorkshopOrderPayout.amount), 0),
        )
        .filter(WorkshopOrderPayout.created_at >= start, WorkshopOrderPayout.created_at < end)
        .group_by(WorkshopOrderPayout.employee_id)
        .all()
    )
    payout_transactions = dict(
        db.query(
            WorkshopSalaryTransaction.employee_id,
            func.coalesce(func.sum(WorkshopSalaryTransaction.amount), 0),
        )
        .filter(
            WorkshopSalaryTransaction.type == "payout",
            WorkshopSalaryTransaction.created_at >= start,
            WorkshopSalaryTransaction.created_at < end,
        )
        .group_by(WorkshopSalaryTransaction.employee_id)
        .all()
    )
    bonus_transactions = dict(
        db.query(
            WorkshopSalaryTransaction.employee_id,
            func.coalesce(func.sum(WorkshopSalaryTransaction.amount), 0),
        )
        .filter(
            WorkshopSalaryTransaction.type == "bonus",
            WorkshopSalaryTransaction.created_at >= start,
            WorkshopSalaryTransaction.created_at < end,
        )
        .group_by(WorkshopSalaryTransaction.employee_id)
        .all()
    )

    results: list[workshop_schema.WorkshopSalarySummaryItem] = []
    for employee in employees:
        full_name = " ".join(filter(None, [employee.first_name, employee.last_name])).strip() or employee.first_name
        accrued = Decimal(str(order_payouts.get(employee.id, 0)))
        payout = Decimal(str(payout_transactions.get(employee.id, 0)))
        bonus = Decimal(str(bonus_transactions.get(employee.id, 0)))
        balance = accrued + bonus - payout
        results.append(
            workshop_schema.WorkshopSalarySummaryItem(
                employee_id=employee.id,
                full_name=full_name,
                position=employee.position,
                accrued=accrued,
                payout=payout,
                bonus=bonus,
                balance=balance,
            )
        )
    return results


@router.post("/salary/payout", status_code=status.HTTP_201_CREATED)
def create_salary_payout(
    payload: workshop_schema.WorkshopSalaryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_production_access),
):
    employee = db.get(WorkshopEmployee, payload.employee_id)
    if not employee or not employee.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сотрудник не найден")
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    created_at = datetime.utcnow()
    if payload.date:
        created_at = datetime.combine(payload.date, datetime.min.time())
    transaction = WorkshopSalaryTransaction(
        employee_id=employee.id,
        type="payout",
        amount=payload.amount,
        note=payload.note,
        created_by_id=current_user.id,
        created_at=created_at,
    )
    db.add(transaction)
    db.commit()
    return {"status": "ok"}


@router.post("/salary/bonus", status_code=status.HTTP_201_CREATED)
def create_salary_bonus(
    payload: workshop_schema.WorkshopSalaryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_production_access),
):
    employee = db.get(WorkshopEmployee, payload.employee_id)
    if not employee or not employee.active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Сотрудник не найден")
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive")
    created_at = datetime.utcnow()
    if payload.date:
        created_at = datetime.combine(payload.date, datetime.min.time())
    transaction = WorkshopSalaryTransaction(
        employee_id=employee.id,
        type="bonus",
        amount=payload.amount,
        note=payload.note,
        created_by_id=current_user.id,
        created_at=created_at,
    )
    db.add(transaction)
    db.commit()
    return {"status": "ok"}


@router.get("/salary/history", response_model=list[workshop_schema.WorkshopSalaryHistoryItem])
def workshop_salary_history(
    month: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_production_access),
):
    start, end, _ = _parse_month(month)
    payouts_query = (
        db.query(WorkshopOrderPayout, WorkshopOrder, WorkshopEmployee)
        .join(WorkshopOrder, WorkshopOrder.id == WorkshopOrderPayout.order_id)
        .join(WorkshopEmployee, WorkshopEmployee.id == WorkshopOrderPayout.employee_id)
        .filter(WorkshopOrderPayout.created_at >= start, WorkshopOrderPayout.created_at < end)
    )
    if employee_id:
        payouts_query = payouts_query.filter(WorkshopOrderPayout.employee_id == employee_id)
    payouts = payouts_query.all()

    transactions_query = (
        db.query(WorkshopSalaryTransaction, WorkshopEmployee, User)
        .join(WorkshopEmployee, WorkshopEmployee.id == WorkshopSalaryTransaction.employee_id)
        .outerjoin(User, User.id == WorkshopSalaryTransaction.created_by_id)
        .filter(WorkshopSalaryTransaction.created_at >= start, WorkshopSalaryTransaction.created_at < end)
    )
    if employee_id:
        transactions_query = transactions_query.filter(WorkshopSalaryTransaction.employee_id == employee_id)
    transactions = transactions_query.all()

    items: list[workshop_schema.WorkshopSalaryHistoryItem] = []
    for payout, order, employee in payouts:
        full_name = " ".join(filter(None, [employee.first_name, employee.last_name])).strip() or employee.first_name
        creator_name = order.created_by_user.name if order.created_by_user else None
        items.append(
            workshop_schema.WorkshopSalaryHistoryItem(
                id=f"accrual-{payout.id}",
                date=payout.created_at,
                employee_name=full_name,
                type="accrual",
                amount=payout.amount,
                note=payout.note,
                order_id=order.id,
                created_by_name=creator_name,
            )
        )

    for transaction, employee, creator in transactions:
        full_name = " ".join(filter(None, [employee.first_name, employee.last_name])).strip() or employee.first_name
        items.append(
            workshop_schema.WorkshopSalaryHistoryItem(
                id=f"{transaction.type}-{transaction.id}",
                date=transaction.created_at,
                employee_name=full_name,
                type=transaction.type or "",
                amount=transaction.amount or Decimal("0"),
                note=transaction.note,
                order_id=None,
                created_by_name=creator.name if creator else None,
            )
        )

    items.sort(key=lambda item: item.date or datetime.min, reverse=True)
    return items


def _log_request(request: Request, current_user: User | None) -> None:
    trace_id = getattr(request.state, "trace_id", None)
    logger.info(
        "[workshop] %s %s | query=%s | origin=%s | user_id=%s | trace_id=%s",
        request.method,
        request.url.path,
        request.url.query,
        request.headers.get("origin"),
        current_user.id if current_user else None,
        trace_id,
    )


def _get_workshop_stock(
    search: Optional[str],
    limit: int,
    db: Session,
) -> list[workshop_schema.WorkshopStockProduct]:
    branch = _get_workshop_branch(db)
    query = (
        db.query(Stock)
        .join(Product, Stock.product_id == Product.id)
        .filter(Stock.branch_id == branch.id, Stock.quantity > 0)
    )
    if search:
        term = f"%{search}%"
        query = query.filter((Product.name.ilike(term)) | (Product.barcode.ilike(term)))
    stock_rows = query.order_by(Product.name.asc()).limit(limit).all()

    items: list[workshop_schema.WorkshopStockProduct] = []
    for stock in stock_rows:
        product = stock.product
        if not product:
            continue
        validated = workshop_schema.WorkshopStockProduct.model_validate(
            {
                "id": product.id,
                "product_id": product.id,
                "name": product.name,
                "barcode": product.barcode,
                "unit": product.unit,
                "quantity": stock.quantity,
                "available_qty": stock.quantity,
                "photo": product.photo,
                "image_url": product.image_url,
            },
            from_attributes=True,
        )
        items.append(validated)
    return items


@router.get("/stock/products", response_model=list[workshop_schema.WorkshopStockProduct])
def workshop_stock_products(
    request: Request,
    search: Optional[str] = Query(None, alias="q"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log_request(request, current_user)
    return _get_workshop_stock(search, limit, db)


@router.get("/products", response_model=list[workshop_schema.WorkshopStockProduct])
def workshop_products(
    request: Request,
    search: Optional[str] = Query(None, alias="q"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log_request(request, current_user)
    return _get_workshop_stock(search, limit, db)


@router.get("/stock", response_model=list[workshop_schema.WorkshopStockProduct])
def workshop_stock(
    request: Request,
    search: Optional[str] = Query(None, alias="q"),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _log_request(request, current_user)
    return _get_workshop_stock(search, limit, db)

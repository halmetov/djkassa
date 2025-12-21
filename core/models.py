from __future__ import annotations

from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint
from django.utils import timezone


# -----------------------------
# Справочники
# -----------------------------

class Branch(models.Model):
    """Филиал/точка (магазин/склад/цех). Можно использовать и для 'Главный склад'."""
    name = models.CharField(max_length=150, unique=True)
    address = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=150, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Role(models.Model):
    """Роли: admin / manager / employee (можно расширять)."""
    code = models.CharField(max_length=50, unique=True)  # admin, manager, employee
    name = models.CharField(max_length=100)

    def __str__(self) -> str:
        return self.name


class Employee(models.Model):
    """Сотрудник (профиль вокруг auth.User)."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee")
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="employees")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="employees")
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.user} ({self.role.code})"


class Customer(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True)
    note = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return self.name


# -----------------------------
# Товары и остатки
# -----------------------------

class Product(models.Model):
    UNIT_CHOICES = (
        ("pcs", "шт"),
        ("kg", "кг"),
        ("m", "м"),
        ("m2", "м²"),
        ("l", "л"),
    )

    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=80, blank=True, db_index=True)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="pcs")

    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["category", "name"], name="uniq_product_in_category"),
        ]

    def __str__(self) -> str:
        return self.name


class Stock(models.Model):
    """Остаток товара по филиалу."""
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="stocks")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stocks")
    qty = models.DecimalField(max_digits=14, decimal_places=3, default=Decimal("0.000"))

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            UniqueConstraint(fields=["branch", "product"], name="uniq_stock_branch_product"),
        ]

    def __str__(self) -> str:
        return f"{self.branch}: {self.product} = {self.qty}"


# -----------------------------
# Движения склада (приход/расход/перемещение/инвентаризация)
# -----------------------------

class StockMove(models.Model):
    TYPE_CHOICES = (
        ("in", "Приход"),
        ("out", "Расход"),
        ("transfer", "Перемещение"),
        ("adjust", "Корректировка"),
        ("return", "Возврат"),
    )
    STATUS_CHOICES = (
        ("draft", "Черновик"),
        ("posted", "Проведен"),
        ("canceled", "Отменен"),
    )

    move_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    from_branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, null=True, blank=True, related_name="moves_out"
    )
    to_branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, null=True, blank=True, related_name="moves_in"
    )

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_moves")
    created_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return f"{self.get_move_type_display()} #{self.id} ({self.status})"


class StockMoveItem(models.Model):
    move = models.ForeignKey(StockMove, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="move_items")
    qty = models.DecimalField(max_digits=14, decimal_places=3)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))  # цена учета/себестоимость

    def __str__(self) -> str:
        return f"{self.product} x {self.qty}"


# -----------------------------
# Заказы / продажи
# -----------------------------

class Order(models.Model):
    STATUS_CHOICES = (
        ("new", "Новый"),
        ("in_progress", "В работе"),
        ("ready", "Готов"),
        ("delivered", "Доставлен/Выдан"),
        ("canceled", "Отменен"),
    )
    PAYMENT_STATUS = (
        ("unpaid", "Не оплачен"),
        ("partial", "Частично"),
        ("paid", "Оплачен"),
        ("debt", "Долг"),
    )

    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="orders")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, null=True, blank=True, related_name="orders")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders_created")
    created_at = models.DateTimeField(default=timezone.now)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default="unpaid")

    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    manual_extra = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"),
        help_text="Ручная сумма (например доставка/наценка) для отчета"
    )

    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    debt_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    note = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return f"Заказ #{self.id}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")

    qty = models.DecimalField(max_digits=14, decimal_places=3)
    price = models.DecimalField(max_digits=12, decimal_places=2)  # цена продажи на момент заказа
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    def __str__(self) -> str:
        return f"{self.product} x {self.qty}"


class Payment(models.Model):
    METHOD_CHOICES = (
        ("cash", "Наличные"),
        ("card", "Карта"),
        ("transfer", "Перевод"),
        ("mixed", "Смешанная"),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payments")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    created_at = models.DateTimeField(default=timezone.now)

    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="cash")
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self) -> str:
        return f"Оплата #{self.id} {self.amount}"


# -----------------------------
# Долги клиента (отдельно от Order.debt_amount)
# -----------------------------

class CustomerDebt(models.Model):
    """Отдельная таблица долгов для гибкости."""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="debts")
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="customer_debt")

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Долг {self.customer} #{self.id} {self.amount}"


class DebtPayment(models.Model):
    debt = models.ForeignKey(CustomerDebt, on_delete=models.CASCADE, related_name="payments")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="debt_payments")
    created_at = models.DateTimeField(default=timezone.now)

    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self) -> str:
        return f"Погашение #{self.id} {self.amount}"

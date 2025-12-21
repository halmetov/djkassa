from django.contrib import admin
from django.db.models import Sum

from .models import (
    Branch, Category, Role, Employee, Customer,
    Product, Stock,
    StockMove, StockMoveItem,
    Order, OrderItem,
    Payment,
    CustomerDebt, DebtPayment,
)


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active", "address")
    list_filter = ("is_active",)
    search_fields = ("name", "address")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name")
    search_fields = ("code", "name")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role", "branch", "phone", "is_active")
    list_filter = ("role", "branch", "is_active")
    search_fields = ("user__username", "user__email", "user__first_name", "user__last_name", "phone")
    autocomplete_fields = ("user", "role", "branch")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "note")
    search_fields = ("name", "phone")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "unit", "purchase_price", "sale_price", "sku", "is_active")
    list_filter = ("category", "unit", "is_active")
    search_fields = ("name", "sku")
    autocomplete_fields = ("category",)
    list_editable = ("sale_price", "is_active")


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("id", "branch", "product", "qty", "updated_at")
    list_filter = ("branch", "product__category")
    search_fields = ("product__name", "product__sku", "branch__name")
    autocomplete_fields = ("branch", "product")


# -----------------------------
# StockMove (движения)
# -----------------------------

class StockMoveItemInline(admin.TabularInline):
    model = StockMoveItem
    extra = 0
    autocomplete_fields = ("product",)
    fields = ("product", "qty", "price")


@admin.register(StockMove)
class StockMoveAdmin(admin.ModelAdmin):
    list_display = ("id", "move_type", "status", "from_branch", "to_branch", "created_by", "created_at", "items_count")
    list_filter = ("move_type", "status", "from_branch", "to_branch", "created_at")
    search_fields = ("id", "note", "created_by__username", "from_branch__name", "to_branch__name")
    autocomplete_fields = ("from_branch", "to_branch", "created_by")
    date_hierarchy = "created_at"
    inlines = [StockMoveItemInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related("items")

    @admin.display(description="Позиций")
    def items_count(self, obj: StockMove):
        return obj.items.count()


@admin.register(StockMoveItem)
class StockMoveItemAdmin(admin.ModelAdmin):
    list_display = ("id", "move", "product", "qty", "price")
    list_filter = ("move__move_type", "move__status")
    search_fields = ("product__name", "product__sku", "move__id")
    autocomplete_fields = ("move", "product")


# -----------------------------
# Orders (заказы)
# -----------------------------

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    autocomplete_fields = ("product",)
    fields = ("product", "qty", "price", "line_total")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ("method", "amount", "created_by", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("created_by",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id", "branch", "customer", "status", "payment_status",
        "total", "paid_amount", "debt_amount", "created_by", "created_at",
        "items_count"
    )
    list_filter = ("branch", "status", "payment_status", "created_at")
    search_fields = ("id", "customer__name", "customer__phone", "note", "created_by__username")
    autocomplete_fields = ("branch", "customer", "created_by")
    date_hierarchy = "created_at"
    inlines = [OrderItemInline, PaymentInline]

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related("items", "payments")

    @admin.display(description="Позиций")
    def items_count(self, obj: Order):
        return obj.items.count()


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "qty", "price", "line_total")
    list_filter = ("order__branch", "order__status")
    search_fields = ("order__id", "product__name", "product__sku")
    autocomplete_fields = ("order", "product")


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "method", "amount", "created_by", "created_at")
    list_filter = ("method", "created_at")
    search_fields = ("order__id", "created_by__username")
    autocomplete_fields = ("order", "created_by")
    date_hierarchy = "created_at"


# -----------------------------
# Debts (долги)
# -----------------------------

class DebtPaymentInline(admin.TabularInline):
    model = DebtPayment
    extra = 0
    fields = ("amount", "created_by", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("created_by",)

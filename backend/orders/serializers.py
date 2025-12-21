from rest_framework import serializers
from core.models import Customer, Order, OrderItem, Payment, CustomerDebt, DebtPayment, Branch, Product
from users.serializers import BranchSerializer
from warehouse.serializers import ProductSerializer


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "note"]


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), write_only=True, source="product")

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_id", "qty", "price", "line_total"]
        read_only_fields = ["line_total"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    branch = BranchSerializer(read_only=True)
    branch_id = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), write_only=True, source="branch")
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=Customer.objects.all(), write_only=True, allow_null=True, required=False, source="customer"
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "branch",
            "branch_id",
            "customer",
            "customer_id",
            "created_by",
            "created_at",
            "status",
            "payment_status",
            "discount",
            "manual_extra",
            "total",
            "paid_amount",
            "debt_amount",
            "note",
            "items",
        ]
        read_only_fields = ["id", "created_by", "created_at", "total", "paid_amount", "debt_amount", "payment_status"]


class PaymentSerializer(serializers.ModelSerializer):
    order_id = serializers.PrimaryKeyRelatedField(queryset=Order.objects.all(), write_only=True, source="order")

    class Meta:
        model = Payment
        fields = ["id", "order", "order_id", "created_by", "created_at", "method", "amount"]
        read_only_fields = ["id", "order", "created_by", "created_at"]
        extra_kwargs = {"order_id": {"required": False}}


class CustomerDebtSerializer(serializers.ModelSerializer):
    order_id = serializers.PrimaryKeyRelatedField(queryset=Order.objects.all(), write_only=True, source="order")
    customer = CustomerSerializer(read_only=True)

    class Meta:
        model = CustomerDebt
        fields = ["id", "customer", "order", "order_id", "amount", "is_closed", "created_at", "closed_at"]
        read_only_fields = ["id", "customer", "is_closed", "created_at", "closed_at"]


class DebtPaymentSerializer(serializers.ModelSerializer):
    debt_id = serializers.PrimaryKeyRelatedField(queryset=CustomerDebt.objects.all(), write_only=True, source="debt")

    class Meta:
        model = DebtPayment
        fields = ["id", "debt", "debt_id", "created_by", "created_at", "amount"]
        read_only_fields = ["id", "debt", "created_by", "created_at"]

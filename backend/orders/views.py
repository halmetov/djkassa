from decimal import Decimal
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from core.models import Customer, Order, Payment, CustomerDebt, DebtPayment
from orders.serializers import (
    CustomerSerializer,
    OrderSerializer,
    OrderItemSerializer,
    PaymentSerializer,
    CustomerDebtSerializer,
    DebtPaymentSerializer,
)
from orders import services as order_services
from common.utils import to_decimal


class CustomerViewSet(viewsets.ViewSet):
    def list(self, request):
        customers = list(Customer.objects.all())
        return Response(CustomerSerializer(customers, many=True).data)

    def create(self, request):
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = Customer.objects.create(**serializer.validated_data)
        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        customer = Customer.objects.get(pk=pk)
        serializer = CustomerSerializer(customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(customer, field, value)
        customer.save(update_fields=list(serializer.validated_data.keys()))
        return Response(CustomerSerializer(customer).data)


class OrderViewSet(viewsets.ViewSet):
    def list(self, request):
        orders = Order.objects.select_related("branch", "customer").prefetch_related("items__product")
        data = [self._serialize_order(order) for order in orders]
        return Response(data)

    def retrieve(self, request, pk=None):
        order = Order.objects.select_related("branch", "customer").get(pk=pk)
        return Response(self._serialize_order(order))

    def create(self, request):
        serializer = OrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        branch = validated["branch"]
        customer = validated.get("customer")
        items = validated["items"]
        order = order_services.create_order(
            user=request.user,
            branch=branch,
            customer=customer,
            items_data=items,
            discount=to_decimal(validated.get("discount", Decimal("0.00"))),
            manual_extra=to_decimal(validated.get("manual_extra", Decimal("0.00"))),
            note=validated.get("note", ""),
        )
        order_refreshed = Order.objects.select_related("branch", "customer").get(pk=order.pk)
        return Response(self._serialize_order(order_refreshed), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_payment(self, request, pk=None):
        order = Order.objects.select_related("customer", "branch").get(pk=pk)
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = order_services.add_payment(
            order,
            user=request.user,
            method=serializer.validated_data["method"],
            amount=to_decimal(serializer.validated_data["amount"]),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def ensure_debt(self, request, pk=None):
        order = Order.objects.select_related("customer").get(pk=pk)
        debt = order_services.ensure_debt(order)
        return Response(CustomerDebtSerializer(debt).data)

    def _serialize_order(self, order: Order) -> dict:
        items = list(order.items.select_related("product").all())
        serialized = OrderSerializer(order).data
        serialized["items"] = OrderItemSerializer(items, many=True).data
        return serialized


class PaymentViewSet(viewsets.ViewSet):
    def list(self, request):
        payments = list(Payment.objects.select_related("order").all())
        return Response(PaymentSerializer(payments, many=True).data)

    def retrieve(self, request, pk=None):
        payment = Payment.objects.select_related("order").get(pk=pk)
        return Response(PaymentSerializer(payment).data)


class CustomerDebtViewSet(viewsets.ViewSet):
    def list(self, request):
        debts = list(CustomerDebt.objects.select_related("order", "customer").all())
        return Response(CustomerDebtSerializer(debts, many=True).data)

    def retrieve(self, request, pk=None):
        debt = CustomerDebt.objects.select_related("order", "customer").get(pk=pk)
        return Response(CustomerDebtSerializer(debt).data)


class DebtPaymentViewSet(viewsets.ViewSet):
    def list(self, request):
        payments = list(DebtPayment.objects.select_related("debt").all())
        return Response(DebtPaymentSerializer(payments, many=True).data)

    def create(self, request):
        serializer = DebtPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        debt = serializer.validated_data["debt"]
        payment = order_services.add_debt_payment(
            debt=debt,
            user=request.user,
            amount=to_decimal(serializer.validated_data["amount"]),
        )
        return Response(DebtPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

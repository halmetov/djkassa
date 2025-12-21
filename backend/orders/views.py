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
    async def list(self, request):
        customers = [c async for c in Customer.objects.all()]
        return Response(CustomerSerializer(customers, many=True).data)

    async def create(self, request):
        serializer = CustomerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = await Customer.objects.acreate(**serializer.validated_data)
        return Response(CustomerSerializer(customer).data, status=status.HTTP_201_CREATED)

    async def partial_update(self, request, pk=None):
        customer = await Customer.objects.aget(pk=pk)
        serializer = CustomerSerializer(customer, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(customer, field, value)
        await customer.asave(update_fields=list(serializer.validated_data.keys()))
        return Response(CustomerSerializer(customer).data)


class OrderViewSet(viewsets.ViewSet):
    async def list(self, request):
        orders = [o async for o in Order.objects.select_related("branch", "customer").all()]
        data = []
        for order in orders:
            items = [item async for item in order.items.select_related("product").all()]
            serialized = OrderSerializer(order).data
            serialized["items"] = OrderItemSerializer(items, many=True).data
            data.append(serialized)
        return Response(data)

    async def retrieve(self, request, pk=None):
        order = await Order.objects.select_related("branch", "customer").aget(pk=pk)
        items = [item async for item in order.items.select_related("product").all()]
        serialized = OrderSerializer(order).data
        serialized["items"] = OrderItemSerializer(items, many=True).data
        return Response(serialized)

    async def create(self, request):
        serializer = OrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        branch = validated["branch"]
        customer = validated.get("customer")
        items = validated["items"]
        order = await order_services.create_order(
            user=request.user,
            branch=branch,
            customer=customer,
            items_data=items,
            discount=to_decimal(validated.get("discount", Decimal("0.00"))),
            manual_extra=to_decimal(validated.get("manual_extra", Decimal("0.00"))),
            note=validated.get("note", ""),
        )
        return await self.retrieve(request, pk=order.pk)

    @action(detail=True, methods=["post"])
    async def add_payment(self, request, pk=None):
        order = await Order.objects.select_related("customer", "branch").aget(pk=pk)
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = await order_services.add_payment(
            order,
            user=request.user,
            method=serializer.validated_data["method"],
            amount=to_decimal(serializer.validated_data["amount"]),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    async def ensure_debt(self, request, pk=None):
        order = await Order.objects.select_related("customer").aget(pk=pk)
        debt = await order_services.ensure_debt(order)
        return Response(CustomerDebtSerializer(debt).data)


class PaymentViewSet(viewsets.ViewSet):
    async def list(self, request):
        payments = [p async for p in Payment.objects.select_related("order").all()]
        return Response(PaymentSerializer(payments, many=True).data)

    async def retrieve(self, request, pk=None):
        payment = await Payment.objects.select_related("order").aget(pk=pk)
        return Response(PaymentSerializer(payment).data)


class CustomerDebtViewSet(viewsets.ViewSet):
    async def list(self, request):
        debts = [d async for d in CustomerDebt.objects.select_related("order", "customer").all()]
        return Response(CustomerDebtSerializer(debts, many=True).data)

    async def retrieve(self, request, pk=None):
        debt = await CustomerDebt.objects.select_related("order", "customer").aget(pk=pk)
        return Response(CustomerDebtSerializer(debt).data)


class DebtPaymentViewSet(viewsets.ViewSet):
    async def list(self, request):
        payments = [p async for p in DebtPayment.objects.select_related("debt").all()]
        return Response(DebtPaymentSerializer(payments, many=True).data)

    async def create(self, request):
        serializer = DebtPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        debt = serializer.validated_data["debt"]
        payment = await order_services.add_debt_payment(
            debt=debt,
            user=request.user,
            amount=to_decimal(serializer.validated_data["amount"]),
        )
        return Response(DebtPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

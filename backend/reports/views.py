from decimal import Decimal
from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Order, CustomerDebt, Stock


class DashboardView(APIView):
    """
    Простой dashboard с суммами заказов и долгов.
    """

    async def get(self, request, *args, **kwargs):
        orders_total_data = await Order.objects.aaggregate(sum=Sum("total"))
        debts_total_data = await CustomerDebt.objects.aaggregate(sum=Sum("amount"))
        orders_total = orders_total_data.get("sum") or Decimal("0")
        debts_total = debts_total_data.get("sum") or Decimal("0")
        stock_count = await Stock.objects.acount()

        return Response(
            {
                "orders_total": orders_total,
                "debts_total": debts_total,
                "stock_positions": stock_count,
            }
        )

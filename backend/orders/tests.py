from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch, Category, Product, Customer
from orders import services as order_services


User = get_user_model()


class DebtFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="cashier", password="pwd")
        self.branch = Branch.objects.create(name="Main")
        category = Category.objects.create(name="Cat")
        self.product = Product.objects.create(category=category, name="Prod", sku="P1", unit="pcs", sale_price=Decimal("100"))
        self.customer = Customer.objects.create(name="Buyer")

    def test_debt_payment_flow(self):
        order = order_services.create_order(
            user=self.user,
            branch=self.branch,
            customer=self.customer,
            items_data=[{"product": self.product, "qty": Decimal("1"), "price": Decimal("100")}],
            discount=Decimal("0"),
            manual_extra=Decimal("0"),
            note="",
        )
        order_services.add_payment(order, user=self.user, method="cash", amount=Decimal("20"))
        debt = order_services.ensure_debt(order)
        payment = order_services.add_debt_payment(debt, user=self.user, amount=Decimal("20"))
        debt.refresh_from_db()
        self.assertEqual(order.total, Decimal("100"))
        self.assertEqual(order.paid_amount, Decimal("20"))
        self.assertEqual(debt.amount, Decimal("60"))
        self.assertFalse(debt.is_closed)
        self.assertEqual(payment.amount, Decimal("20"))

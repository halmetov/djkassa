from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Branch, Category, Product, Stock
from warehouse import services as warehouse_services


User = get_user_model()


class StockMoveServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="test", password="pwd")
        self.branch_from = Branch.objects.create(name="Main")
        self.branch_to = Branch.objects.create(name="Shop")
        category = Category.objects.create(name="Cat1")
        self.product = Product.objects.create(category=category, name="Item", sku="SKU1", unit="pcs")
        Stock.objects.create(branch=self.branch_from, product=self.product, qty=Decimal("10"))

    def test_post_transfer_updates_stocks(self):
        move = warehouse_services.create_move_with_items(
            data={
                "move_type": "transfer",
                "from_branch": self.branch_from,
                "to_branch": self.branch_to,
                "items": [{"product": self.product, "qty": Decimal("5"), "price": Decimal("10")}],
            },
            user=self.user,
        )
        warehouse_services.post_stock_move(move)

        stock_from = Stock.objects.get(branch=self.branch_from, product=self.product)
        stock_to = Stock.objects.get(branch=self.branch_to, product=self.product)
        self.assertEqual(stock_from.qty, Decimal("5"))
        self.assertEqual(stock_to.qty, Decimal("5"))

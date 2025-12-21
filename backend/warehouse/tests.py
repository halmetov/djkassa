from decimal import Decimal
from asgiref.sync import async_to_sync
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
        async def run_test():
            move = await warehouse_services.create_move_with_items(
                data={
                    "move_type": "transfer",
                    "from_branch": self.branch_from,
                    "to_branch": self.branch_to,
                    "items": [{"product": self.product, "qty": Decimal("5"), "price": Decimal("10")}],
                },
                user=self.user,
            )
            await warehouse_services.post_stock_move(move)

            stock_from = await Stock.objects.aget(branch=self.branch_from, product=self.product)
            stock_to = await Stock.objects.aget(branch=self.branch_to, product=self.product)
            return stock_from.qty, stock_to.qty

        qty_from, qty_to = async_to_sync(run_test)()
        self.assertEqual(qty_from, Decimal("-5"))
        self.assertEqual(qty_to, Decimal("5"))

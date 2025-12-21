from decimal import Decimal
from typing import Iterable
from django.db import transaction
from django.db.models import F

from core.models import Stock, StockMove, StockMoveItem, Branch, Product
from common.utils import to_decimal


async def get_or_create_stock(branch: Branch, product: Product) -> Stock:
    stock, _ = await Stock.objects.aget_or_create(branch=branch, product=product, defaults={"qty": Decimal("0")})
    return stock


async def apply_stock_change(branch: Branch, product: Product, qty_delta: Decimal) -> Stock:
    async with transaction.async_atomic():
        stock = await get_or_create_stock(branch, product)
        stock.qty = stock.qty + qty_delta
        await stock.asave(update_fields=["qty"])
    return stock


async def validate_move(move: StockMove, items: Iterable[StockMoveItem]):
    if move.status == "posted":
        raise ValueError("Документ уже проведен")
    if move.status == "canceled":
        raise ValueError("Документ отменен")
    if move.move_type in ("out", "transfer"):
        for item in items:
            stock = await get_or_create_stock(move.from_branch, item.product)
            if stock.qty < item.qty:
                raise ValueError(f"Недостаточно остатка для {item.product}")


async def post_stock_move(move: StockMove):
    items = [item async for item in move.items.all()]
    await validate_move(move, items)

    async with transaction.async_atomic():
        for item in items:
            qty = item.qty
            if move.move_type == "in":
                await apply_stock_change(move.to_branch, item.product, qty)
            elif move.move_type == "out":
                await apply_stock_change(move.from_branch, item.product, -qty)
            elif move.move_type == "transfer":
                await apply_stock_change(move.from_branch, item.product, -qty)
                await apply_stock_change(move.to_branch, item.product, qty)
            elif move.move_type == "adjust":
                await apply_stock_change(move.to_branch or move.from_branch, item.product, qty)
            elif move.move_type == "return":
                await apply_stock_change(move.to_branch or move.from_branch, item.product, qty)
        move.status = "posted"
        await move.asave(update_fields=["status"])
    return move


async def create_move_with_items(*, data: dict, user) -> StockMove:
    async with transaction.async_atomic():
        move = await StockMove.objects.acreate(
            move_type=data["move_type"],
            status="draft",
            from_branch=data.get("from_branch"),
            to_branch=data.get("to_branch"),
            created_by=user,
            note=data.get("note", ""),
        )
        items_data = data.get("items", [])
        for item_data in items_data:
            product = item_data["product"]
            qty = to_decimal(item_data["qty"])
            price = to_decimal(item_data.get("price", 0))
            await StockMoveItem.objects.acreate(move=move, product=product, qty=qty, price=price)
    return move

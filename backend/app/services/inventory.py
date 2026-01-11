from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Stock


def adjust_stock(db: Session, branch_id: int, product_id: int, delta: int, allow_negative: bool = False) -> Stock:
    result = db.execute(
        select(Stock).where(Stock.branch_id == branch_id, Stock.product_id == product_id)
    )
    stock = result.scalar_one_or_none()
    if stock is None:
        stock = Stock(branch_id=branch_id, product_id=product_id, quantity=0)
        db.add(stock)
    stock.quantity += delta
    if not allow_negative and stock.quantity < 0:
        stock.quantity = 0
    db.flush()
    return stock

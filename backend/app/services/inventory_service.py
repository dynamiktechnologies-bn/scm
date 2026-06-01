"""Inventory costing and stock movement service.

Rules:
- All mutations are wrapped in the caller's DB transaction.
- WAVG cost is stored denormalized on Product.current_avg_cost.
- FIFO cost is maintained via FifoLayer rows; layers are consumed oldest-first.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.inventory import InventoryTransaction, FifoLayer
from app.models.product import Product


def _get_stock(db: Session, product_id: int, location_id: int) -> Decimal:
    result = db.query(
        func.coalesce(
            func.sum(InventoryTransaction.qty * InventoryTransaction.direction),
            Decimal("0"),
        )
    ).filter(
        InventoryTransaction.product_id == product_id,
        InventoryTransaction.location_id == location_id,
    ).scalar()
    return result or Decimal("0")


def receive(
    db: Session,
    product: Product,
    location_id: int,
    qty: Decimal,
    unit_cost: Decimal,
    txn_type: str,
    ref_type: str,
    ref_id: int,
    ref_line: int | None,
    txn_date: date,
    created_by: int | None = None,
) -> InventoryTransaction:
    """Post an inbound inventory movement and update WAVG / FIFO layers."""
    if qty <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Quantity must be positive")

    txn = InventoryTransaction(
        product_id=product.id,
        location_id=location_id,
        txn_type=txn_type,
        reference_type=ref_type,
        reference_id=ref_id,
        reference_line=ref_line,
        qty=qty,
        direction=1,
        unit_cost=unit_cost,
        txn_date=txn_date,
        created_by=created_by,
    )
    db.add(txn)
    db.flush()

    if product.valuation_method == "WAVG":
        old_qty = _get_stock(db, product.id, location_id) - qty  # subtract what we just added
        old_avg = product.current_avg_cost or Decimal("0")
        denom = old_qty + qty
        if denom > 0:
            new_avg = ((old_qty * old_avg) + (qty * unit_cost)) / denom
            product.current_avg_cost = new_avg.quantize(Decimal("0.0001"), ROUND_HALF_UP)
        else:
            product.current_avg_cost = unit_cost

    elif product.valuation_method == "FIFO":
        layer = FifoLayer(
            product_id=product.id,
            location_id=location_id,
            grn_txn_id=txn.id,
            receipt_date=txn_date,
            qty_received=qty,
            qty_remaining=qty,
            unit_cost=unit_cost,
        )
        db.add(layer)

    return txn


def issue(
    db: Session,
    product: Product,
    location_id: int,
    qty: Decimal,
    txn_type: str,
    ref_type: str,
    ref_id: int,
    ref_line: int | None,
    txn_date: date,
    created_by: int | None = None,
) -> tuple[InventoryTransaction, Decimal]:
    """Post an outbound movement. Returns (transaction, unit_cost_used).

    For WAVG: unit_cost = current_avg_cost at time of issue.
    For FIFO: consumes oldest layers; weighted average of consumed cost returned.
    """
    if qty <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Quantity must be positive")

    on_hand = _get_stock(db, product.id, location_id)
    if on_hand < qty:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Insufficient stock for product {product.sku}: on hand {on_hand}, requested {qty}",
        )

    if product.valuation_method == "WAVG":
        unit_cost = product.current_avg_cost or Decimal("0")

    else:  # FIFO
        layers = (
            db.query(FifoLayer)
            .filter(
                FifoLayer.product_id == product.id,
                FifoLayer.location_id == location_id,
                FifoLayer.qty_remaining > 0,
            )
            .order_by(FifoLayer.receipt_date, FifoLayer.id)
            .all()
        )
        remaining = qty
        total_cost = Decimal("0")
        for layer in layers:
            take = min(layer.qty_remaining, remaining)
            total_cost += take * layer.unit_cost
            layer.qty_remaining -= take
            remaining -= take
            if remaining <= 0:
                break
        if remaining > 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "FIFO layer mismatch — contact support")
        unit_cost = (total_cost / qty).quantize(Decimal("0.0001"), ROUND_HALF_UP)

    txn = InventoryTransaction(
        product_id=product.id,
        location_id=location_id,
        txn_type=txn_type,
        reference_type=ref_type,
        reference_id=ref_id,
        reference_line=ref_line,
        qty=qty,
        direction=-1,
        unit_cost=unit_cost,
        txn_date=txn_date,
        created_by=created_by,
    )
    db.add(txn)
    return txn, unit_cost

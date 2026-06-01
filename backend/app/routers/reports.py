from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.inventory import InventoryTransaction
from app.models.product import Product
from app.models.purchase import PurchaseOrder, GoodsReceipt
from app.models.sales import SalesOrder, Shipment, ShipmentLine
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/reports", tags=["reports"])


class ValuationRow(BaseModel):
    product_id: int
    sku: str
    name: str
    qty_on_hand: Decimal
    avg_cost: Decimal
    inventory_value: Decimal


class StockAgingRow(BaseModel):
    product_id: int
    sku: str
    name: str
    last_txn_date: date | None
    days_since_last_movement: int | None
    qty_on_hand: Decimal


class PurchaseRegisterRow(BaseModel):
    po_id: int
    po_number: str
    order_date: date
    supplier_id: int
    status: str
    total_amount: Decimal


class SalesRegisterRow(BaseModel):
    so_id: int
    so_number: str
    order_date: date
    customer_id: int
    status: str
    total_amount: Decimal


class MarginRow(BaseModel):
    product_id: int
    sku: str
    name: str
    qty_sold: Decimal
    revenue: Decimal
    cogs: Decimal
    gross_margin: Decimal
    margin_pct: Decimal


@router.get("/inventory-valuation", response_model=list[ValuationRow])
def inventory_valuation(db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.query(
        InventoryTransaction.product_id,
        func.sum(InventoryTransaction.qty * InventoryTransaction.direction).label("qty_on_hand"),
    ).group_by(InventoryTransaction.product_id).all()

    result = []
    for row in rows:
        qty = row.qty_on_hand or Decimal("0")
        if qty == 0:
            continue
        p = db.query(Product).filter(Product.id == row.product_id).first()
        if not p:
            continue
        result.append(ValuationRow(
            product_id=p.id, sku=p.sku, name=p.name,
            qty_on_hand=qty, avg_cost=p.current_avg_cost,
            inventory_value=qty * p.current_avg_cost,
        ))
    return sorted(result, key=lambda r: r.sku)


@router.get("/stock-aging", response_model=list[StockAgingRow])
def stock_aging(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from datetime import date as date_cls
    last_txns = db.query(
        InventoryTransaction.product_id,
        func.max(InventoryTransaction.txn_date).label("last_txn"),
    ).group_by(InventoryTransaction.product_id).all()

    balances = {
        row.product_id: row.qty_on_hand
        for row in db.query(
            InventoryTransaction.product_id,
            func.sum(InventoryTransaction.qty * InventoryTransaction.direction).label("qty_on_hand"),
        ).group_by(InventoryTransaction.product_id).all()
    }

    today = date_cls.today()
    result = []
    for row in last_txns:
        p = db.query(Product).filter(Product.id == row.product_id).first()
        if not p:
            continue
        days = (today - row.last_txn).days if row.last_txn else None
        qty = balances.get(p.id, Decimal("0")) or Decimal("0")
        result.append(StockAgingRow(
            product_id=p.id, sku=p.sku, name=p.name,
            last_txn_date=row.last_txn, days_since_last_movement=days, qty_on_hand=qty,
        ))
    return sorted(result, key=lambda r: (r.days_since_last_movement or 0), reverse=True)


@router.get("/purchase-register", response_model=list[PurchaseRegisterRow])
def purchase_register(from_date: str | None = None, to_date: str | None = None,
                       db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(PurchaseOrder)
    if from_date:
        q = q.filter(PurchaseOrder.order_date >= from_date)
    if to_date:
        q = q.filter(PurchaseOrder.order_date <= to_date)
    pos = q.order_by(PurchaseOrder.order_date.desc()).all()
    return [PurchaseRegisterRow(
        po_id=po.id, po_number=po.po_number, order_date=po.order_date,
        supplier_id=po.supplier_id, status=po.status, total_amount=po.total_amount,
    ) for po in pos]


@router.get("/sales-register", response_model=list[SalesRegisterRow])
def sales_register(from_date: str | None = None, to_date: str | None = None,
                    db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(SalesOrder)
    if from_date:
        q = q.filter(SalesOrder.order_date >= from_date)
    if to_date:
        q = q.filter(SalesOrder.order_date <= to_date)
    sos = q.order_by(SalesOrder.order_date.desc()).all()
    return [SalesRegisterRow(
        so_id=so.id, so_number=so.so_number, order_date=so.order_date,
        customer_id=so.customer_id, status=so.status, total_amount=so.total_amount,
    ) for so in sos]


@router.get("/margin", response_model=list[MarginRow])
def margin_report(
    from_date: str | None = None,
    to_date: str | None = None,
    product_id: int | None = None,
    so_id: int | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(
        ShipmentLine.product_id,
        func.sum(ShipmentLine.qty_shipped).label("qty_sold"),
        func.sum(ShipmentLine.qty_shipped * ShipmentLine.unit_price).label("revenue"),
        func.sum(ShipmentLine.qty_shipped * ShipmentLine.unit_cost).label("cogs"),
    ).join(Shipment, ShipmentLine.shipment_id == Shipment.id).filter(Shipment.status == "POSTED")

    if from_date:
        q = q.filter(Shipment.ship_date >= from_date)
    if to_date:
        q = q.filter(Shipment.ship_date <= to_date)
    if product_id:
        q = q.filter(ShipmentLine.product_id == product_id)
    if so_id:
        q = q.filter(Shipment.so_id == so_id)

    rows = q.group_by(ShipmentLine.product_id).all()
    result = []
    for row in rows:
        p = db.query(Product).filter(Product.id == row.product_id).first()
        if not p:
            continue
        rev = row.revenue or Decimal("0")
        cogs = row.cogs or Decimal("0")
        margin = rev - cogs
        pct = (margin / rev * 100).quantize(Decimal("0.01")) if rev else Decimal("0")
        result.append(MarginRow(
            product_id=p.id, sku=p.sku, name=p.name,
            qty_sold=row.qty_sold or Decimal("0"),
            revenue=rev, cogs=cogs, gross_margin=margin, margin_pct=pct,
        ))
    return sorted(result, key=lambda r: r.sku)

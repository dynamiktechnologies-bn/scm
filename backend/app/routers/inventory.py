from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.inventory import InventoryTransaction
from app.models.inv_ops import InventoryAdjustment, AdjustmentLine, StockTransfer, TransferLine
from app.models.product import Product
from app.models.warehouse import Location, Warehouse
from app.schemas.product import StockBalance
from app.schemas.inventory import (
    InventoryTransactionOut,
    AdjustmentCreate, AdjustmentOut,
    TransferCreate, TransferOut,
)
from app.services.number_service import next_number
from app.services import inventory_service as inv_svc
from app.services import posting_service as post_svc

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/stock", response_model=list[StockBalance])
def stock_summary(location_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(
        InventoryTransaction.product_id,
        InventoryTransaction.location_id,
        func.sum(InventoryTransaction.qty * InventoryTransaction.direction).label("qty_on_hand"),
    ).group_by(InventoryTransaction.product_id, InventoryTransaction.location_id)
    if location_id:
        q = q.filter(InventoryTransaction.location_id == location_id)

    rows = q.all()
    result = []
    for row in rows:
        if (row.qty_on_hand or Decimal("0")) == 0:
            continue
        product = db.query(Product).filter(Product.id == row.product_id).first()
        loc = db.query(Location).filter(Location.id == row.location_id).first()
        if not product or not loc:
            continue
        qty = row.qty_on_hand or Decimal("0")
        result.append(StockBalance(
            product_id=product.id,
            sku=product.sku,
            name=product.name,
            location_id=loc.id,
            location_code=loc.code,
            warehouse_name=loc.warehouse.name if loc.warehouse else "",
            qty_on_hand=qty,
            avg_cost=product.current_avg_cost,
            inventory_value=qty * product.current_avg_cost,
        ))
    return result


@router.get("/transactions", response_model=list[InventoryTransactionOut])
def list_transactions(
    product_id: int | None = None,
    location_id: int | None = None,
    txn_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(InventoryTransaction).options(
        joinedload(InventoryTransaction.product),
        joinedload(InventoryTransaction.location),
    )
    if product_id:
        q = q.filter(InventoryTransaction.product_id == product_id)
    if location_id:
        q = q.filter(InventoryTransaction.location_id == location_id)
    if txn_type:
        q = q.filter(InventoryTransaction.txn_type == txn_type)
    if from_date:
        q = q.filter(InventoryTransaction.txn_date >= from_date)
    if to_date:
        q = q.filter(InventoryTransaction.txn_date <= to_date)

    txns = q.order_by(InventoryTransaction.id.desc()).limit(500).all()
    result = []
    for t in txns:
        out = InventoryTransactionOut.model_validate(t)
        out.product_sku = t.product.sku if t.product else None
        out.product_name = t.product.name if t.product else None
        result.append(out)
    return result


# ── Adjustments ──────────────────────────────────────────────────────────────

@router.get("/adjustments", response_model=list[AdjustmentOut])
def list_adjustments(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(InventoryAdjustment).options(joinedload(InventoryAdjustment.lines)).order_by(InventoryAdjustment.id.desc()).all()


@router.post("/adjustments", response_model=AdjustmentOut, status_code=201)
def create_adjustment(body: AdjustmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    adj = InventoryAdjustment(
        adj_number=next_number(db, "ADJ"),
        location_id=body.location_id,
        adj_date=body.adj_date,
        reason_code=body.reason_code,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(adj)
    db.flush()
    for ln in body.lines:
        db.add(AdjustmentLine(adj_id=adj.id, **ln.model_dump()))
    db.commit()
    db.refresh(adj)
    return adj


@router.post("/adjustments/{adj_id}/post", response_model=AdjustmentOut)
def post_adjustment(adj_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    adj = db.query(InventoryAdjustment).options(joinedload(InventoryAdjustment.lines)).filter(InventoryAdjustment.id == adj_id).first()
    if not adj:
        raise HTTPException(404, "Adjustment not found")
    if adj.status == "POSTED":
        raise HTTPException(400, "Already posted")

    je_lines = []
    for ln in adj.lines:
        product = db.query(Product).filter(Product.id == ln.product_id).first()
        variance = ln.qty_actual - ln.qty_system
        if variance != 0:
            if variance > 0:
                it = inv_svc.receive(
                    db, product, adj.location_id, variance, ln.unit_cost,
                    txn_type="INV_ADJUST_IN", ref_type="ADJ", ref_id=adj.id, ref_line=ln.id,
                    txn_date=adj.adj_date, created_by=current_user.id,
                )
            else:
                it, _ = inv_svc.issue(
                    db, product, adj.location_id, abs(variance),
                    txn_type="INV_ADJUST_OUT", ref_type="ADJ", ref_id=adj.id, ref_line=ln.id,
                    txn_date=adj.adj_date, created_by=current_user.id,
                )
            ln.it_id = it.id
            je_lines.append({"product": product, "variance_qty": variance, "unit_cost": ln.unit_cost})

    je = post_svc.post_adjustment(db, adj, je_lines, created_by=current_user.id)
    adj.je_id = je.id
    adj.status = "POSTED"
    db.commit()
    db.refresh(adj)
    return adj


# ── Transfers ────────────────────────────────────────────────────────────────

@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(StockTransfer).options(joinedload(StockTransfer.lines)).order_by(StockTransfer.id.desc()).all()


@router.post("/transfers", response_model=TransferOut, status_code=201)
def create_transfer(body: TransferCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    trf = StockTransfer(
        transfer_number=next_number(db, "TRF"),
        from_location_id=body.from_location_id,
        to_location_id=body.to_location_id,
        transfer_date=body.transfer_date,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(trf)
    db.flush()
    for ln in body.lines:
        db.add(TransferLine(transfer_id=trf.id, **ln.model_dump()))
    db.commit()
    db.refresh(trf)
    return trf


@router.post("/transfers/{trf_id}/post", response_model=TransferOut)
def post_transfer(trf_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    trf = db.query(StockTransfer).options(joinedload(StockTransfer.lines)).filter(StockTransfer.id == trf_id).first()
    if not trf:
        raise HTTPException(404, "Transfer not found")
    if trf.status == "POSTED":
        raise HTTPException(400, "Already posted")

    for ln in trf.lines:
        product = db.query(Product).filter(Product.id == ln.product_id).first()
        out_it, unit_cost = inv_svc.issue(
            db, product, trf.from_location_id, ln.qty,
            txn_type="STOCK_TRANSFER_OUT", ref_type="TRF", ref_id=trf.id, ref_line=ln.id,
            txn_date=trf.transfer_date, created_by=current_user.id,
        )
        in_it = inv_svc.receive(
            db, product, trf.to_location_id, ln.qty, unit_cost,
            txn_type="STOCK_TRANSFER_IN", ref_type="TRF", ref_id=trf.id, ref_line=ln.id,
            txn_date=trf.transfer_date, created_by=current_user.id,
        )
        ln.unit_cost = unit_cost
        ln.out_it_id = out_it.id
        ln.in_it_id = in_it.id

    trf.status = "POSTED"
    db.commit()
    db.refresh(trf)
    return trf

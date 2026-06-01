from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models.sales import SalesOrder, SOLine, Shipment, ShipmentLine, SalesReturn, SalesReturnLine
from app.models.product import Product
from app.models.inventory import InventoryTransaction
from app.schemas.sales import (
    SOCreate, SOUpdate, SOOut,
    ShipmentCreate, ShipmentOut,
    SalesReturnCreate, SalesReturnOut,
)
from app.services.number_service import next_number
from app.services import inventory_service as inv_svc
from app.services import posting_service as post_svc

router = APIRouter(prefix="/sales", tags=["sales"])


def _get_on_hand(db: Session, product_id: int, location_id: int | None = None) -> Decimal:
    q = db.query(
        func.coalesce(func.sum(InventoryTransaction.qty * InventoryTransaction.direction), Decimal("0"))
    ).filter(InventoryTransaction.product_id == product_id)
    if location_id:
        q = q.filter(InventoryTransaction.location_id == location_id)
    return q.scalar() or Decimal("0")


def _calc_so_totals(lines: list[SOLine]) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum(ln.qty_ordered * ln.unit_price * (1 - ln.discount_pct / 100) for ln in lines)
    tax = sum(ln.qty_ordered * ln.unit_price * (1 - ln.discount_pct / 100) * ln.tax_rate for ln in lines)
    return subtotal, tax, subtotal + tax


# ── Sales Orders ─────────────────────────────────────────────────────────────

@router.get("/orders", response_model=list[SOOut])
def list_sos(so_status: str | None = None, customer_id: int | None = None,
             db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(SalesOrder).options(joinedload(SalesOrder.lines).joinedload(SOLine.product))
    if so_status:
        q = q.filter(SalesOrder.status == so_status)
    if customer_id:
        q = q.filter(SalesOrder.customer_id == customer_id)
    return q.order_by(SalesOrder.id.desc()).all()


@router.post("/orders", response_model=SOOut, status_code=201)
def create_so(body: SOCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    so = SalesOrder(
        so_number=next_number(db, "SO"),
        customer_id=body.customer_id,
        order_date=body.order_date,
        required_date=body.required_date,
        currency=body.currency,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(so)
    db.flush()
    so_lines = []
    for ln in body.lines:
        sol = SOLine(so_id=so.id, **ln.model_dump())
        db.add(sol)
        so_lines.append(sol)
    db.flush()
    so.subtotal, so.tax_amount, so.total_amount = _calc_so_totals(so_lines)
    db.commit()
    db.refresh(so)
    return so


@router.get("/orders/{so_id}", response_model=SOOut)
def get_so(so_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    so = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines).joinedload(SOLine.product)
    ).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    # Inject availability
    for line in so.lines:
        line.qty_available = _get_on_hand(db, line.product_id)
    return so


@router.put("/orders/{so_id}", response_model=SOOut)
def update_so(so_id: int, body: SOUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    if so.status not in ("DRAFT",):
        raise HTTPException(400, "Only DRAFT sales orders can be updated")
    if body.required_date is not None:
        so.required_date = body.required_date
    if body.notes is not None:
        so.notes = body.notes
    if body.lines is not None:
        for old in so.lines:
            db.delete(old)
        db.flush()
        new_lines = []
        for ln in body.lines:
            sol = SOLine(so_id=so.id, **ln.model_dump())
            db.add(sol)
            new_lines.append(sol)
        db.flush()
        so.subtotal, so.tax_amount, so.total_amount = _calc_so_totals(new_lines)
    db.commit()
    db.refresh(so)
    return so


@router.post("/orders/{so_id}/confirm", response_model=SOOut)
def confirm_so(so_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    so = db.query(SalesOrder).options(joinedload(SalesOrder.lines)).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    if so.status != "DRAFT":
        raise HTTPException(400, f"Cannot confirm SO in status {so.status}")
    for line in so.lines:
        available = _get_on_hand(db, line.product_id)
        if available < (line.qty_ordered - line.qty_shipped):
            raise HTTPException(
                400,
                f"Insufficient stock for {line.product_id}: need {line.qty_ordered - line.qty_shipped}, have {available}",
            )
    so.status = "CONFIRMED"
    db.commit()
    db.refresh(so)
    return so


@router.post("/orders/{so_id}/cancel", response_model=SOOut)
def cancel_so(so_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    if so.status in ("FULLY_SHIPPED",):
        raise HTTPException(400, "Cannot cancel a fully shipped order")
    so.status = "CANCELLED"
    db.commit()
    db.refresh(so)
    return so


@router.get("/orders/{so_id}/picking-list")
def picking_list(so_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    so = db.query(SalesOrder).options(
        joinedload(SalesOrder.lines).joinedload(SOLine.product)
    ).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    return {
        "so_number": so.so_number,
        "customer_id": so.customer_id,
        "lines": [
            {
                "sku": ln.product.sku,
                "name": ln.product.name,
                "qty_to_pick": float(ln.qty_ordered - ln.qty_shipped),
            }
            for ln in so.lines
        ],
    }


# ── Shipments ────────────────────────────────────────────────────────────────

@router.get("/shipments", response_model=list[ShipmentOut])
def list_shipments(so_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(Shipment).options(joinedload(Shipment.lines).joinedload(ShipmentLine.product))
    if so_id:
        q = q.filter(Shipment.so_id == so_id)
    return q.order_by(Shipment.id.desc()).all()


@router.post("/shipments", response_model=ShipmentOut, status_code=201)
def create_shipment(body: ShipmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    so = db.query(SalesOrder).filter(SalesOrder.id == body.so_id).first()
    if not so:
        raise HTTPException(404, "Sales order not found")
    if so.status not in ("CONFIRMED", "PARTIALLY_SHIPPED"):
        raise HTTPException(400, f"Cannot ship SO in status {so.status}")

    ship = Shipment(
        shipment_number=next_number(db, "SHIP"),
        so_id=body.so_id,
        customer_id=so.customer_id,
        location_id=body.location_id,
        ship_date=body.ship_date,
        carrier=body.carrier,
        tracking_ref=body.tracking_ref,
        created_by=current_user.id,
    )
    db.add(ship)
    db.flush()
    for ln in body.lines:
        # unit_cost will be set at post time; store 0 now
        sl = ShipmentLine(
            shipment_id=ship.id,
            so_line_id=ln.so_line_id,
            product_id=ln.product_id,
            qty_shipped=ln.qty_shipped,
            unit_price=ln.unit_price,
            unit_cost=Decimal("0"),
        )
        db.add(sl)
    db.commit()
    db.refresh(ship)
    return ship


@router.get("/shipments/{ship_id}", response_model=ShipmentOut)
def get_shipment(ship_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    ship = db.query(Shipment).options(joinedload(Shipment.lines).joinedload(ShipmentLine.product)).filter(Shipment.id == ship_id).first()
    if not ship:
        raise HTTPException(404, "Shipment not found")
    return ship


@router.post("/shipments/{ship_id}/post", response_model=ShipmentOut)
def post_shipment(ship_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ship = db.query(Shipment).options(joinedload(Shipment.lines)).filter(Shipment.id == ship_id).first()
    if not ship:
        raise HTTPException(404, "Shipment not found")
    if ship.status == "POSTED":
        raise HTTPException(400, "Shipment already posted")

    cogs_lines = []
    revenue_lines = []

    for sl in ship.lines:
        product = db.query(Product).filter(Product.id == sl.product_id).first()
        it, unit_cost = inv_svc.issue(
            db, product, ship.location_id, sl.qty_shipped,
            txn_type="SO_SHIPMENT", ref_type="SHIP", ref_id=ship.id, ref_line=sl.id,
            txn_date=ship.ship_date, created_by=current_user.id,
        )
        sl.unit_cost = unit_cost
        sl.it_id = it.id

        # Update SO line shipped qty
        if sl.so_line_id:
            sol = db.query(SOLine).filter(SOLine.id == sl.so_line_id).first()
            if sol:
                sol.qty_shipped += sl.qty_shipped

        cogs_lines.append({"product": product, "qty": sl.qty_shipped, "unit_cost": unit_cost})
        revenue_lines.append({"product": product, "qty": sl.qty_shipped, "unit_price": sl.unit_price})

    cogs_je = post_svc.post_shipment_cogs(db, ship, cogs_lines, created_by=current_user.id)
    rev_je = post_svc.post_shipment_revenue(db, ship, revenue_lines, created_by=current_user.id)

    ship.cogs_je_id = cogs_je.id
    ship.sales_je_id = rev_je.id
    ship.status = "POSTED"

    # Update SO status
    so = db.query(SalesOrder).options(joinedload(SalesOrder.lines)).filter(SalesOrder.id == ship.so_id).first()
    if so:
        all_shipped = all(ln.qty_shipped >= ln.qty_ordered for ln in so.lines)
        so.status = "FULLY_SHIPPED" if all_shipped else "PARTIALLY_SHIPPED"

    db.commit()
    db.refresh(ship)
    return ship


# ── Sales Returns ────────────────────────────────────────────────────────────

@router.get("/returns", response_model=list[SalesReturnOut])
def list_sales_returns(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(SalesReturn).order_by(SalesReturn.id.desc()).all()


@router.post("/returns", response_model=SalesReturnOut, status_code=201)
def create_sales_return(body: SalesReturnCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ship = db.query(Shipment).filter(Shipment.id == body.shipment_id).first()
    if not ship:
        raise HTTPException(404, "Shipment not found")
    ret = SalesReturn(
        return_number=next_number(db, "SRET"),
        shipment_id=body.shipment_id,
        customer_id=ship.customer_id,
        location_id=body.location_id,
        return_date=body.return_date,
        reason=body.reason,
    )
    db.add(ret)
    db.flush()
    for ln in body.lines:
        db.add(SalesReturnLine(return_id=ret.id, **ln.model_dump()))
    db.commit()
    db.refresh(ret)
    return ret


@router.post("/returns/{ret_id}/post", response_model=SalesReturnOut)
def post_sales_return(ret_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ret = db.query(SalesReturn).options(joinedload(SalesReturn.lines)).filter(SalesReturn.id == ret_id).first()
    if not ret:
        raise HTTPException(404, "Return not found")
    if ret.status == "POSTED":
        raise HTTPException(400, "Already posted")

    je_lines = []
    for ln in ret.lines:
        product = db.query(Product).filter(Product.id == ln.product_id).first()
        inv_svc.receive(
            db, product, ret.location_id, ln.qty_returned, ln.unit_cost,
            txn_type="SO_RETURN", ref_type="SRET", ref_id=ret.id, ref_line=ln.id,
            txn_date=ret.return_date, created_by=current_user.id,
        )
        je_lines.append({"product": product, "qty": ln.qty_returned,
                          "unit_cost": ln.unit_cost, "unit_price": ln.unit_price})

    je = post_svc.post_sales_return(db, ret, je_lines, created_by=current_user.id)
    ret.je_id = je.id
    ret.status = "POSTED"
    db.commit()
    db.refresh(ret)
    return ret

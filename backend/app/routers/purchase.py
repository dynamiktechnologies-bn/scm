from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.dependencies import get_current_user
from app.models.purchase import (
    PurchaseRequisition, PRLine,
    PurchaseOrder, POLine,
    GoodsReceipt, GRNLine,
    SupplierInvoice,
    PurchaseReturn, PurchaseReturnLine,
)
from app.models.product import Product
from app.schemas.purchase import (
    PRCreate, PROut,
    POCreate, POUpdate, POOut,
    GRNCreate, GRNOut,
    SupplierInvoiceCreate, SupplierInvoiceOut,
    PurchaseReturnCreate, PurchaseReturnOut,
)
from app.services.number_service import next_number
from app.services import inventory_service as inv_svc
from app.services import posting_service as post_svc
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/purchase", tags=["purchase"])


# ── Purchase Requisitions ────────────────────────────────────────────────────

@router.get("/requisitions", response_model=list[PROut])
def list_prs(status: str | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(PurchaseRequisition).options(joinedload(PurchaseRequisition.lines).joinedload(PRLine.product))
    if status:
        q = q.filter(PurchaseRequisition.status == status)
    return q.order_by(PurchaseRequisition.id.desc()).all()


@router.post("/requisitions", response_model=PROut, status_code=201)
def create_pr(body: PRCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    pr = PurchaseRequisition(
        pr_number=next_number(db, "PR"),
        required_date=body.required_date,
        notes=body.notes,
        requested_by=current_user.id,
    )
    db.add(pr)
    db.flush()
    for line in body.lines:
        db.add(PRLine(pr_id=pr.id, **line.model_dump()))
    db.commit()
    db.refresh(pr)
    return pr


@router.get("/requisitions/{pr_id}", response_model=PROut)
def get_pr(pr_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pr = db.query(PurchaseRequisition).options(joinedload(PurchaseRequisition.lines)).filter(PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")
    return pr


@router.post("/requisitions/{pr_id}/submit", response_model=PROut)
def submit_pr(pr_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")
    if pr.status != "DRAFT":
        raise HTTPException(400, f"Cannot submit PR in status {pr.status}")
    pr.status = "SUBMITTED"
    db.commit()
    db.refresh(pr)
    return pr


@router.post("/requisitions/{pr_id}/approve", response_model=PROut)
def approve_pr(pr_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    pr = db.query(PurchaseRequisition).filter(PurchaseRequisition.id == pr_id).first()
    if not pr:
        raise HTTPException(404, "PR not found")
    if pr.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot approve PR in status {pr.status}")
    pr.status = "APPROVED"
    pr.approved_by = current_user.id
    db.commit()
    db.refresh(pr)
    return pr


# ── Purchase Orders ──────────────────────────────────────────────────────────

def _calc_po_totals(lines: list[POLine]) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum(ln.qty_ordered * ln.unit_price for ln in lines)
    tax = sum(ln.qty_ordered * ln.unit_price * ln.tax_rate for ln in lines)
    return subtotal, tax, subtotal + tax


@router.get("/orders", response_model=list[POOut])
def list_pos(po_status: str | None = None, supplier_id: int | None = None,
             db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.lines).joinedload(POLine.product))
    if po_status:
        q = q.filter(PurchaseOrder.status == po_status)
    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)
    return q.order_by(PurchaseOrder.id.desc()).all()


@router.post("/orders", response_model=POOut, status_code=201)
def create_po(body: POCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    po = PurchaseOrder(
        po_number=next_number(db, "PO"),
        supplier_id=body.supplier_id,
        pr_id=body.pr_id,
        order_date=body.order_date,
        expected_date=body.expected_date,
        currency=body.currency,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(po)
    db.flush()
    po_lines = []
    for ln in body.lines:
        pol = POLine(po_id=po.id, **ln.model_dump())
        db.add(pol)
        po_lines.append(pol)
    db.flush()
    po.subtotal, po.tax_amount, po.total_amount = _calc_po_totals(po_lines)
    db.commit()
    db.refresh(po)
    return po


@router.get("/orders/{po_id}", response_model=POOut)
def get_po(po_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    po = db.query(PurchaseOrder).options(joinedload(PurchaseOrder.lines).joinedload(POLine.product)).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    return po


@router.put("/orders/{po_id}", response_model=POOut)
def update_po(po_id: int, body: POUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    if po.status not in ("DRAFT",):
        raise HTTPException(400, "Only DRAFT POs can be updated")
    if body.expected_date is not None:
        po.expected_date = body.expected_date
    if body.notes is not None:
        po.notes = body.notes
    if body.lines is not None:
        for old in po.lines:
            db.delete(old)
        db.flush()
        new_lines = []
        for ln in body.lines:
            pol = POLine(po_id=po.id, **ln.model_dump())
            db.add(pol)
            new_lines.append(pol)
        db.flush()
        po.subtotal, po.tax_amount, po.total_amount = _calc_po_totals(new_lines)
    db.commit()
    db.refresh(po)
    return po


def _set_po_status(db, po_id, new_status, allowed_from):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    if po.status not in allowed_from:
        raise HTTPException(400, f"Cannot transition PO from {po.status} to {new_status}")
    po.status = new_status
    db.commit()
    db.refresh(po)
    return po


@router.post("/orders/{po_id}/submit", response_model=POOut)
def submit_po(po_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    if po.status != "DRAFT":
        raise HTTPException(400, f"Cannot submit PO in status {po.status}")

    # Change status to SUBMITTED
    po.status = "SUBMITTED"
    db.commit()

    # Create approval records for the configured workflow
    workflow = ApprovalService.get_workflow(db, "PO", po.total_amount)
    if workflow:
        ApprovalService.create_approval_records(db, workflow.id, "PO", po.id, po.po_number)

    db.refresh(po)
    return po


@router.post("/orders/{po_id}/approve", response_model=POOut)
def approve_po(po_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Approve a PO at the current approval step.

    This uses the approval workflow. Once all approvals are complete, the PO status changes to APPROVED.
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(404, "PO not found")
    if po.status != "SUBMITTED":
        raise HTTPException(400, f"Cannot approve PO in status {po.status}")

    try:
        # Approve at current step in the workflow
        all_approved = ApprovalService.approve_document(
            db, "PO", po_id, current_user.id, current_user.role
        )

        # If all approvals are complete, update PO status
        if all_approved:
            po.status = "APPROVED"
            db.commit()

        db.refresh(po)
        return po
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/orders/{po_id}/cancel", response_model=POOut)
def cancel_po(po_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _set_po_status(db, po_id, "CANCELLED", ["DRAFT", "SUBMITTED", "APPROVED"])


# ── Goods Receipts ───────────────────────────────────────────────────────────

@router.get("/receipts", response_model=list[GRNOut])
def list_grns(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(GoodsReceipt).options(joinedload(GoodsReceipt.lines).joinedload(GRNLine.product)).order_by(GoodsReceipt.id.desc()).all()


@router.post("/receipts", response_model=GRNOut, status_code=201)
def create_grn(body: GRNCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    grn = GoodsReceipt(
        grn_number=next_number(db, "GRN"),
        po_id=body.po_id,
        supplier_id=body.supplier_id,
        location_id=body.location_id,
        receipt_date=body.receipt_date,
        supplier_ref=body.supplier_ref,
        created_by=current_user.id,
    )
    db.add(grn)
    db.flush()
    for ln in body.lines:
        db.add(GRNLine(grn_id=grn.id, **ln.model_dump()))
    db.commit()
    db.refresh(grn)
    return grn


@router.get("/receipts/{grn_id}", response_model=GRNOut)
def get_grn(grn_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    grn = db.query(GoodsReceipt).options(joinedload(GoodsReceipt.lines).joinedload(GRNLine.product)).filter(GoodsReceipt.id == grn_id).first()
    if not grn:
        raise HTTPException(404, "GRN not found")
    return grn


@router.post("/receipts/{grn_id}/post", response_model=GRNOut)
def post_grn(grn_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    grn = db.query(GoodsReceipt).options(joinedload(GoodsReceipt.lines)).filter(GoodsReceipt.id == grn_id).first()
    if not grn:
        raise HTTPException(404, "GRN not found")
    if grn.status == "POSTED":
        raise HTTPException(400, "GRN already posted")

    je_lines = []
    for grn_line in grn.lines:
        product = db.query(Product).filter(Product.id == grn_line.product_id).first()
        it = inv_svc.receive(
            db, product, grn.location_id,
            grn_line.qty_received, grn_line.unit_cost,
            txn_type="GRN_RECEIPT",
            ref_type="GRN", ref_id=grn.id, ref_line=grn_line.id,
            txn_date=grn.receipt_date, created_by=current_user.id,
        )
        grn_line.it_id = it.id
        je_lines.append({"product": product, "qty": grn_line.qty_received, "unit_cost": grn_line.unit_cost})

        # Update PO received qty
        if grn_line.po_line_id:
            pol = db.query(POLine).filter(POLine.id == grn_line.po_line_id).first()
            if pol:
                pol.qty_received += grn_line.qty_received

    je = post_svc.post_grn(db, grn, je_lines, created_by=current_user.id)
    grn.je_id = je.id
    grn.status = "POSTED"

    # Update PO status
    if grn.po_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == grn.po_id).first()
        if po:
            all_received = all(ln.qty_received >= ln.qty_ordered for ln in po.lines)
            po.status = "FULLY_RECEIVED" if all_received else "PARTIALLY_RECEIVED"

    db.commit()
    db.refresh(grn)
    return grn


# ── Supplier Invoices ────────────────────────────────────────────────────────

@router.get("/invoices", response_model=list[SupplierInvoiceOut])
def list_invoices(supplier_id: int | None = None, db: Session = Depends(get_db), _=Depends(get_current_user)):
    q = db.query(SupplierInvoice)
    if supplier_id:
        q = q.filter(SupplierInvoice.supplier_id == supplier_id)
    return q.order_by(SupplierInvoice.id.desc()).all()


@router.post("/invoices", response_model=SupplierInvoiceOut, status_code=201)
def create_invoice(body: SupplierInvoiceCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inv = SupplierInvoice(**body.model_dump())
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/invoices/{inv_id}", response_model=SupplierInvoiceOut)
def get_invoice(inv_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    inv = db.query(SupplierInvoice).filter(SupplierInvoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.post("/invoices/{inv_id}/match", response_model=SupplierInvoiceOut)
def match_invoice(inv_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    inv = db.query(SupplierInvoice).filter(SupplierInvoice.id == inv_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.status != "RECEIVED":
        raise HTTPException(400, f"Invoice already in status {inv.status}")
    # Eagerly load supplier for AP account
    from sqlalchemy.orm import joinedload
    inv = db.query(SupplierInvoice).options(joinedload(SupplierInvoice.supplier)).filter(SupplierInvoice.id == inv_id).first()
    je = post_svc.post_supplier_invoice(db, inv, created_by=current_user.id)
    inv.je_id = je.id
    inv.status = "MATCHED"
    db.commit()
    db.refresh(inv)
    return inv


# ── Purchase Returns ─────────────────────────────────────────────────────────

@router.get("/returns", response_model=list[PurchaseReturnOut])
def list_purchase_returns(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(PurchaseReturn).order_by(PurchaseReturn.id.desc()).all()


@router.post("/returns", response_model=PurchaseReturnOut, status_code=201)
def create_purchase_return(body: PurchaseReturnCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ret = PurchaseReturn(
        return_number=next_number(db, "PRET"),
        grn_id=body.grn_id,
        supplier_id=body.supplier_id,
        location_id=body.location_id,
        return_date=body.return_date,
        reason=body.reason,
    )
    db.add(ret)
    db.flush()
    for ln in body.lines:
        db.add(PurchaseReturnLine(return_id=ret.id, **ln.model_dump()))
    db.commit()
    db.refresh(ret)
    return ret


@router.post("/returns/{ret_id}/post", response_model=PurchaseReturnOut)
def post_purchase_return(ret_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    from sqlalchemy.orm import joinedload
    ret = db.query(PurchaseReturn).options(joinedload(PurchaseReturn.lines)).filter(PurchaseReturn.id == ret_id).first()
    if not ret:
        raise HTTPException(404, "Return not found")
    if ret.status == "POSTED":
        raise HTTPException(400, "Already posted")

    je_lines = []
    for ln in ret.lines:
        product = db.query(Product).filter(Product.id == ln.product_id).first()
        inv_svc.issue(
            db, product, ret.location_id, ln.qty_returned,
            txn_type="GRN_RETURN", ref_type="PRET", ref_id=ret.id, ref_line=ln.id,
            txn_date=ret.return_date, created_by=current_user.id,
        )
        je_lines.append({"product": product, "qty": ln.qty_returned, "unit_cost": ln.unit_cost})

    je = post_svc.post_purchase_return(db, ret, je_lines, created_by=current_user.id)
    ret.je_id = je.id
    ret.status = "POSTED"
    db.commit()
    db.refresh(ret)
    return ret

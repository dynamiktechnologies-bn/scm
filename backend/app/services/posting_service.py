"""Double-entry journal entry builder.

Every public function returns a posted JournalEntry.
All functions must be called inside an active DB transaction — they flush but do not commit.
"""
from decimal import Decimal
from datetime import date, datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.accounting import Account, JournalEntry, JournalLine


def _account(db: Session, code: str) -> Account:
    acct = db.query(Account).filter(Account.code == code, Account.is_active == True).first()
    if not acct:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Account {code!r} not found in COA")
    return acct


def _line(entry_id: int, account_id: int, debit: Decimal = Decimal("0"), credit: Decimal = Decimal("0"), desc: str | None = None) -> JournalLine:
    return JournalLine(entry_id=entry_id, account_id=account_id, debit=debit, credit=credit, description=desc)


def _assert_balanced(db: Session, je_id: int) -> None:
    total_dr, total_cr = db.query(
        func.sum(JournalLine.debit), func.sum(JournalLine.credit)
    ).filter(JournalLine.entry_id == je_id).one()
    dr = total_dr or Decimal("0")
    cr = total_cr or Decimal("0")
    if abs(dr - cr) > Decimal("0.01"):
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Journal entry {je_id} is not balanced (DR={dr} CR={cr})",
        )


def _new_je(db: Session, entry_date: date, reference: str, source_type: str, source_id: int,
            memo: str | None = None, created_by: int | None = None) -> JournalEntry:
    je = JournalEntry(
        entry_date=entry_date,
        reference=reference,
        memo=memo,
        source_type=source_type,
        source_id=source_id,
        is_posted=True,
        posted_at=datetime.now(timezone.utc),
        created_by=created_by,
    )
    db.add(je)
    db.flush()
    return je


# ── GRN: DR Inventory  CR Inventory Received (accrual) ──────────────────────
def post_grn(db: Session, grn, lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """lines = [{"product": Product, "qty": Decimal, "unit_cost": Decimal}]"""
    je = _new_je(db, grn.receipt_date, grn.grn_number, "GRN", grn.id,
                 memo=f"Goods receipt from supplier {grn.supplier_id}", created_by=created_by)

    accrual = _account(db, "1210")
    for line in lines:
        cost = line["qty"] * line["unit_cost"]
        inv_acct_id = line["product"].inventory_account_id
        if not inv_acct_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"Product {line['product'].sku} has no inventory account")
        db.add(_line(je.id, inv_acct_id, debit=cost, desc=f"GRN {grn.grn_number} - {line['product'].sku}"))
        db.add(_line(je.id, accrual.id, credit=cost))

    _assert_balanced(db, je.id)
    return je


# ── Supplier Invoice: DR Inventory Received  CR Accounts Payable ─────────────
def post_supplier_invoice(db: Session, inv, created_by: int | None = None) -> JournalEntry:
    je = _new_je(db, inv.invoice_date, inv.inv_number, "SUPPLIER_INVOICE", inv.id,
                 memo=f"Supplier invoice {inv.inv_number}", created_by=created_by)

    accrual = _account(db, "1210")
    ap_id = inv.supplier.ap_account_id
    if not ap_id:
        ap_id = _account(db, "2100").id
    db.add(_line(je.id, accrual.id, debit=inv.total_amount))
    db.add(_line(je.id, ap_id, credit=inv.total_amount))

    _assert_balanced(db, je.id)
    return je


# ── Shipment COGS: DR COGS  CR Inventory ────────────────────────────────────
def post_shipment_cogs(db: Session, shipment, cogs_lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """cogs_lines = [{"product": Product, "qty": Decimal, "unit_cost": Decimal}]"""
    je = _new_je(db, shipment.ship_date, shipment.shipment_number, "SHIPMENT_COGS", shipment.id,
                 memo=f"COGS for shipment {shipment.shipment_number}", created_by=created_by)

    for line in cogs_lines:
        cost = line["qty"] * line["unit_cost"]
        cogs_id = line["product"].cogs_account_id
        inv_id = line["product"].inventory_account_id
        if not cogs_id or not inv_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"Product {line['product'].sku} missing COGS/Inventory account")
        db.add(_line(je.id, cogs_id, debit=cost, desc=f"SHIP {shipment.shipment_number}"))
        db.add(_line(je.id, inv_id, credit=cost))

    _assert_balanced(db, je.id)
    return je


# ── Shipment Revenue: DR AR  CR Revenue ─────────────────────────────────────
def post_shipment_revenue(db: Session, shipment, revenue_lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """revenue_lines = [{"product": Product, "qty": Decimal, "unit_price": Decimal}]"""
    je = _new_je(db, shipment.ship_date, shipment.shipment_number, "SHIPMENT_REVENUE", shipment.id,
                 memo=f"Revenue for shipment {shipment.shipment_number}", created_by=created_by)

    ar = _account(db, "1300")
    for line in revenue_lines:
        revenue = line["qty"] * line["unit_price"]
        rev_id = line["product"].revenue_account_id
        if not rev_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"Product {line['product'].sku} has no revenue account")
        db.add(_line(je.id, ar.id, debit=revenue, desc=f"SHIP {shipment.shipment_number}"))
        db.add(_line(je.id, rev_id, credit=revenue))

    _assert_balanced(db, je.id)
    return je


# ── Inventory Adjustment ─────────────────────────────────────────────────────
def post_adjustment(db: Session, adj, lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """lines = [{"product": Product, "variance_qty": Decimal, "unit_cost": Decimal}]
    variance_qty = qty_actual - qty_system (positive = gain, negative = loss)
    """
    je = _new_je(db, adj.adj_date, adj.adj_number, "ADJUSTMENT", adj.id,
                 memo=f"Inventory adjustment {adj.adj_number}", created_by=created_by)

    adj_exp = _account(db, "6100")
    for line in lines:
        variance = line["variance_qty"] * line["unit_cost"]
        inv_id = line["product"].inventory_account_id
        if not inv_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"Product {line['product'].sku} has no inventory account")
        if variance > 0:  # gain
            db.add(_line(je.id, inv_id, debit=variance))
            db.add(_line(je.id, adj_exp.id, credit=variance))
        elif variance < 0:  # loss
            db.add(_line(je.id, adj_exp.id, debit=abs(variance)))
            db.add(_line(je.id, inv_id, credit=abs(variance)))

    _assert_balanced(db, je.id)
    return je


# ── Purchase Return ──────────────────────────────────────────────────────────
def post_purchase_return(db: Session, ret, lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """lines = [{"product": Product, "qty": Decimal, "unit_cost": Decimal}]"""
    je = _new_je(db, ret.return_date, ret.return_number, "PURCHASE_RETURN", ret.id,
                 memo=f"Purchase return {ret.return_number}", created_by=created_by)

    accrual = _account(db, "1210")
    for line in lines:
        cost = line["qty"] * line["unit_cost"]
        inv_id = line["product"].inventory_account_id
        db.add(_line(je.id, accrual.id, debit=cost))
        db.add(_line(je.id, inv_id, credit=cost))

    _assert_balanced(db, je.id)
    return je


# ── Sales Return ─────────────────────────────────────────────────────────────
def post_sales_return(db: Session, ret, lines: list[dict], created_by: int | None = None) -> JournalEntry:
    """Reverses COGS and Revenue on return.
    lines = [{"product": Product, "qty": Decimal, "unit_cost": Decimal, "unit_price": Decimal}]
    """
    je = _new_je(db, ret.return_date, ret.return_number, "SALES_RETURN", ret.id,
                 memo=f"Sales return {ret.return_number}", created_by=created_by)

    ar = _account(db, "1300")
    for line in lines:
        cost = line["qty"] * line["unit_cost"]
        revenue = line["qty"] * line["unit_price"]
        inv_id = line["product"].inventory_account_id
        cogs_id = line["product"].cogs_account_id
        rev_id = line["product"].revenue_account_id
        # Reverse COGS
        db.add(_line(je.id, inv_id, debit=cost))
        db.add(_line(je.id, cogs_id, credit=cost))
        # Reverse Revenue
        db.add(_line(je.id, rev_id, debit=revenue))
        db.add(_line(je.id, ar.id, credit=revenue))

    _assert_balanced(db, je.id)
    return je

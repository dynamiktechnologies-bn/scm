"""Demo seed script.

Usage:
  cd backend
  cp .env.example .env          # fill in your DB credentials
  python -m alembic upgrade head
  python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from decimal import Decimal
from passlib.context import CryptContext
from app.database import SessionLocal
from app.models.user import User
from app.models.accounting import Account
from app.models.party import Supplier, Customer
from app.models.product import UoM, Product
from app.models.warehouse import Warehouse, Location
from app.models.inventory import InventoryTransaction
from app.models.approval import ApprovalWorkflow, ApprovalStep

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed():
    db = SessionLocal()
    try:
        _seed(db)
        db.commit()
        print("✓ Seed complete.")
    except Exception as e:
        db.rollback()
        print(f"✗ Seed failed: {e}")
        raise
    finally:
        db.close()


def _seed(db):
    # ── Users ──────────────────────────────────────────────────────────────
    admin = User(
        email="admin@scm.example.com",
        hashed_password=pwd_ctx.hash("admin123"),
        full_name="Admin User",
        role="ADMIN",
    )
    db.add(admin)
    db.flush()

    # ── Chart of Accounts ──────────────────────────────────────────────────
    coa = [
        ("1100", "Cash",                          "ASSET",     "D"),
        ("1200", "Inventory Asset",               "ASSET",     "D"),
        ("1210", "Inventory Received / Accrual",  "LIABILITY", "C"),
        ("1300", "Accounts Receivable",           "ASSET",     "D"),
        ("2100", "Accounts Payable",              "LIABILITY", "C"),
        ("3000", "Retained Earnings",             "EQUITY",    "C"),
        ("4000", "Sales Revenue",                 "REVENUE",   "C"),
        ("4100", "Sales Returns & Allowances",    "REVENUE",   "D"),
        ("5000", "Cost of Goods Sold",            "EXPENSE",   "D"),
        ("6100", "Inventory Adjustment Expense",  "EXPENSE",   "D"),
    ]
    accts = {}
    for code, name, atype, ns in coa:
        a = Account(code=code, name=name, account_type=atype, normal_side=ns)
        db.add(a)
        accts[code] = a
    db.flush()

    # ── Warehouse & Location ───────────────────────────────────────────────
    wh = Warehouse(code="WH01", name="Main Warehouse")
    db.add(wh)
    db.flush()
    loc = Location(warehouse_id=wh.id, code="BIN-A1", name="Aisle A - Bin 1")
    db.add(loc)
    db.flush()

    # ── Units of Measure ──────────────────────────────────────────────────
    ea  = UoM(code="EA",  name="Each")
    kg  = UoM(code="KG",  name="Kilogram")
    ltr = UoM(code="LTR", name="Litre")
    box = UoM(code="BOX", name="Box")
    db.add_all([ea, kg, ltr, box])
    db.flush()

    # ── Suppliers ─────────────────────────────────────────────────────────
    sup1 = Supplier(
        code="SUP001", name="Acme Components Ltd",
        contact_email="orders@acme.example",
        phone="+1-555-0101", address="123 Factory Rd, Detroit MI",
        payment_terms=30, ap_account_id=accts["2100"].id,
    )
    sup2 = Supplier(
        code="SUP002", name="Global Parts Inc.",
        contact_email="supply@globalparts.example",
        phone="+1-555-0202", address="456 Industrial Ave, Chicago IL",
        payment_terms=45, ap_account_id=accts["2100"].id,
    )
    db.add_all([sup1, sup2])
    db.flush()

    # ── Customers ─────────────────────────────────────────────────────────
    cust1 = Customer(
        code="CUST001", name="Riverside Engineering",
        contact_email="purchasing@riverside.example",
        phone="+1-555-0301", credit_limit=Decimal("50000"),
        ar_account_id=accts["1300"].id,
    )
    cust2 = Customer(
        code="CUST002", name="Skyline Manufacturing",
        contact_email="orders@skyline.example",
        phone="+1-555-0302", credit_limit=Decimal("100000"),
        ar_account_id=accts["1300"].id,
    )
    db.add_all([cust1, cust2])
    db.flush()

    # ── Products ──────────────────────────────────────────────────────────
    def make_product(sku, name, uom, supplier, avg_cost, reorder_pt, reorder_qty, method="WAVG"):
        return Product(
            sku=sku, name=name, uom_id=uom.id,
            preferred_supplier_id=supplier.id,
            valuation_method=method,
            inventory_account_id=accts["1200"].id,
            cogs_account_id=accts["5000"].id,
            revenue_account_id=accts["4000"].id,
            current_avg_cost=Decimal(str(avg_cost)),
            reorder_point=Decimal(str(reorder_pt)),
            reorder_qty=Decimal(str(reorder_qty)),
        )

    p1 = make_product("WIDGET-A",  "Widget Type A",         ea,  sup1, 10.00, 50,  200)
    p2 = make_product("WIDGET-B",  "Widget Type B",         ea,  sup1, 15.00, 30,  150)
    p3 = make_product("BOLT-M6",   "M6 Hex Bolt (pack/100)",box, sup2,  8.50, 20,  100)
    p4 = make_product("LUBRICANT", "Industrial Lubricant",  ltr, sup2, 12.00, 10,   50, method="FIFO")
    db.add_all([p1, p2, p3, p4])
    db.flush()

    # ── Opening Stock Transactions ────────────────────────────────────────
    today = date.today()
    openings = [
        (p1, 100, Decimal("10.00")),
        (p2,  60, Decimal("15.00")),
        (p3,  40, Decimal("8.50")),
        (p4,  25, Decimal("12.00")),
    ]
    for product, qty, cost in openings:
        db.add(InventoryTransaction(
            product_id=product.id, location_id=loc.id,
            txn_type="GRN_RECEIPT", reference_type="OPENING",
            qty=Decimal(str(qty)), direction=1, unit_cost=cost,
            txn_date=today,
        ))

    # ── Approval Workflows ─────────────────────────────────────────────────
    po_wf = ApprovalWorkflow(
        document_type="PO",
        name="Purchase Order Approval",
        amount_threshold=Decimal("5000.00"),  # >$5000 requires director approval
    )
    db.add(po_wf)
    db.flush()

    # 2-level PO approval
    db.add(ApprovalStep(workflow_id=po_wf.id, step_number=1, required_role="MANAGER", description="Manager approval"))
    db.add(ApprovalStep(workflow_id=po_wf.id, step_number=2, required_role="DIRECTOR", description="Director approval"))

    # GRN single-level approval
    grn_wf = ApprovalWorkflow(document_type="GRN", name="Goods Receipt Approval")
    db.add(grn_wf)
    db.flush()
    db.add(ApprovalStep(workflow_id=grn_wf.id, step_number=1, required_role="MANAGER", description="Receipt verification"))

    # SO approval
    so_wf = ApprovalWorkflow(document_type="SO", name="Sales Order Approval")
    db.add(so_wf)
    db.flush()
    db.add(ApprovalStep(workflow_id=so_wf.id, step_number=1, required_role="MANAGER", description="Sales manager review"))
    db.add(ApprovalStep(workflow_id=so_wf.id, step_number=2, required_role="FINANCE_DIRECTOR", description="Credit check", is_optional=True))

    print(f"  Users:        1 (admin@scm.example.com / admin123)")
    print(f"  Accounts:     {len(coa)}")
    print(f"  Suppliers:    2   Customers: 2")
    print(f"  Products:     4 with opening stock")
    print(f"  Workflows:    3 (PO, GRN, SO)")


if __name__ == "__main__":
    seed()

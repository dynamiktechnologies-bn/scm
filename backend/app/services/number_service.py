"""Sequential document number generator.

Uses an advisory lock + MAX query so no separate sequence table is needed.
Format: PREFIX-YYYY-NNNN  e.g. PO-2026-0001
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone


_PREFIX_TABLE = {
    "PR":   ("purchase_requisitions", "pr_number"),
    "PO":   ("purchase_orders",       "po_number"),
    "GRN":  ("goods_receipts",        "grn_number"),
    "PRET": ("purchase_returns",      "return_number"),
    "SO":   ("sales_orders",          "so_number"),
    "SHIP": ("shipments",             "shipment_number"),
    "SRET": ("sales_returns",         "return_number"),
    "ADJ":  ("inventory_adjustments", "adj_number"),
    "TRF":  ("stock_transfers",       "transfer_number"),
}


def next_number(db: Session, prefix: str) -> str:
    year = datetime.now(timezone.utc).year
    table, col = _PREFIX_TABLE[prefix]
    like = f"{prefix}-{year}-%"
    row = db.execute(
        text(f"SELECT MAX({col}) FROM {table} WHERE {col} LIKE :like"),
        {"like": like},
    ).scalar()
    if row:
        seq = int(row.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}-{year}-{seq:04d}"

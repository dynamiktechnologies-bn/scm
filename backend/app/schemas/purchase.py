from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.product import ProductOut


class PRLineCreate(BaseModel):
    product_id: int
    qty_requested: Decimal
    notes: str | None = None


class PRLineOut(BaseModel):
    id: int
    product_id: int
    product: ProductOut | None = None
    qty_requested: Decimal
    notes: str | None

    model_config = {"from_attributes": True}


class PRCreate(BaseModel):
    required_date: date | None = None
    notes: str | None = None
    lines: list[PRLineCreate]


class PROut(BaseModel):
    id: int
    pr_number: str
    status: str
    requested_by: int | None
    required_date: date | None
    notes: str | None
    lines: list[PRLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class POLineCreate(BaseModel):
    product_id: int
    qty_ordered: Decimal
    unit_price: Decimal
    tax_rate: Decimal = Decimal("0")
    notes: str | None = None


class POLineOut(BaseModel):
    id: int
    product_id: int
    product: ProductOut | None = None
    qty_ordered: Decimal
    qty_received: Decimal
    unit_price: Decimal
    tax_rate: Decimal
    notes: str | None

    model_config = {"from_attributes": True}


class POCreate(BaseModel):
    supplier_id: int
    pr_id: int | None = None
    order_date: date
    expected_date: date | None = None
    currency: str = "USD"
    notes: str | None = None
    lines: list[POLineCreate]


class POUpdate(BaseModel):
    expected_date: date | None = None
    notes: str | None = None
    lines: list[POLineCreate] | None = None


class POOut(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    pr_id: int | None
    status: str
    order_date: date
    expected_date: date | None
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    notes: str | None
    lines: list[POLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class GRNLineCreate(BaseModel):
    po_line_id: int | None = None
    product_id: int
    qty_received: Decimal
    unit_cost: Decimal


class GRNLineOut(BaseModel):
    id: int
    po_line_id: int | None
    product_id: int
    product: ProductOut | None = None
    qty_received: Decimal
    unit_cost: Decimal
    it_id: int | None

    model_config = {"from_attributes": True}


class GRNCreate(BaseModel):
    po_id: int | None = None
    supplier_id: int
    location_id: int
    receipt_date: date
    supplier_ref: str | None = None
    lines: list[GRNLineCreate]


class GRNOut(BaseModel):
    id: int
    grn_number: str
    po_id: int | None
    supplier_id: int
    location_id: int
    status: str
    receipt_date: date
    supplier_ref: str | None
    je_id: int | None
    lines: list[GRNLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierInvoiceCreate(BaseModel):
    inv_number: str
    supplier_id: int
    grn_id: int | None = None
    po_id: int | None = None
    invoice_date: date
    due_date: date | None = None
    subtotal: Decimal
    tax_amount: Decimal = Decimal("0")
    total_amount: Decimal


class SupplierInvoiceOut(BaseModel):
    id: int
    inv_number: str
    supplier_id: int
    grn_id: int | None
    po_id: int | None
    status: str
    invoice_date: date
    due_date: date | None
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    je_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PurchaseReturnLineCreate(BaseModel):
    grn_line_id: int | None = None
    product_id: int
    qty_returned: Decimal
    unit_cost: Decimal


class PurchaseReturnCreate(BaseModel):
    grn_id: int
    supplier_id: int
    location_id: int
    return_date: date
    reason: str | None = None
    lines: list[PurchaseReturnLineCreate]


class PurchaseReturnOut(BaseModel):
    id: int
    return_number: str
    grn_id: int
    supplier_id: int
    location_id: int
    status: str
    return_date: date
    reason: str | None
    je_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}

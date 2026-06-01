from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.product import ProductOut


class SOLineCreate(BaseModel):
    product_id: int
    qty_ordered: Decimal
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")
    notes: str | None = None


class SOLineOut(BaseModel):
    id: int
    product_id: int
    product: ProductOut | None = None
    qty_ordered: Decimal
    qty_shipped: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    tax_rate: Decimal
    notes: str | None
    qty_available: Decimal | None = None  # injected at query time

    model_config = {"from_attributes": True}


class SOCreate(BaseModel):
    customer_id: int
    order_date: date
    required_date: date | None = None
    currency: str = "USD"
    notes: str | None = None
    lines: list[SOLineCreate]


class SOUpdate(BaseModel):
    required_date: date | None = None
    notes: str | None = None
    lines: list[SOLineCreate] | None = None


class SOOut(BaseModel):
    id: int
    so_number: str
    customer_id: int
    status: str
    order_date: date
    required_date: date | None
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    notes: str | None
    lines: list[SOLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ShipmentLineCreate(BaseModel):
    so_line_id: int | None = None
    product_id: int
    qty_shipped: Decimal
    unit_price: Decimal


class ShipmentLineOut(BaseModel):
    id: int
    so_line_id: int | None
    product_id: int
    product: ProductOut | None = None
    qty_shipped: Decimal
    unit_price: Decimal
    unit_cost: Decimal
    it_id: int | None

    model_config = {"from_attributes": True}


class ShipmentCreate(BaseModel):
    so_id: int
    location_id: int
    ship_date: date
    carrier: str | None = None
    tracking_ref: str | None = None
    lines: list[ShipmentLineCreate]


class ShipmentOut(BaseModel):
    id: int
    shipment_number: str
    so_id: int
    customer_id: int
    location_id: int
    status: str
    ship_date: date
    carrier: str | None
    tracking_ref: str | None
    cogs_je_id: int | None
    sales_je_id: int | None
    lines: list[ShipmentLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SalesReturnLineCreate(BaseModel):
    shipment_line_id: int | None = None
    product_id: int
    qty_returned: Decimal
    unit_price: Decimal
    unit_cost: Decimal


class SalesReturnCreate(BaseModel):
    shipment_id: int
    location_id: int
    return_date: date
    reason: str | None = None
    lines: list[SalesReturnLineCreate]


class SalesReturnOut(BaseModel):
    id: int
    return_number: str
    shipment_id: int
    customer_id: int
    location_id: int
    status: str
    return_date: date
    reason: str | None
    je_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}

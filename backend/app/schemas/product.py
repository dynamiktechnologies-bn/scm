from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class UoMOut(BaseModel):
    id: int
    code: str
    name: str

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    sku: str
    name: str
    description: str | None = None
    uom_id: int
    reorder_point: Decimal = Decimal("0")
    reorder_qty: Decimal = Decimal("0")
    preferred_supplier_id: int | None = None
    valuation_method: str = "WAVG"
    inventory_account_id: int | None = None
    cogs_account_id: int | None = None
    revenue_account_id: int | None = None
    current_avg_cost: Decimal = Decimal("0")


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    uom_id: int | None = None
    reorder_point: Decimal | None = None
    reorder_qty: Decimal | None = None
    preferred_supplier_id: int | None = None
    valuation_method: str | None = None
    inventory_account_id: int | None = None
    cogs_account_id: int | None = None
    revenue_account_id: int | None = None
    is_active: bool | None = None


class ProductOut(BaseModel):
    id: int
    sku: str
    name: str
    description: str | None
    uom_id: int
    uom: UoMOut | None = None
    reorder_point: Decimal
    reorder_qty: Decimal
    preferred_supplier_id: int | None
    valuation_method: str
    inventory_account_id: int | None
    cogs_account_id: int | None
    revenue_account_id: int | None
    current_avg_cost: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StockBalance(BaseModel):
    product_id: int
    sku: str
    name: str
    location_id: int
    location_code: str
    warehouse_name: str
    qty_on_hand: Decimal
    avg_cost: Decimal
    inventory_value: Decimal

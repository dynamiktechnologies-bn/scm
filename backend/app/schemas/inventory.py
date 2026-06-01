from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class InventoryTransactionOut(BaseModel):
    id: int
    product_id: int
    product_sku: str | None = None
    product_name: str | None = None
    location_id: int
    txn_type: str
    reference_type: str | None
    reference_id: int | None
    qty: Decimal
    direction: int
    unit_cost: Decimal
    txn_date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdjustmentLineCreate(BaseModel):
    product_id: int
    qty_system: Decimal
    qty_actual: Decimal
    unit_cost: Decimal


class AdjustmentLineOut(BaseModel):
    id: int
    product_id: int
    qty_system: Decimal
    qty_actual: Decimal
    unit_cost: Decimal
    it_id: int | None

    model_config = {"from_attributes": True}


class AdjustmentCreate(BaseModel):
    location_id: int
    adj_date: date
    reason_code: str | None = None
    notes: str | None = None
    lines: list[AdjustmentLineCreate]


class AdjustmentOut(BaseModel):
    id: int
    adj_number: str
    location_id: int
    adj_date: date
    reason_code: str | None
    notes: str | None
    status: str
    je_id: int | None
    lines: list[AdjustmentLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TransferLineCreate(BaseModel):
    product_id: int
    qty: Decimal
    unit_cost: Decimal


class TransferLineOut(BaseModel):
    id: int
    product_id: int
    qty: Decimal
    unit_cost: Decimal
    out_it_id: int | None
    in_it_id: int | None

    model_config = {"from_attributes": True}


class TransferCreate(BaseModel):
    from_location_id: int
    to_location_id: int
    transfer_date: date
    notes: str | None = None
    lines: list[TransferLineCreate]


class TransferOut(BaseModel):
    id: int
    transfer_number: str
    from_location_id: int
    to_location_id: int
    transfer_date: date
    status: str
    notes: str | None
    lines: list[TransferLineOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}

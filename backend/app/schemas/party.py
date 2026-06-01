from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class SupplierCreate(BaseModel):
    code: str
    name: str
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None
    payment_terms: int = 30
    ap_account_id: int | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None
    payment_terms: int | None = None
    ap_account_id: int | None = None
    is_active: bool | None = None


class SupplierOut(BaseModel):
    id: int
    code: str
    name: str
    contact_email: str | None
    phone: str | None
    address: str | None
    payment_terms: int
    ap_account_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    code: str
    name: str
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None
    credit_limit: Decimal | None = None
    ar_account_id: int | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    phone: str | None = None
    address: str | None = None
    credit_limit: Decimal | None = None
    ar_account_id: int | None = None
    is_active: bool | None = None


class CustomerOut(BaseModel):
    id: int
    code: str
    name: str
    contact_email: str | None
    phone: str | None
    address: str | None
    credit_limit: Decimal | None
    ar_account_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}

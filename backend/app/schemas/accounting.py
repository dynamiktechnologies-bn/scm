from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel


class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    normal_side: str
    parent_id: int | None = None


class AccountOut(BaseModel):
    id: int
    code: str
    name: str
    account_type: str
    normal_side: str
    parent_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}


class JournalLineOut(BaseModel):
    id: int
    account_id: int
    account_code: str | None = None
    account_name: str | None = None
    debit: Decimal
    credit: Decimal
    description: str | None

    model_config = {"from_attributes": True}


class JournalEntryOut(BaseModel):
    id: int
    entry_date: date
    reference: str | None
    memo: str | None
    source_type: str | None
    source_id: int | None
    is_posted: bool
    posted_at: datetime | None
    lines: list[JournalLineOut] = []

    model_config = {"from_attributes": True}


class ManualJournalLineCreate(BaseModel):
    account_id: int
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: str | None = None


class ManualJournalCreate(BaseModel):
    entry_date: date
    reference: str | None = None
    memo: str | None = None
    lines: list[ManualJournalLineCreate]


class TrialBalanceLine(BaseModel):
    account_id: int
    code: str
    name: str
    account_type: str
    debit_total: Decimal
    credit_total: Decimal
    balance: Decimal

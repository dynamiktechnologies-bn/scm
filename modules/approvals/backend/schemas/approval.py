from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class ApprovalStepCreate(BaseModel):
    step_number: int
    required_role: str
    description: str | None = None
    is_optional: bool = False


class ApprovalStepOut(BaseModel):
    id: int
    step_number: int
    required_role: str
    description: str | None = None
    is_optional: bool
    model_config = {"from_attributes": True}


class ApprovalWorkflowCreate(BaseModel):
    document_type: str  # PO, GRN, SO, SHIPMENT, etc.
    name: str
    amount_threshold: Decimal | None = None
    steps: list[ApprovalStepCreate]


class ApprovalWorkflowOut(BaseModel):
    id: int
    document_type: str
    name: str
    amount_threshold: Decimal | None
    is_active: bool
    steps: list[ApprovalStepOut] = []
    model_config = {"from_attributes": True}


class ApprovalRecordOut(BaseModel):
    id: int
    document_type: str
    document_id: int
    step_id: int
    step_number: int | None = None
    required_role: str | None = None
    status: str  # PENDING, APPROVED, REJECTED
    approved_by: int | None
    approved_at: datetime | None
    notes: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class ApprovalAction(BaseModel):
    action: str  # APPROVE or REJECT
    notes: str | None = None


class ApprovalStatus(BaseModel):
    """Status of all approval steps for a document."""
    document_type: str
    document_id: int
    current_step: int  # Which step is pending (0 if all approved)
    total_steps: int
    steps_completed: int
    is_approved: bool
    records: list[ApprovalRecordOut] = []

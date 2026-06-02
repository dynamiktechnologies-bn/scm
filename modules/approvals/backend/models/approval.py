from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


class ApprovalWorkflow(Base):
    """Approval workflow configuration for a document type."""
    __tablename__ = "approval_workflows"

    id = Column(Integer, primary_key=True)
    document_type = Column(String(40), unique=True)  # PO, GRN, SO, SHIPMENT, SUPPLIER_INVOICE, etc.
    name = Column(String(120))  # "Purchase Order Approval"
    amount_threshold = Column(Numeric(15, 4), nullable=True)  # Optional: if amount > this, use next workflow level
    is_active = Column(Boolean, default=True)

    # Relationships
    steps = relationship("ApprovalStep", back_populates="workflow", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ApprovalWorkflow {self.document_type}>"


class ApprovalStep(Base):
    """A single step in an approval workflow."""
    __tablename__ = "approval_steps"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("approval_workflows.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer)  # 1, 2, 3, ...
    required_role = Column(String(40))  # MANAGER, DIRECTOR, FINANCE_DIRECTOR, etc.
    description = Column(String(200))  # e.g., "Manager approval"
    is_optional = Column(Boolean, default=False)  # Can be skipped if no user with this role exists

    # Relationships
    workflow = relationship("ApprovalWorkflow", back_populates="steps")
    records = relationship("ApprovalRecord", back_populates="step")

    def __repr__(self):
        return f"<ApprovalStep {self.step_number}: {self.required_role}>"


class ApprovalRecord(Base):
    """Tracks actual approval action taken on a document."""
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("approval_workflows.id"), nullable=False)
    step_id = Column(Integer, ForeignKey("approval_steps.id"), nullable=False)
    document_type = Column(String(40))  # PO, GRN, SO, SHIPMENT, etc.
    document_id = Column(Integer)  # ID of the document being approved
    status = Column(String(40))  # PENDING, APPROVED, REJECTED
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # User who approved/rejected
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text)  # Approval notes (e.g., "Approved with conditions")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    step = relationship("ApprovalStep", back_populates="records")
    approver = relationship("User", foreign_keys=[approved_by])

    def __repr__(self):
        return f"<ApprovalRecord {self.document_type}#{self.document_id} Step {self.step_id}: {self.status}>"

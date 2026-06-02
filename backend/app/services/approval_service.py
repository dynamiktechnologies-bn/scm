from sqlalchemy.orm import Session
from sqlalchemy import and_
from decimal import Decimal
from app.models.approval import ApprovalWorkflow, ApprovalStep, ApprovalRecord
from app.schemas.approval import ApprovalStatus, ApprovalRecordOut


class ApprovalService:
    """Manages document approval workflows."""

    @staticmethod
    def get_workflow(db: Session, document_type: str, amount: Decimal | None = None) -> ApprovalWorkflow | None:
        """Get the active approval workflow for a document type.

        If amount is provided and there's an amount_threshold, use it to determine
        which workflow level to apply. Currently returns a single workflow.
        """
        wf = db.query(ApprovalWorkflow).filter(
            and_(ApprovalWorkflow.document_type == document_type,
                 ApprovalWorkflow.is_active == True)
        ).first()
        return wf

    @staticmethod
    def create_approval_records(
        db: Session,
        workflow_id: int,
        document_type: str,
        document_id: int
    ) -> list[ApprovalRecord]:
        """Create approval records for each step in the workflow."""
        workflow = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
        if not workflow:
            return []

        records = []
        for step in workflow.steps:
            record = ApprovalRecord(
                workflow_id=workflow_id,
                step_id=step.id,
                document_type=document_type,
                document_id=document_id,
                status="PENDING" if not step.is_optional else "SKIPPED",
            )
            db.add(record)
            records.append(record)

        db.commit()
        return records

    @staticmethod
    def get_approval_status(
        db: Session,
        document_type: str,
        document_id: int
    ) -> ApprovalStatus | None:
        """Get the approval status for a document."""
        records = db.query(ApprovalRecord).filter(
            and_(ApprovalRecord.document_type == document_type,
                 ApprovalRecord.document_id == document_id)
        ).order_by(ApprovalRecord.step_id).all()

        if not records:
            return None

        pending_records = [r for r in records if r.status == "PENDING"]
        current_step = records[len(records) - len(pending_records)].step_id if pending_records else 0
        steps_completed = sum(1 for r in records if r.status == "APPROVED")
        is_approved = all(r.status in ("APPROVED", "SKIPPED") for r in records)

        return ApprovalStatus(
            document_type=document_type,
            document_id=document_id,
            current_step=current_step,
            total_steps=len(records),
            steps_completed=steps_completed,
            is_approved=is_approved,
            records=[ApprovalRecordOut.model_validate(r) for r in records],
        )

    @staticmethod
    def approve_document(
        db: Session,
        document_type: str,
        document_id: int,
        user_id: int,
        user_role: str,
        notes: str | None = None
    ) -> bool:
        """Approve a document at the current pending step.

        Returns True if all approvals are now complete, False otherwise.
        Raises ValueError if the user's role doesn't match the pending step.
        """
        # Find the current pending record
        record = db.query(ApprovalRecord).filter(
            and_(ApprovalRecord.document_type == document_type,
                 ApprovalRecord.document_id == document_id,
                 ApprovalRecord.status == "PENDING")
        ).order_by(ApprovalRecord.step_id).first()

        if not record:
            raise ValueError(f"No pending approvals for {document_type}#{document_id}")

        # Check that user's role matches the step requirement
        step = record.step
        if step.required_role != user_role:
            raise ValueError(f"User role {user_role} cannot approve step requiring {step.required_role}")

        # Mark as approved
        record.status = "APPROVED"
        record.approved_by = user_id
        record.notes = notes
        from datetime import datetime, timezone
        record.approved_at = datetime.now(timezone.utc)
        db.commit()

        # Check if all approvals are complete
        status = ApprovalService.get_approval_status(db, document_type, document_id)
        return status.is_approved if status else False

    @staticmethod
    def reject_document(
        db: Session,
        document_type: str,
        document_id: int,
        user_id: int,
        user_role: str,
        notes: str
    ) -> None:
        """Reject a document at the current pending step.

        This resets all approval records back to PENDING for re-approval.
        """
        # Find the current pending record
        record = db.query(ApprovalRecord).filter(
            and_(ApprovalRecord.document_type == document_type,
                 ApprovalRecord.document_id == document_id,
                 ApprovalRecord.status == "PENDING")
        ).order_by(ApprovalRecord.step_id).first()

        if not record:
            raise ValueError(f"No pending approvals for {document_type}#{document_id}")

        step = record.step
        if step.required_role != user_role:
            raise ValueError(f"User role {user_role} cannot reject step requiring {step.required_role}")

        # Mark as rejected and reset workflow
        record.status = "REJECTED"
        record.approved_by = user_id
        record.notes = notes
        from datetime import datetime, timezone
        record.approved_at = datetime.now(timezone.utc)

        # Reset all records to PENDING for re-approval
        all_records = db.query(ApprovalRecord).filter(
            and_(ApprovalRecord.document_type == document_type,
                 ApprovalRecord.document_id == document_id)
        ).all()
        for r in all_records:
            if r.id != record.id:
                r.status = "PENDING"
                r.approved_by = None
                r.approved_at = None

        db.commit()

    @staticmethod
    def get_pending_approvals_for_user(
        db: Session,
        user_role: str
    ) -> list[tuple[str, int, ApprovalRecordOut]]:
        """Get all pending approvals for a user (by their role).

        Returns list of (document_type, document_id, record) tuples.
        """
        records = db.query(ApprovalRecord).filter(
            and_(ApprovalRecord.status == "PENDING",
                 ApprovalStep.required_role == user_role)
        ).join(ApprovalStep).all()

        return [
            (r.document_type, r.document_id, ApprovalRecordOut.model_validate(r))
            for r in records
        ]

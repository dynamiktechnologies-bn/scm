from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.dependencies import get_current_user
from app.models.approval import ApprovalWorkflow, ApprovalStep, ApprovalRecord
from app.models.user import User
from app.schemas.approval import (
    ApprovalWorkflowCreate, ApprovalWorkflowOut,
    ApprovalAction, ApprovalStatus, ApprovalRecordOut,
)
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["approvals"])


# ── Workflow Configuration ───────────────────────────────────────────────────

@router.get("/workflows", response_model=list[ApprovalWorkflowOut])
def list_workflows(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """List all approval workflows."""
    workflows = db.query(ApprovalWorkflow).order_by(ApprovalWorkflow.document_type).all()
    return workflows


@router.post("/workflows", response_model=ApprovalWorkflowOut, status_code=status.HTTP_201_CREATED)
def create_workflow(
    body: ApprovalWorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new approval workflow.

    Only ADMIN users can create workflows.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can create workflows")

    # Check if workflow already exists
    existing = db.query(ApprovalWorkflow).filter(
        ApprovalWorkflow.document_type == body.document_type
    ).first()
    if existing:
        raise HTTPException(400, f"Workflow for {body.document_type} already exists")

    # Create workflow
    workflow = ApprovalWorkflow(
        document_type=body.document_type,
        name=body.name,
        amount_threshold=body.amount_threshold,
    )
    db.add(workflow)
    db.flush()  # To get the workflow ID

    # Create steps
    for step_data in body.steps:
        step = ApprovalStep(
            workflow_id=workflow.id,
            step_number=step_data.step_number,
            required_role=step_data.required_role,
            description=step_data.description,
            is_optional=step_data.is_optional,
        )
        db.add(step)

    db.commit()
    db.refresh(workflow)
    return workflow


@router.get("/workflows/{workflow_id}", response_model=ApprovalWorkflowOut)
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get a workflow by ID."""
    workflow = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")
    return workflow


@router.put("/workflows/{workflow_id}", response_model=ApprovalWorkflowOut)
def update_workflow(
    workflow_id: int,
    body: ApprovalWorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a workflow including steps.

    When steps are updated, existing approval records are remapped to new step IDs.
    """
    if current_user.role != "ADMIN":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can update workflows")

    workflow = db.query(ApprovalWorkflow).filter(ApprovalWorkflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workflow not found")

    # Update basic fields
    workflow.name = body.name
    workflow.amount_threshold = body.amount_threshold

    # Get old steps mapped by step_number for remapping approval records
    old_steps_by_number = {
        step.step_number: step.id
        for step in db.query(ApprovalStep).filter(ApprovalStep.workflow_id == workflow_id).all()
    }

    # Create mapping of old step_ids to new step IDs by step_number
    step_id_mapping = {}

    # Delete existing steps and create new ones
    db.query(ApprovalStep).filter(ApprovalStep.workflow_id == workflow_id).delete()

    new_steps_by_number = {}
    for step_data in body.steps:
        step = ApprovalStep(
            workflow_id=workflow_id,
            step_number=step_data.step_number,
            required_role=step_data.required_role,
            description=step_data.description,
            is_optional=step_data.is_optional,
        )
        db.add(step)
        db.flush()  # Get the new step ID
        new_steps_by_number[step_data.step_number] = step.id

        # Map old step_id to new step_id if this step number existed
        if step_data.step_number in old_steps_by_number:
            step_id_mapping[old_steps_by_number[step_data.step_number]] = step.id

    # Update approval records to reference new step IDs
    approval_records = db.query(ApprovalRecord).filter(
        ApprovalRecord.workflow_id == workflow_id
    ).all()

    for record in approval_records:
        if record.step_id in step_id_mapping:
            record.step_id = step_id_mapping[record.step_id]
        else:
            # Step number doesn't exist anymore, mark as skipped
            # Actually, if the step was removed, we should mark it as completed or handle it
            # For now, we'll just delete these records as the step no longer exists
            db.delete(record)

    db.commit()
    db.refresh(workflow)
    return workflow


# ── Approval Actions ─────────────────────────────────────────────────────────

@router.get("/{document_type}/{document_id}/status", response_model=ApprovalStatus)
def get_approval_status(
    document_type: str,
    document_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Get approval status for a specific document."""
    status_data = ApprovalService.get_approval_status(db, document_type, document_id)
    if not status_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No approval records found for this document")
    return status_data


@router.post("/{document_type}/{document_id}/approve")
def approve_document(
    document_type: str,
    document_id: int,
    body: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve a document at the current pending step."""
    try:
        is_complete = ApprovalService.approve_document(
            db,
            document_type,
            document_id,
            current_user.id,
            current_user.role,
            body.notes,
        )
        return {
            "success": True,
            "message": "Document approved",
            "all_approvals_complete": is_complete,
        }
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{document_type}/{document_id}/reject")
def reject_document(
    document_type: str,
    document_id: int,
    body: ApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a document, resetting all approvals."""
    try:
        ApprovalService.reject_document(
            db,
            document_type,
            document_id,
            current_user.id,
            current_user.role,
            body.notes or "No reason provided",
        )
        return {
            "success": True,
            "message": "Document rejected. All approvals have been reset.",
        }
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/pending/mine", response_model=list[dict])
def get_my_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all pending approvals for the current user (by their role)."""
    pending = ApprovalService.get_pending_approvals_for_user(db, current_user.role)
    return [
        {
            "document_type": doc_type,
            "document_id": doc_id,
            "record": record.model_dump(),
        }
        for doc_type, doc_id, record in pending
    ]

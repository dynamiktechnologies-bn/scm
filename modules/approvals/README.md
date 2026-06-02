# Approvals Module

A complete n-level approval workflow system with role-based authorization, amount thresholds, and rejection handling.

## Features

- Multi-level approval workflows (1-level, 2-level, n-level)
- Role-based approval step requirements
- Optional approval steps (can be skipped if no user has that role)
- Amount thresholds for different workflow levels
- Rejection with automatic reset to pending
- Complete approval audit trail
- Approval progress tracking
- Settings page for workflow management

## Files Structure

```
approvals/
├── backend/
│   ├── models/
│   │   └── approval.py              # Workflow, Step, Record models
│   ├── schemas/
│   │   └── approval.py              # Pydantic schemas
│   ├── services/
│   │   └── approval_service.py      # Business logic
│   ├── routers/
│   │   └── approvals.py             # API endpoints
│   └── migrations/
│       └── approval_migration.sql   # Database setup
├── frontend/
│   ├── components/
│   │   ├── ApprovalWidget.tsx       # Approval status + approve/reject
│   │   └── ProcessBar.tsx           # Document progress visualization
│   └── pages/
│       └── ApprovalsPage.tsx        # Workflow management settings
└── README.md                        # This file
```

## Workflow Configuration

Example: Purchase Order with 2-level approval

```
Step 1: MANAGER approval (required)
  └─ Approves POs up to $5000

Step 2: DIRECTOR approval (required)
  └─ Approves POs over $5000
```

## ⚠️ Important: Import Paths

When copying the frontend components to your project, **you must adjust the import paths** to match your project structure.

See [IMPORT_PATHS.md](./frontend/IMPORT_PATHS.md) for detailed instructions.

**Quick Fix:**
1. Copy components to `src/components/ui/`
2. Update imports to use `../../lib/api` and `./index`
3. Ensure your project exports `cn` utility from `components/ui/index.tsx`

## Integration Steps

### 1. Backend Setup

**Copy files:**
```bash
cp modules/approvals/backend/models/approval.py app/models/
cp modules/approvals/backend/schemas/approval.py app/schemas/
cp modules/approvals/backend/services/approval_service.py app/services/
cp modules/approvals/backend/routers/approvals.py app/routers/
```

**Update `app/models/__init__.py`:**
```python
from app.models.approval import ApprovalWorkflow, ApprovalStep, ApprovalRecord

__all__ = [
    "ApprovalWorkflow", "ApprovalStep", "ApprovalRecord",
    # ... other models
]
```

**Update `app/main.py`:**
```python
from app.routers import approvals

_routers = [..., approvals]
```

**Create database tables:**
```bash
alembic revision --autogenerate -m "Add approval tables"
alembic upgrade head
```

**Add seed data (optional):**
```python
from app.models.approval import ApprovalWorkflow, ApprovalStep

# In your seed script
po_workflow = ApprovalWorkflow(
    document_type="PO",
    name="Purchase Order Approval",
    amount_threshold=Decimal("5000.00"),
)
db.add(po_workflow)
db.flush()

db.add(ApprovalStep(
    workflow_id=po_workflow.id,
    step_number=1,
    required_role="MANAGER",
    description="Manager approval"
))
db.add(ApprovalStep(
    workflow_id=po_workflow.id,
    step_number=2,
    required_role="DIRECTOR",
    description="Director approval"
))
db.commit()
```

### 2. Frontend Setup

**Copy files:**
```bash
cp modules/approvals/frontend/components/ApprovalWidget.tsx src/components/ui/
cp modules/approvals/frontend/components/ProcessBar.tsx src/components/ui/
cp modules/approvals/frontend/pages/ApprovalsPage.tsx src/pages/settings/
```

**Add route to `router.tsx`:**
```tsx
import { ApprovalsPage } from "./pages/settings/ApprovalsPage";

// In router config
{ path: "settings/approvals", element: <ApprovalsPage /> }
```

**Add to Settings navigation:**
```tsx
{
  label: "Settings",
  children: [
    { label: "Approval Workflows", to: "/settings/approvals" },
  ],
}
```

### 3. Integrate with Document Flow

When a document is submitted, create approval records:

```python
from app.services.approval_service import ApprovalService

@router.post("/documents/{doc_id}/submit")
def submit_document(doc_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == doc_id).first()
    document.status = "SUBMITTED"
    db.commit()
    
    # Create approval records
    workflow = ApprovalService.get_workflow(db, "DOCUMENT_TYPE", document.amount)
    if workflow:
        ApprovalService.create_approval_records(
            db, workflow.id, "DOCUMENT_TYPE", doc_id, document.document_number
        )
    
    return document
```

When approving a document:

```python
@router.post("/documents/{doc_id}/approve")
def approve_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.query(Document).filter(Document.id == doc_id).first()
    
    try:
        is_complete = ApprovalService.approve_document(
            db, "DOCUMENT_TYPE", doc_id, current_user.id, current_user.role
        )
        
        # If all approvals complete, update document status
        if is_complete:
            document.status = "APPROVED"
            db.commit()
        
        return document
    except ValueError as e:
        raise HTTPException(400, str(e))
```

## API Endpoints

**Workflow Management (Admin only):**
```
GET    /approvals/workflows              # List all workflows
POST   /approvals/workflows              # Create workflow
GET    /approvals/workflows/{id}         # Get workflow details
PUT    /approvals/workflows/{id}         # Update workflow & steps
```

**Document Approvals:**
```
GET    /approvals/{doc_type}/{doc_id}/status    # Get approval status
POST   /approvals/{doc_type}/{doc_id}/approve   # Approve at current step
POST   /approvals/{doc_type}/{doc_id}/reject    # Reject (reset all)
GET    /approvals/pending/mine                  # Get my pending approvals
```

## Usage Examples

### Get Workflow Status

```python
status = ApprovalService.get_approval_status(db, "PO", 123)
# Returns:
# {
#   "document_type": "PO",
#   "document_id": 123,
#   "current_step": 1,
#   "total_steps": 2,
#   "steps_completed": 0,
#   "is_approved": False,
#   "records": [...]
# }
```

### Approve Document

```python
try:
    all_approved = ApprovalService.approve_document(
        db, "PO", 123, user_id=5, user_role="MANAGER", notes="Looks good"
    )
    if all_approved:
        print("All approvals complete!")
except ValueError as e:
    print(f"Error: {e}")  # Role doesn't match, no pending approvals, etc.
```

### Reject Document

```python
ApprovalService.reject_document(
    db, "PO", 123, user_id=5, user_role="MANAGER",
    notes="Needs revision - budget exceeded"
)
# All approval records are reset to PENDING
```

## Customization

### Add New Document Type

1. Create workflow in settings UI
2. Configure approval steps
3. Set amount threshold if needed
4. Integrate with document submission flow

### Custom Approval Logic

Extend `ApprovalService` with custom rules:

```python
@staticmethod
def get_workflow(db: Session, document_type: str, amount: Decimal = None):
    # Custom logic: different workflows by department
    if document_type == "PO" and amount and amount > Decimal("10000"):
        # Use high-value workflow
        return db.query(ApprovalWorkflow).filter(
            ApprovalWorkflow.document_type == "PO_HIGH_VALUE"
        ).first()
    
    # Default workflow
    return db.query(ApprovalWorkflow).filter(
        ApprovalWorkflow.document_type == document_type
    ).first()
```

### Add Approval Notifications

The module automatically creates notifications when:
- Document submitted (notify first approver)
- Step approved (notify next approver)
- All approvals complete (notify admins)

This requires the Notifications module to be installed.

## Database Schema

```sql
CREATE TABLE approval_workflows (
    id INTEGER PRIMARY KEY,
    document_type VARCHAR(40) UNIQUE,
    name VARCHAR(120),
    amount_threshold NUMERIC(15,4),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE approval_steps (
    id INTEGER PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_number INTEGER,
    required_role VARCHAR(40),
    description VARCHAR(200),
    is_optional BOOLEAN DEFAULT FALSE
);

CREATE TABLE approval_records (
    id INTEGER PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES approval_workflows(id),
    step_id INTEGER NOT NULL REFERENCES approval_steps(id),
    document_type VARCHAR(40),
    document_id INTEGER,
    status VARCHAR(40),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Workflow Examples

### 1-Level Approval
- Manager approves all documents
```
Step 1: MANAGER
```

### 2-Level Approval
- Manager approves, then Director approves
```
Step 1: MANAGER
Step 2: DIRECTOR
```

### 3-Level with Optional Step
- Manager approves, Finance Director (optional), then CFO
```
Step 1: MANAGER
Step 2: FINANCE_DIRECTOR (optional)
Step 3: CFO
```

## Rejection Flow

When document is rejected:
1. Current approver marks as REJECTED
2. All previous approvals reset to PENDING
3. Document goes back to first step
4. Approvers can reapprove

## Performance Considerations

- Index on `document_type` and `document_id`
- Index on `status` for pending approvals
- Archive old approval records periodically
- Cache active workflows

## Troubleshooting

**User role doesn't match step requirement:**
- Check user's role in database
- Verify workflow step has correct role

**No pending approvals found:**
- Verify approval records were created
- Check workflow is active
- Ensure step is not optional

**Amount threshold not working:**
- Verify amount_threshold is set in workflow
- Check custom workflow selection logic

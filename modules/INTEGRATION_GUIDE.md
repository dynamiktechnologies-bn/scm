# Module Integration Guide

Complete step-by-step guide to integrate these reusable modules into a new FastAPI + React project.

## Prerequisites

- FastAPI project with SQLAlchemy ORM
- React project with React Query
- PostgreSQL or compatible database
- Alembic for migrations
- Tailwind CSS configured

## Step 1: Copy Module Files

```bash
# Copy all modules to your project
cp -r modules/* /path/to/your/project/

# Or selectively copy only needed modules
cp -r modules/notifications /path/to/your/project/modules/
cp -r modules/approvals /path/to/your/project/modules/
cp -r modules/users /path/to/your/project/modules/
```

## Step 2: Backend Integration (Per Module)

### 2.1 Users Module (Required - depends on other modules)

**Copy files:**
```bash
cp modules/users/backend/models/user.py backend/app/models/
cp modules/users/backend/routers/auth.py backend/app/routers/  # Merge with existing if needed
```

**Update `backend/app/models/__init__.py`:**
```python
from app.models.user import User

__all__ = [
    "User",
    # ... other models
]
```

**Update `backend/app/main.py`:**
```python
from app.routers import auth

_routers = [auth, ...]  # auth should already be included
app.include_router(auth.router, prefix="/api/v1")
```

**Create migration:**
```bash
cd backend
alembic revision --autogenerate -m "Add users table"
alembic upgrade head
```

### 2.2 Notifications Module (Optional)

**Copy files:**
```bash
cp modules/notifications/backend/models/notification.py backend/app/models/
cp modules/notifications/backend/schemas/notification.py backend/app/schemas/
cp modules/notifications/backend/services/notification_service.py backend/app/services/
cp modules/notifications/backend/routers/notifications.py backend/app/routers/
```

**Update imports in `backend/app/models/__init__.py`:**
```python
from app.models.notification import Notification

__all__ = [
    "Notification",
    # ... other models
]
```

**Update `backend/app/main.py`:**
```python
from app.routers import notifications

_routers = [..., notifications]
app.include_router(notifications.router, prefix="/api/v1")
```

**Create migration:**
```bash
alembic revision --autogenerate -m "Add notifications table"
alembic upgrade head
```

### 2.3 Approvals Module (Optional - depends on Notifications)

**Copy files:**
```bash
cp modules/approvals/backend/models/approval.py backend/app/models/
cp modules/approvals/backend/schemas/approval.py backend/app/schemas/
cp modules/approvals/backend/services/approval_service.py backend/app/services/
cp modules/approvals/backend/routers/approvals.py backend/app/routers/
```

**Update imports in `backend/app/models/__init__.py`:**
```python
from app.models.approval import ApprovalWorkflow, ApprovalStep, ApprovalRecord

__all__ = [
    "ApprovalWorkflow", "ApprovalStep", "ApprovalRecord",
    # ... other models
]
```

**Update `backend/app/main.py`:**
```python
from app.routers import approvals

_routers = [..., approvals]
app.include_router(approvals.router, prefix="/api/v1")
```

**Create migration:**
```bash
alembic revision --autogenerate -m "Add approval workflow tables"
alembic upgrade head
```

**Note:** If using approvals module without notifications, remove the import and function calls to `NotificationService` from `approval_service.py`.

## Step 3: Frontend Integration (Per Module)

### 3.1 Users Module (Required)

**Copy files:**
```bash
cp modules/users/frontend/pages/UsersPage.tsx frontend/src/pages/settings/
```

**Update `frontend/src/router.tsx`:**
```tsx
import { UsersPage } from "./pages/settings/UsersPage";

// In router config
{ path: "settings/users", element: <UsersPage /> }
```

**Add navigation in your Layout or Settings menu:**
```tsx
{
  label: "Settings",
  children: [
    { label: "Users & Roles", to: "/settings/users" },
    // ... other settings
  ],
}
```

### 3.2 Notifications Module (Optional)

**Copy files:**
```bash
mkdir -p frontend/src/components/notifications
cp modules/notifications/frontend/components/NotificationCenter.tsx \
   frontend/src/components/notifications/
```

**Update your Layout to include NotificationCenter:**
```tsx
import { NotificationCenter } from "./notifications/NotificationCenter";

export function Layout() {
  return (
    <div>
      {/* In header area */}
      <header>
        <NotificationCenter />
        {/* ... other header content */}
      </header>
      
      {/* ... rest of layout */}
    </div>
  );
}
```

### 3.3 Approvals Module (Optional)

**Copy files:**
```bash
mkdir -p frontend/src/pages/settings
cp modules/approvals/frontend/components/ApprovalWidget.tsx \
   frontend/src/components/ui/
cp modules/approvals/frontend/components/ProcessBar.tsx \
   frontend/src/components/ui/
cp modules/approvals/frontend/pages/ApprovalsPage.tsx \
   frontend/src/pages/settings/
```

**Update `frontend/src/router.tsx`:**
```tsx
import { ApprovalsPage } from "./pages/settings/ApprovalsPage";

// In router config
{ path: "settings/approvals", element: <ApprovalsPage /> }
```

**Add navigation:**
```tsx
{
  label: "Settings",
  children: [
    { label: "Approval Workflows", to: "/settings/approvals" },
    // ... other settings
  ],
}
```

## Step 4: Verify Installation

### Backend Verification

1. **Check models are exported:**
```bash
python -c "from app.models import User, Notification, ApprovalWorkflow; print('Models OK')"
```

2. **Check routers are registered:**
```bash
python -c "from app.main import app; print([r.path for r in app.routes if '/approvals' in r.path])"
```

3. **Run migrations:**
```bash
alembic upgrade head
```

4. **Start backend and test endpoints:**
```bash
uvicorn app.main:app --reload

# In another terminal
curl http://localhost:8000/docs  # Check Swagger UI shows new endpoints
```

### Frontend Verification

1. **Check components import:**
```bash
npm run build  # Should complete without errors
```

2. **Verify routes work:**
   - Navigate to `/settings/users` in browser
   - Check `/settings/approvals` if approvals installed
   - Check bell icon for notifications if installed

## Step 5: Seed Initial Data (Optional)

Create admin user:
```python
# In your seed script
from app.models.user import User
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

admin = User(
    email="admin@example.com",
    hashed_password=pwd_ctx.hash("AdminPassword123!"),
    full_name="Admin User",
    role="ADMIN",
)
db.add(admin)
db.commit()
```

Create approval workflows:
```python
# In your seed script
from app.models.approval import ApprovalWorkflow, ApprovalStep

workflow = ApprovalWorkflow(
    document_type="DOCUMENT_TYPE",
    name="Standard Approval",
)
db.add(workflow)
db.flush()

db.add(ApprovalStep(
    workflow_id=workflow.id,
    step_number=1,
    required_role="MANAGER",
))
db.commit()
```

## Step 6: Integration with Your Document Models

### Example: Purchase Order with Approvals

**In your PO submission endpoint:**
```python
from app.services.approval_service import ApprovalService

@router.post("/orders/{po_id}/submit")
def submit_po(po_id: int, db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    po.status = "SUBMITTED"
    db.commit()
    
    # Create approval records
    workflow = ApprovalService.get_workflow(db, "PO", po.total_amount)
    if workflow:
        ApprovalService.create_approval_records(
            db, workflow.id, "PO", po.id, po.po_number
        )
    
    db.refresh(po)
    return po

@router.post("/orders/{po_id}/approve")
def approve_po(po_id: int, db: Session = Depends(get_db), 
               current_user: User = Depends(get_current_user)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    
    try:
        all_approved = ApprovalService.approve_document(
            db, "PO", po_id, current_user.id, current_user.role
        )
        
        if all_approved:
            po.status = "APPROVED"
            db.commit()
        
        db.refresh(po)
        return po
    except ValueError as e:
        raise HTTPException(400, str(e))
```

## Step 7: Configuration & Customization

### Update Role List

If you need different roles, update in multiple places:

1. **Backend - User model default:**
```python
role: Mapped[str] = mapped_column(String(20), default="STAFF")
```

2. **Frontend - Users page:**
```tsx
const AVAILABLE_ROLES = [
    "STAFF",
    "YOUR_ROLE",
    // ...
];
```

### Customize Notification Types

In your services, add new types:
```python
# Common types
NOTIFICATION_TYPES = {
    "APPROVAL_PENDING": "Waiting for approval",
    "APPROVED": "Document approved",
    "REJECTED": "Document rejected",
    "SUBMITTED": "Document submitted",
    "COMPLETED": "Task completed",
    "ERROR": "Error occurred",
}
```

## Common Integration Patterns

### Pattern 1: Simple Document with 1-Level Approval

```
Document created → Submit → Approval Records created → 
Manager approves → Document status = APPROVED
```

### Pattern 2: Multi-Level Approval with Notifications

```
Document created → Submit → Notifications sent to MANAGER → 
MANAGER approves → Notifications sent to DIRECTOR → 
DIRECTOR approves → Document approved + Notification to admin
```

### Pattern 3: Amount-Based Workflow

```
Document amount < $5,000 → 1-level approval
Document amount >= $5,000 → 2-level approval
Document amount >= $50,000 → 3-level approval
```

## Troubleshooting Integration

### "Module not found" errors

**Solution:** Verify file paths match your project structure
```bash
ls -la backend/app/models/  # Check file exists
```

### Import errors in Python

**Solution:** Update `__init__.py` files
```bash
# Check imports
python -c "from app.models import *"
```

### Frontend component errors

**Solution:** Check import paths match your structure
```tsx
// Verify path exists
import { Component } from "../path/to/component";
```

### Migration errors

**Solution:** Run migrations step by step
```bash
alembic current  # Check current version
alembic upgrade head  # Apply all pending
```

### API endpoints not appearing

**Solution:** Verify routers are registered
```bash
# Check Swagger UI at http://localhost:8000/docs
curl http://localhost:8000/api/v1/approvals/workflows  # Should work
```

## Security Checklist

- [ ] Admin user created with strong password
- [ ] JWT secret configured
- [ ] CORS origins configured
- [ ] Database credentials secured
- [ ] Sensitive endpoints protected with role checks
- [ ] Input validation enabled
- [ ] HTTPS configured in production

## Performance Optimization

1. **Add database indexes:**
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_approvals_document ON approval_records(document_type, document_id);
CREATE INDEX idx_users_role ON users(role);
```

2. **Configure caching:**
```python
# Cache user roles, workflows
from functools import lru_cache

@lru_cache(maxsize=128)
def get_user_role(user_id: int):
    return db.query(User).filter(User.id == user_id).first().role
```

3. **Notification refresh:**
- Adjust in NotificationCenter.tsx (currently 10 seconds)
- For real-time, implement WebSocket

## Next Steps

1. Review individual module README files
2. Test each module independently
3. Integrate with your document/business logic
4. Customize roles and workflows for your needs
5. Add monitoring and logging
6. Set up automated tests

## Getting Help

Each module has its own README with detailed information:
- `modules/notifications/README.md`
- `modules/approvals/README.md`
- `modules/users/README.md`

For issues not covered, check the SCM project for working examples.

# Modules Quick Reference Card

## Module Dependencies

```
Users Module (Required)
    ↓
    ├─→ Approvals Module (Optional)
    │       ↓
    │       └─→ Notifications Module (Optional)
    │
    └─→ Notifications Module (Optional)
            ↓
            └─→ Approvals Module (can notify approvers)
```

## At a Glance

| Module | Backend | Frontend | DB Tables | Key Features |
|--------|---------|----------|-----------|--------------|
| **Users** | Auth router, User model | UsersPage | 1 (users) | User CRUD, Roles, Auth |
| **Notifications** | NotificationService, router | NotificationCenter | 1 (notifications) | Bell icon, auto-refresh, read tracking |
| **Approvals** | ApprovalService, router | ApprovalWidget, ProcessBar, ApprovalsPage | 3 (workflows, steps, records) | n-level approvals, role-based, amount thresholds |

## File Locations After Integration

```
backend/app/
├── models/
│   ├── user.py                    ← Users module
│   └── notification.py            ← Notifications module
│   └── approval.py                ← Approvals module
├── schemas/
│   ├── notification.py            ← Notifications module
│   └── approval.py                ← Approvals module
├── services/
│   ├── notification_service.py    ← Notifications module
│   └── approval_service.py        ← Approvals module
└── routers/
    ├── auth.py                    ← Users module (auth + user endpoints)
    ├── notifications.py           ← Notifications module
    └── approvals.py               ← Approvals module

frontend/src/
├── pages/settings/
│   ├── UsersPage.tsx              ← Users module
│   └── ApprovalsPage.tsx          ← Approvals module
└── components/
    ├── notifications/
    │   └── NotificationCenter.tsx ← Notifications module
    └── ui/
        ├── ApprovalWidget.tsx     ← Approvals module
        └── ProcessBar.tsx         ← Approvals module
```

## API Endpoints Reference

### Users Module - `/api/v1/auth/*`
```
POST   /register                    Create user
POST   /login                       Login
POST   /refresh                     Refresh token
GET    /me                          Current user
GET    /users                       List users (admin)
GET    /users/{id}                  Get user (admin)
PUT    /users/{id}                  Update user (admin)
DELETE /users/{id}                  Delete user (admin)
```

### Notifications Module - `/api/v1/notifications/*`
```
GET    /                            List notifications
GET    ?unread_only=true           Unread only
GET    /unread-count               Count unread
PUT    /{id}/read                  Mark as read
POST   /mark-all-read              Mark all read
DELETE /{id}                       Delete notification
```

### Approvals Module - `/api/v1/approvals/*`
```
GET    /workflows                   List workflows
POST   /workflows                   Create workflow (admin)
GET    /workflows/{id}              Get workflow
PUT    /workflows/{id}              Update workflow (admin)
GET    /{doc_type}/{doc_id}/status Get approval status
POST   /{doc_type}/{doc_id}/approve Approve document
POST   /{doc_type}/{doc_id}/reject  Reject document
GET    /pending/mine                My pending approvals
```

## Database Tables

### users
```sql
id, email, hashed_password, full_name, role, is_active, created_at
```

### notifications
```sql
id, user_id, type, title, message, document_type, document_id, 
document_number, is_read, created_at
```

### approval_workflows
```sql
id, document_type, name, amount_threshold, is_active
```

### approval_steps
```sql
id, workflow_id, step_number, required_role, description, is_optional
```

### approval_records
```sql
id, workflow_id, step_id, document_type, document_id, status, 
approved_by, approved_at, notes, created_at
```

## Key Classes & Services

### Users
- `User` model - user account
- Auth endpoints - login, register, token refresh

### Notifications
- `Notification` model - in-app message
- `NotificationService` - create, manage, query notifications
- `NotificationCenter` component - UI bell icon

### Approvals
- `ApprovalWorkflow` model - workflow definition
- `ApprovalStep` model - approval step
- `ApprovalRecord` model - approval action tracking
- `ApprovalService` - create records, approve, reject
- `ApprovalWidget` component - approval UI
- `ProcessBar` component - progress visualization

## Environment Setup Checklist

- [ ] Create migrations: `alembic revision --autogenerate`
- [ ] Run migrations: `alembic upgrade head`
- [ ] Create admin user (seed data)
- [ ] Create approval workflows
- [ ] Verify all imports in `__init__.py`
- [ ] Verify all routers registered in `main.py`
- [ ] Copy frontend components
- [ ] Add routes to frontend router
- [ ] Add navigation links
- [ ] Test endpoints with Swagger UI
- [ ] Test UI components

## Quick Integration Commands

```bash
# Copy all modules
cp -r modules/* /path/to/project/

# Backend setup
python -m alembic revision --autogenerate -m "Add modules"
python -m alembic upgrade head

# Frontend check
npm run build

# Backend test
curl http://localhost:8000/api/v1/users  # Should require auth

# Frontend test
# Open browser, check for notification bell icon
# Navigate to /settings/users and /settings/approvals
```

## Common Customizations

### Change notification refresh interval
File: `frontend/src/components/notifications/NotificationCenter.tsx`
```tsx
refetchInterval: 10000  // milliseconds
```

### Add approval notification types
File: `backend/app/services/notification_service.py`
```python
NotificationService.create_notification(
    ...,
    notification_type="YOUR_TYPE",
    ...
)
```

### Customize approval roles
Files:
- `frontend/src/pages/settings/ApprovalsPage.tsx` - AVAILABLE_ROLES
- `backend/app/models/user.py` - User.role default
- `frontend/src/pages/settings/UsersPage.tsx` - ROLE_DESCRIPTIONS

### Add user fields
1. Update User model
2. Create migration
3. Update UsersPage form
4. Update auth schemas

## Performance Tips

- Notification refresh: 10-30 seconds (slower = less DB load)
- Add DB indexes on frequently queried columns
- Archive old notifications monthly
- Cache active workflows in memory
- Use WebSocket for real-time notifications (future)

## Security Reminders

- All user management endpoints require ADMIN role
- Never store passwords in plain text
- Use JWT tokens with expiration
- Validate all role-based access on backend
- Sanitize all user input
- Log admin actions (user create, delete, role change)

## Testing Commands

```bash
# Create test user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","role":"MANAGER"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123"}'

# List workflows
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/v1/approvals/workflows

# Get notifications
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/v1/notifications
```

## Troubleshooting Matrix

| Issue | Solution | Files |
|-------|----------|-------|
| Module not found | Copy files to correct path | See file locations above |
| Import error | Update `__init__.py` | `app/models/__init__.py` |
| Route not found | Register in main.py | `app/main.py` |
| Migration fails | Check model syntax | `models/*.py` |
| Frontend errors | Check component paths | Component import statements |
| No notifications | Check NotificationCenter in layout | Layout file |
| Approvals not working | Verify workflow exists | Seed data / ApprovalsPage |

## Version Info

- **FastAPI**: 0.95+
- **SQLAlchemy**: 2.0+
- **React**: 18+
- **Python**: 3.10+
- **PostgreSQL**: 13+

## Support Resources

1. Read module README: `modules/{module}/README.md`
2. Check integration guide: `modules/INTEGRATION_GUIDE.md`
3. Review SCM project examples: `/backend/app/routers/purchase.py`
4. Run tests and verify in browser
5. Check browser console for frontend errors
6. Check application logs for backend errors

## Next: Customization

Once integrated and working, customize for your needs:
- Add more approval levels
- Create custom roles
- Extend user model
- Add email notifications
- Implement WebSocket for real-time
- Add audit logging
- Add metrics/analytics

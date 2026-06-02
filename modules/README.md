# Reusable ERP Modules

This directory contains modular, self-contained systems that can be copied to other FastAPI + React projects.

## Available Modules

### 1. **Notifications Module** (`/notifications`)
Real-time in-app notification system with read/unread tracking.

**Features:**
- Create and manage notifications
- Notification center UI with bell icon
- Unread count badge
- Mark as read/unread
- Auto-refresh every 10 seconds

**Backend Files:**
- `backend/models/notification.py` - Notification model
- `backend/schemas/notification.py` - API schemas
- `backend/services/notification_service.py` - Business logic
- `backend/routers/notifications.py` - REST API endpoints

**Frontend Files:**
- `frontend/components/NotificationCenter.tsx` - Bell icon + dropdown panel

**Database:**
- Requires `notifications` table (see migration guide)

---

### 2. **Approvals Module** (`/approvals`)
Complete n-level approval workflow system with role-based authorization.

**Features:**
- Multi-level approval workflows (1-level, 2-level, n-level)
- Role-based step requirements
- Amount thresholds for different workflows
- Optional approval steps
- Rejection with reset mechanism
- Complete audit trail

**Backend Files:**
- `backend/models/approval.py` - ApprovalWorkflow, ApprovalStep, ApprovalRecord models
- `backend/schemas/approval.py` - API schemas
- `backend/services/approval_service.py` - Business logic
- `backend/routers/approvals.py` - REST API endpoints

**Frontend Files:**
- `frontend/components/ApprovalWidget.tsx` - Approval status + approve/reject buttons
- `frontend/pages/ApprovalsPage.tsx` - Settings page for workflow management

**Database:**
- Requires `approval_workflows`, `approval_steps`, `approval_records` tables

---

### 3. **Users & Roles Module** (`/users`)
User account and role management system.

**Features:**
- User CRUD operations
- Role assignment (STAFF, MANAGER, DIRECTOR, FINANCE_DIRECTOR, CFO, ADMIN)
- User activation/deactivation
- Admin-only access control
- User listing and filtering

**Backend Files:**
- `backend/models/user.py` - User model (already exists in main project)
- `backend/schemas/user.py` - API schemas
- `backend/routers/auth.py` - Extended auth endpoints (register, login, user management)

**Frontend Files:**
- `frontend/pages/UsersPage.tsx` - User management UI with role assignment

**Database:**
- Requires `users` table with role field

---

## Integration Guide

### For a New Project

1. **Copy the modules directory:**
   ```bash
   cp -r modules/* /path/to/new-project/
   ```

2. **Backend Integration:**
   - Copy models from each module to your `app/models/`
   - Copy schemas to `app/schemas/`
   - Copy services to `app/services/`
   - Copy routers to `app/routers/`
   - Update `app/models/__init__.py` to export new models
   - Update `app/main.py` to include new routers

3. **Frontend Integration:**
   - Copy components to your project's component structure
   - Copy pages to your `pages/` directory
   - Add routes to your router
   - Import and use components in layout/pages

4. **Database Migrations:**
   - Run Alembic migrations to create required tables
   - See individual module README for migration scripts

5. **Environment Setup:**
   - Ensure all dependencies are installed
   - Update configuration as needed

---

## Module Dependencies

### Notifications Module
- **Requires:** SQLAlchemy ORM, Pydantic, FastAPI
- **Frontend:** React, React Query, Lucide icons, Tailwind CSS
- **Optional integration:** Can be extended to send emails/SMS

### Approvals Module
- **Requires:** SQLAlchemy ORM, Pydantic, FastAPI
- **Depends on:** Notifications module (for approval notifications)
- **Frontend:** React, React Query, React Hook Form, Lucide icons, Tailwind CSS

### Users & Roles Module
- **Requires:** SQLAlchemy ORM, Pydantic, FastAPI, passlib, bcrypt
- **Frontend:** React, React Query, React Hook Form, Lucide icons, Tailwind CSS

---

## Quick Start Checklist

For each module you want to use:

- [ ] Copy backend files to appropriate directories
- [ ] Copy frontend files to appropriate directories
- [ ] Update imports in `__init__.py` files
- [ ] Update main router registration
- [ ] Run database migrations
- [ ] Add routes to frontend router
- [ ] Import components in layout/pages
- [ ] Test API endpoints with Swagger UI
- [ ] Test UI components in browser

---

## Customization Notes

Each module is self-contained but can be customized:

1. **Change role names** - Edit role lists in schemas and services
2. **Add email notifications** - Extend `NotificationService` with email logic
3. **Add approval conditions** - Extend `ApprovalService` with custom logic
4. **Add user fields** - Extend `User` model with additional fields
5. **Customize UI** - Modify colors, layout, and styling in components

---

## Support

For issues or questions about integrating these modules:
1. Check individual module README files
2. Review the integration examples in SCM project
3. Refer to backend/frontend documentation in each module


# Users & Roles Management Module

Complete user account and role management system with admin controls.

## Features

- User CRUD operations (Create, Read, Update, Delete)
- Role-based access control (6 standard roles)
- User activation/deactivation
- Admin-only management
- User listing and filtering
- Full name and email management
- Account status indicators

## Available Roles

- **STAFF** - Regular user with basic access
- **MANAGER** - Can approve documents up to manager level
- **DIRECTOR** - Director-level approvals
- **FINANCE_DIRECTOR** - Finance-related approvals
- **CFO** - Chief Financial Officer (highest approval level)
- **ADMIN** - Full system access, can manage users and workflows

## Files Structure

```
users/
├── backend/
│   ├── models/
│   │   └── user.py                 # User model
│   ├── schemas/
│   │   └── user.py                 # Pydantic schemas
│   ├── routers/
│   │   └── auth.py                 # User management endpoints
│   └── migrations/
│       └── user_migration.sql      # Database setup
├── frontend/
│   └── pages/
│       └── UsersPage.tsx           # User management UI
└── README.md                       # This file
```

## Integration Steps

### 1. Backend Setup

**Copy files:**
```bash
cp modules/users/backend/models/user.py app/models/
cp modules/users/backend/schemas/user.py app/schemas/
# Note: auth.py already contains user management endpoints
#       Merge the new endpoints with your existing auth.py
```

**Update `app/models/__init__.py`:**
```python
from app.models.user import User

__all__ = [
    "User",
    # ... other models
]
```

**The User model requires:**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    hashed_password VARCHAR(200) NOT NULL,
    full_name VARCHAR(120),
    role VARCHAR(20) DEFAULT 'STAFF',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Backend endpoints already included in auth router:**
```
GET    /auth/users              # List all users (admin only)
GET    /auth/users/{id}         # Get user details
PUT    /auth/users/{id}         # Update user
DELETE /auth/users/{id}         # Delete user (admin only)
POST   /auth/register           # Create new user
POST   /auth/login              # User login
POST   /auth/refresh            # Refresh token
GET    /auth/me                 # Get current user
```

### 2. Frontend Setup

**Copy files:**
```bash
cp modules/users/frontend/pages/UsersPage.tsx src/pages/settings/
```

**Add route to `router.tsx`:**
```tsx
import { UsersPage } from "./pages/settings/UsersPage";

// In router config
{ path: "settings/users", element: <UsersPage /> }
```

**Add to Settings navigation:**
```tsx
{
  label: "Settings",
  children: [
    { label: "Users & Roles", to: "/settings/users" },
  ],
}
```

## User Management Features

### Create New User

Via UI:
1. Settings → Users & Roles
2. Click "New User"
3. Enter email, full name, role
4. System generates temporary password
5. User can change password on first login

Via API:
```bash
POST /api/v1/auth/register
{
  "email": "john@example.com",
  "full_name": "John Doe",
  "role": "MANAGER",
  "password": "SecurePassword123"
}
```

### Update User

Via UI:
1. Find user in list
2. Click "Edit"
3. Change name, role, or status
4. Save

Via API:
```bash
PUT /api/v1/auth/users/{user_id}
{
  "full_name": "Jane Doe",
  "role": "DIRECTOR",
  "is_active": true
}
```

### Deactivate User

Instead of deleting, deactivate to preserve history:
1. Click Edit on user
2. Uncheck "Active" checkbox
3. Save
4. User cannot log in but records are preserved

### Delete User

Via UI: Click "Delete" button (warns if deleting self)
Via API:
```bash
DELETE /api/v1/auth/users/{user_id}
```

**Note:** Can't delete your own account

## Role Management

### Standard Roles

**STAFF**
- Basic system access
- Can view documents
- No approval authority

**MANAGER**
- Can approve documents at step 1
- Typical department manager
- Approval limit: defined by workflows

**DIRECTOR**
- Can approve documents at director level
- Higher authority than managers
- Approval limit: higher thresholds

**FINANCE_DIRECTOR**
- Can approve financial documents
- Finance-specific authority
- Works with approval workflows

**CFO**
- Can approve any document
- Highest approval authority
- Finance oversight

**ADMIN**
- Full system access
- Can create/edit/delete users
- Can create/manage workflows
- Can access all reports

## Customization

### Add Custom Roles

1. Update role options in `UsersPage.tsx`:
```tsx
const AVAILABLE_ROLES = [
  "STAFF",
  "MANAGER",
  "DIRECTOR",
  "FINANCE_DIRECTOR",
  "CFO",
  "ADMIN",
  "YOUR_NEW_ROLE",  // Add here
];
```

2. Update role descriptions:
```tsx
const ROLE_DESCRIPTIONS: Record<string, string> = {
  // ... existing roles
  YOUR_NEW_ROLE: "Description of your role",
};
```

3. Update backend User model if needed

### Custom User Fields

Extend the User model:
```python
class User(Base):
    __tablename__ = "users"
    
    # Existing fields
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    # ...
    
    # Add new fields
    department: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
```

Update UI to show new fields:
```tsx
<FormField label="Department">
  <Input {...register("department")} />
</FormField>
```

## Security Considerations

- Passwords are hashed with bcrypt
- Admin-only endpoints checked on backend
- Users can only view/edit their own profile
- Deletion protected (can't self-delete)
- JWT tokens for authentication
- Roles enforced on every endpoint

## API Authentication

All user management endpoints require:
1. Valid JWT token in header: `Authorization: Bearer YOUR_TOKEN`
2. Admin role for list/create/update/delete
3. User can only access own profile

Example:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/auth/users
```

## Database

### User Table Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    hashed_password VARCHAR(200) NOT NULL,
    full_name VARCHAR(120),
    role VARCHAR(20) DEFAULT 'STAFF' CHECK (role IN (
        'STAFF', 'MANAGER', 'DIRECTOR', 'FINANCE_DIRECTOR', 'CFO', 'ADMIN'
    )),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
```

## Testing

### Test User Creation

```bash
# Register new user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "full_name": "Test User",
    "role": "MANAGER"
  }'
```

### Test User Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### Test Admin Operations

```bash
# List users (requires admin role)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/auth/users

# Update user
curl -X PUT http://localhost:8000/api/v1/auth/users/5 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Name",
    "role": "DIRECTOR"
  }'

# Delete user
curl -X DELETE http://localhost:8000/api/v1/auth/users/5 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

**Can't create new user:**
- Ensure you're logged in as ADMIN
- Check email doesn't already exist
- Verify all required fields are filled

**Login fails:**
- Check email is correct
- Verify password is correct
- Ensure user is active (not deactivated)

**Can't update user:**
- Only admins can update other users
- Users can update their own profile
- Check role exists in system

**Permission denied:**
- Verify your user role is ADMIN
- Check JWT token is valid
- Ensure token is included in header

## Password Management

**Default/Temporary Passwords:**
- When creating users via API, set a password
- Via UI, system generates temporary password
- Users should change on first login

**Password Reset:**
- Not included in this module
- Can be extended with email verification
- Consider adding password reset flow

## Integration with Other Modules

### Approvals Module
- Users with MANAGER, DIRECTOR, etc. roles approve documents
- Roles are used in approval workflow steps

### Notifications Module
- Notifications sent to users based on role
- User ID stored in notification record

## Best Practices

1. **Create admin user first** - Needed to manage other users
2. **Use deactivation before deletion** - Preserves audit trail
3. **Assign minimum required role** - Follow least privilege principle
4. **Regular role audits** - Ensure users have correct roles
5. **Archive old users** - Deactivate instead of delete
6. **Monitor admin actions** - Log all user management operations

## Dependencies

**Backend:**
- SQLAlchemy
- Pydantic
- FastAPI
- passlib (password hashing)
- bcrypt (hashing library)

**Frontend:**
- React 18+
- React Query
- React Hook Form
- Lucide React (icons)
- Tailwind CSS

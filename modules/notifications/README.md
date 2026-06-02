# Notifications Module

A complete in-app notification system with real-time updates and read/unread tracking.

## Features

- Create notifications for individual users or roles
- Bell icon notification center with dropdown
- Unread count badge
- Mark notifications as read/unread
- Auto-refresh every 10 seconds
- Dismiss/delete notifications
- Support for notification types (APPROVAL_PENDING, APPROVED, REJECTED, etc.)

## Files Structure

```
notifications/
├── backend/
│   ├── models/
│   │   └── notification.py          # Notification model
│   ├── schemas/
│   │   └── notification.py          # Pydantic schemas
│   ├── services/
│   │   └── notification_service.py  # Business logic
│   ├── routers/
│   │   └── notifications.py         # API endpoints
│   └── migrations/
│       └── notification_migration.sql # Database setup
├── frontend/
│   └── components/
│       └── NotificationCenter.tsx    # UI component
└── README.md                         # This file
```

## ⚠️ Important: Import Paths

When copying the frontend components to your project, **you must adjust the import paths** to match your project structure.

See [IMPORT_PATHS.md](./frontend/IMPORT_PATHS.md) for detailed instructions.

**Quick Fix:**
1. Copy NotificationCenter.tsx to `src/components/notifications/`
2. Update imports to use `../../lib/api` and `../ui`
3. Ensure your project exports `cn` utility

## Integration Steps

### 1. Backend Setup

**Copy files:**
```bash
cp modules/notifications/backend/models/notification.py app/models/
cp modules/notifications/backend/schemas/notification.py app/schemas/
cp modules/notifications/backend/services/notification_service.py app/services/
cp modules/notifications/backend/routers/notifications.py app/routers/
```

**Update `app/models/__init__.py`:**
```python
from app.models.notification import Notification

__all__ = [
    "Notification",
    # ... other models
]
```

**Update `app/main.py`:**
```python
from app.routers import notifications  # Add this import

_routers = [..., notifications]  # Add to router list
```

**Create database table:**
```bash
# Using Alembic
alembic revision --autogenerate -m "Add notifications table"
alembic upgrade head

# Or run SQL directly
psql -f modules/notifications/backend/migrations/notification_migration.sql
```

### 2. Frontend Setup

**Copy files:**
```bash
cp modules/notifications/frontend/components/NotificationCenter.tsx src/components/notifications/
```

**Update Layout component:**
```tsx
import { NotificationCenter } from "../notifications/NotificationCenter";

// In your header/layout:
<NotificationCenter />
```

**Ensure dependencies are installed:**
- react-query (already in project)
- lucide-react (already in project)
- tailwindcss (already in project)

### 3. API Usage

**Fetch notifications:**
```bash
GET /api/v1/notifications
GET /api/v1/notifications?unread_only=true
```

**Get unread count:**
```bash
GET /api/v1/notifications/unread-count
```

**Mark as read:**
```bash
PUT /api/v1/notifications/{notification_id}/read
Body: { "is_read": true }
```

**Mark all as read:**
```bash
POST /api/v1/notifications/mark-all-read
```

**Delete notification:**
```bash
DELETE /api/v1/notifications/{notification_id}
```

## Usage in Your Application

### Creating Notifications Programmatically

In any backend service (e.g., when approving a document):

```python
from app.services.notification_service import NotificationService

# For a specific user
NotificationService.create_notification(
    db,
    user_id=123,
    notification_type="APPROVED",
    title="Document Approved",
    message="Your PO-001 has been approved",
    document_type="PO",
    document_id=1,
    document_number="PO-001"
)

# For all users with a specific role
NotificationService.create_notifications_for_role(
    db,
    required_role="MANAGER",
    notification_type="APPROVAL_PENDING",
    title="Approval Needed",
    message="PO-001 is waiting for approval",
    document_type="PO",
    document_id=1,
    document_number="PO-001"
)
```

### Notification Types

Use these standard notification types:
- `APPROVAL_PENDING` - Waiting for approval
- `APPROVED` - Document approved
- `REJECTED` - Document rejected
- `SUBMITTED` - Document submitted
- `COMPLETED` - Task completed
- `ERROR` - Error occurred

## Customization

### Change Refresh Interval

In `NotificationCenter.tsx`, modify the `refetchInterval`:
```tsx
const { data: notifications = [] } = useQuery<Notification[]>({
  queryKey: ["notifications"],
  queryFn: () => api.get("/notifications").then((r) => r.data),
  refetchInterval: 5000,  // Change to 5 seconds
});
```

### Add More Notification Types

1. Add to notification type list (frontend and backend)
2. Add color/icon mapping in `NotificationCenter.tsx`
3. Use in your services

### Send Email Notifications

Extend `NotificationService` to send emails:
```python
@staticmethod
def create_notification_with_email(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    send_email: bool = True
):
    # Create in-app notification
    notification = NotificationService.create_notification(...)
    
    # Send email
    if send_email:
        # Your email logic here
        send_email_to_user(user_id, title, message)
    
    return notification
```

## Performance Considerations

- Notifications are polled every 10 seconds (configurable)
- For real-time updates, consider WebSocket implementation
- Archive old notifications periodically
- Index `user_id` and `is_read` columns for faster queries

## Dependencies

**Backend:**
- SQLAlchemy
- Pydantic
- FastAPI

**Frontend:**
- React 18+
- React Query
- Lucide React (icons)
- Tailwind CSS

## Database Schema

```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    document_type VARCHAR(40),
    document_id INTEGER,
    document_number VARCHAR(40),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

## Testing

### Manual Testing

1. Create a user
2. Trigger an action that creates a notification
3. Check notification appears in bell icon
4. Click to mark as read
5. Verify unread count decreases

### API Testing (with curl)

```bash
# Get notifications
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/v1/notifications

# Mark as read
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_read": true}' \
  http://localhost:8000/api/v1/notifications/1/read
```

## Troubleshooting

**Notifications not appearing:**
- Check user ID is correct
- Verify notifications table exists
- Check browser console for errors
- Ensure NotificationCenter is in layout

**Refresh not working:**
- Check network tab for failed requests
- Verify user is authenticated
- Check backend logs

**Performance issues:**
- Increase refetchInterval
- Archive old notifications
- Add database indexes

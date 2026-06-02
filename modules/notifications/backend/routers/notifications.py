from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, NotificationMarkReadRequest
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationOut])
def get_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for the current user."""
    notifications = NotificationService.get_user_notifications(db, current_user.id, unread_only)
    return notifications


@router.get("/unread-count", response_model=dict)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get count of unread notifications for the current user."""
    count = NotificationService.get_unread_count(db, current_user.id)
    return {"unread_count": count}


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_as_read(
    notification_id: int,
    body: NotificationMarkReadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read/unread."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot access other user's notification")

    result = NotificationService.mark_as_read(db, notification_id, body.is_read)
    return result


@router.post("/mark-all-read", response_model=dict)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications for the current user as read."""
    count = NotificationService.mark_all_as_read(db, current_user.id)
    return {"marked_as_read": count}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a notification."""
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot delete other user's notification")

    db.delete(notification)
    db.commit()

from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User
from sqlalchemy import and_


class NotificationService:
    """Manages in-app notifications."""

    @staticmethod
    def create_notification(
        db: Session,
        user_id: int,
        notification_type: str,
        title: str,
        message: str,
        document_type: str | None = None,
        document_id: int | None = None,
        document_number: str | None = None,
    ) -> Notification:
        """Create a notification for a user."""
        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            document_type=document_type,
            document_id=document_id,
            document_number=document_number,
        )
        db.add(notification)
        db.commit()
        return notification

    @staticmethod
    def create_notifications_for_role(
        db: Session,
        required_role: str,
        notification_type: str,
        title: str,
        message: str,
        document_type: str | None = None,
        document_id: int | None = None,
        document_number: str | None = None,
    ) -> list[Notification]:
        """Create notifications for all users with a specific role."""
        users = db.query(User).filter(User.role == required_role, User.is_active == True).all()
        notifications = []
        for user in users:
            notification = NotificationService.create_notification(
                db,
                user.id,
                notification_type,
                title,
                message,
                document_type,
                document_id,
                document_number,
            )
            notifications.append(notification)
        return notifications

    @staticmethod
    def get_user_notifications(db: Session, user_id: int, unread_only: bool = False) -> list[Notification]:
        """Get notifications for a user, optionally filtered to unread only."""
        q = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            q = q.filter(Notification.is_read == False)
        return q.order_by(Notification.created_at.desc()).all()

    @staticmethod
    def mark_as_read(db: Session, notification_id: int, is_read: bool = True) -> Notification | None:
        """Mark a notification as read/unread."""
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if notification:
            notification.is_read = is_read
            db.commit()
            db.refresh(notification)
        return notification

    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Mark all notifications for a user as read."""
        count = db.query(Notification).filter(
            and_(Notification.user_id == user_id, Notification.is_read == False)
        ).update({"is_read": True})
        db.commit()
        return count

    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Get count of unread notifications for a user."""
        return db.query(Notification).filter(
            and_(Notification.user_id == user_id, Notification.is_read == False)
        ).count()

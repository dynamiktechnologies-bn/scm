from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(40))  # APPROVAL_PENDING, APPROVED, REJECTED, SUBMITTED, etc.
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Reference to the document being notified about
    document_type: Mapped[str | None] = mapped_column(String(40))  # PO, GRN, SO, etc.
    document_id: Mapped[int | None] = mapped_column(Integer)
    document_number: Mapped[str | None] = mapped_column(String(40))  # PO-001, GRN-002, etc.

    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<Notification {self.id}: {self.type} to user {self.user_id}>"

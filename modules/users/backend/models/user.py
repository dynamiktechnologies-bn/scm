from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="STAFF")  # ADMIN | MANAGER | STAFF
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

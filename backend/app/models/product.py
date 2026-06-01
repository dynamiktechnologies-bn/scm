from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UoM(Base):
    __tablename__ = "uom"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    uom_id: Mapped[int] = mapped_column(ForeignKey("uom.id"), nullable=False)
    reorder_point: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    reorder_qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    preferred_supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    valuation_method: Mapped[str] = mapped_column(String(20), default="WAVG")  # FIFO | WAVG
    inventory_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    cogs_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    revenue_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    current_avg_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    uom: Mapped["UoM"] = relationship("UoM")
    preferred_supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[preferred_supplier_id])  # type: ignore
    inventory_account: Mapped["Account"] = relationship("Account", foreign_keys=[inventory_account_id])  # type: ignore
    cogs_account: Mapped["Account"] = relationship("Account", foreign_keys=[cogs_account_id])  # type: ignore
    revenue_account: Mapped["Account"] = relationship("Account", foreign_keys=[revenue_account_id])  # type: ignore

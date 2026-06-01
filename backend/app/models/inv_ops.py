from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class InventoryAdjustment(Base):
    __tablename__ = "inventory_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    adj_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    adj_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(40))
    # DAMAGE | THEFT | COUNT_CORRECTION | WRITE_OFF
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    location: Mapped["Location"] = relationship("Location")  # type: ignore
    lines: Mapped[list["AdjustmentLine"]] = relationship(back_populates="adjustment", cascade="all, delete-orphan")


class AdjustmentLine(Base):
    __tablename__ = "adjustment_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    adj_id: Mapped[int] = mapped_column(ForeignKey("inventory_adjustments.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_system: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    qty_actual: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    it_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_transactions.id"))

    adjustment: Mapped["InventoryAdjustment"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    from_location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    to_location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    from_location: Mapped["Location"] = relationship("Location", foreign_keys=[from_location_id])  # type: ignore
    to_location: Mapped["Location"] = relationship("Location", foreign_keys=[to_location_id])  # type: ignore
    lines: Mapped[list["TransferLine"]] = relationship(back_populates="transfer", cascade="all, delete-orphan")


class TransferLine(Base):
    __tablename__ = "transfer_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_id: Mapped[int] = mapped_column(ForeignKey("stock_transfers.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    out_it_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_transactions.id"))
    in_it_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_transactions.id"))

    transfer: Mapped["StockTransfer"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore

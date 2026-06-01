from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, SmallInteger, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    txn_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # GRN_RECEIPT | GRN_RETURN | SO_SHIPMENT | SO_RETURN
    # INV_ADJUST_IN | INV_ADJUST_OUT | STOCK_TRANSFER_OUT | STOCK_TRANSFER_IN | OPENING
    reference_type: Mapped[str | None] = mapped_column(String(30))
    reference_id: Mapped[int | None] = mapped_column(Integer)
    reference_line: Mapped[int | None] = mapped_column(Integer)
    qty: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    direction: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 1=IN  -1=OUT
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=Decimal("0"))
    txn_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    product: Mapped["Product"] = relationship("Product")  # type: ignore
    location: Mapped["Location"] = relationship("Location")  # type: ignore

    __table_args__ = (
        Index("idx_it_product_loc", "product_id", "location_id"),
        Index("idx_it_date", "txn_date"),
    )


class FifoLayer(Base):
    __tablename__ = "fifo_layers"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    grn_txn_id: Mapped[int] = mapped_column(ForeignKey("inventory_transactions.id"), nullable=False)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty_received: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    qty_remaining: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    __table_args__ = (
        Index("idx_fl_product", "product_id", "location_id", "receipt_date"),
    )

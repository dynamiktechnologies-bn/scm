from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Date, Numeric, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PurchaseRequisition(Base):
    __tablename__ = "purchase_requisitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    pr_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    # DRAFT | SUBMITTED | APPROVED | CLOSED
    requested_by: Mapped[int | None] = mapped_column(Integer)
    approved_by: Mapped[int | None] = mapped_column(Integer)
    required_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    lines: Mapped[list["PRLine"]] = relationship(back_populates="pr", cascade="all, delete-orphan")


class PRLine(Base):
    __tablename__ = "pr_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    pr_id: Mapped[int] = mapped_column(ForeignKey("purchase_requisitions.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_requested: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    pr: Mapped["PurchaseRequisition"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    pr_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_requisitions.id"))
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")
    # DRAFT | SUBMITTED | APPROVED | PARTIALLY_RECEIVED | FULLY_RECEIVED | CANCELLED
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_date: Mapped[date | None] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    supplier: Mapped["Supplier"] = relationship("Supplier")  # type: ignore
    lines: Mapped[list["POLine"]] = relationship(back_populates="po", cascade="all, delete-orphan")


class POLine(Base):
    __tablename__ = "po_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_ordered: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    qty_received: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0"))
    notes: Mapped[str | None] = mapped_column(Text)

    po: Mapped["PurchaseOrder"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore


class GoodsReceipt(Base):
    __tablename__ = "goods_receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    po_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT | POSTED
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_ref: Mapped[str | None] = mapped_column(String(60))
    je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    supplier: Mapped["Supplier"] = relationship("Supplier")  # type: ignore
    location: Mapped["Location"] = relationship("Location")  # type: ignore
    po: Mapped["PurchaseOrder"] = relationship("PurchaseOrder")  # type: ignore
    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", foreign_keys=[je_id])  # type: ignore
    lines: Mapped[list["GRNLine"]] = relationship(back_populates="grn", cascade="all, delete-orphan")


class GRNLine(Base):
    __tablename__ = "grn_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_id: Mapped[int] = mapped_column(ForeignKey("goods_receipts.id", ondelete="CASCADE"))
    po_line_id: Mapped[int | None] = mapped_column(ForeignKey("po_lines.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_received: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    it_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_transactions.id"))

    grn: Mapped["GoodsReceipt"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore
    po_line: Mapped["POLine"] = relationship("POLine")  # type: ignore


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    inv_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    grn_id: Mapped[int | None] = mapped_column(ForeignKey("goods_receipts.id"))
    po_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    status: Mapped[str] = mapped_column(String(20), default="RECEIVED")
    # RECEIVED | MATCHED | APPROVED | PAID
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    supplier: Mapped["Supplier"] = relationship("Supplier")  # type: ignore
    grn: Mapped["GoodsReceipt"] = relationship("GoodsReceipt")  # type: ignore


class PurchaseReturn(Base):
    __tablename__ = "purchase_returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    grn_id: Mapped[int] = mapped_column(ForeignKey("goods_receipts.id"), nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    supplier: Mapped["Supplier"] = relationship("Supplier")  # type: ignore
    grn: Mapped["GoodsReceipt"] = relationship("GoodsReceipt")  # type: ignore
    lines: Mapped[list["PurchaseReturnLine"]] = relationship(back_populates="pr_return", cascade="all, delete-orphan")


class PurchaseReturnLine(Base):
    __tablename__ = "purchase_return_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("purchase_returns.id", ondelete="CASCADE"))
    grn_line_id: Mapped[int | None] = mapped_column(ForeignKey("grn_lines.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_returned: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    pr_return: Mapped["PurchaseReturn"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore

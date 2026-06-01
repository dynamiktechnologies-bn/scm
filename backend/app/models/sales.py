from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Numeric, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    so_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")
    # DRAFT | CONFIRMED | PICKING | PARTIALLY_SHIPPED | FULLY_SHIPPED | CANCELLED
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    required_date: Mapped[date | None] = mapped_column(Date)
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

    customer: Mapped["Customer"] = relationship("Customer")  # type: ignore
    lines: Mapped[list["SOLine"]] = relationship(back_populates="so", cascade="all, delete-orphan")
    shipments: Mapped[list["Shipment"]] = relationship(back_populates="so")


class SOLine(Base):
    __tablename__ = "so_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_ordered: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    qty_shipped: Mapped[Decimal] = mapped_column(Numeric(15, 4), default=Decimal("0"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=Decimal("0"))
    notes: Mapped[str | None] = mapped_column(Text)

    so: Mapped["SalesOrder"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT | POSTED
    ship_date: Mapped[date] = mapped_column(Date, nullable=False)
    carrier: Mapped[str | None] = mapped_column(String(60))
    tracking_ref: Mapped[str | None] = mapped_column(String(60))
    cogs_je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    sales_je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_by: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    so: Mapped["SalesOrder"] = relationship(back_populates="shipments")
    customer: Mapped["Customer"] = relationship("Customer")  # type: ignore
    location: Mapped["Location"] = relationship("Location")  # type: ignore
    lines: Mapped[list["ShipmentLine"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")


class ShipmentLine(Base):
    __tablename__ = "shipment_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id", ondelete="CASCADE"))
    so_line_id: Mapped[int | None] = mapped_column(ForeignKey("so_lines.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_shipped: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    it_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_transactions.id"))

    shipment: Mapped["Shipment"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore
    so_line: Mapped["SOLine"] = relationship("SOLine")  # type: ignore


class SalesReturn(Base):
    __tablename__ = "sales_returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    shipment_id: Mapped[int] = mapped_column(ForeignKey("shipments.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")
    return_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    je_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    shipment: Mapped["Shipment"] = relationship("Shipment")
    lines: Mapped[list["SalesReturnLine"]] = relationship(back_populates="sr_return", cascade="all, delete-orphan")


class SalesReturnLine(Base):
    __tablename__ = "sales_return_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("sales_returns.id", ondelete="CASCADE"))
    shipment_line_id: Mapped[int | None] = mapped_column(ForeignKey("shipment_lines.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    qty_returned: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)

    sr_return: Mapped["SalesReturn"] = relationship(back_populates="lines")
    product: Mapped["Product"] = relationship("Product")  # type: ignore

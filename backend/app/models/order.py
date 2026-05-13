import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    PREVISUALIZADO = "PREVISUALIZADO"
    CONFIRMADO = "CONFIRMADO"
    DESPACHADO = "DESPACHADO"


order_status_enum = PGEnum(OrderStatus, name="order_status", create_type=False)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        index=True,
    )
    client_name_raw: Mapped[str | None] = mapped_column(String(255))
    order_date: Mapped[date | None] = mapped_column(Date)
    transport: Mapped[str | None] = mapped_column(String(255))
    file_name: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[OrderStatus] = mapped_column(
        order_status_enum, nullable=False, server_default="PENDIENTE", index=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )
    imported_by: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL")
    )
    product_code_raw: Mapped[str | None] = mapped_column(String(50))
    product_name_raw: Mapped[str | None] = mapped_column(String(255))
    quantity_boxes_requested: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    quantity_boxes_available: Mapped[int | None] = mapped_column(Integer)
    quantity_boxes_shortage: Mapped[int | None] = mapped_column(Integer)
    quantity_boxes_after_dispatch: Mapped[int | None] = mapped_column(Integer)
    has_shortage: Mapped[bool] = mapped_column(
        Boolean, Computed("quantity_boxes_shortage > 0", persisted=True)
    )
    will_go_negative: Mapped[bool] = mapped_column(
        Boolean, Computed("quantity_boxes_after_dispatch < 0", persisted=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order: Mapped["Order"] = relationship(back_populates="items")

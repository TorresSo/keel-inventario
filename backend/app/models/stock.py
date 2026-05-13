import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MovementType(str, enum.Enum):
    INGRESO_PRODUCCION = "INGRESO_PRODUCCION"
    INGRESO_RECEPCION = "INGRESO_RECEPCION"
    EGRESO_DESPACHO = "EGRESO_DESPACHO"
    EGRESO_MERMA = "EGRESO_MERMA"
    AJUSTE = "AJUSTE"
    REVERSA = "REVERSA"


movement_type_enum = PGEnum(MovementType, name="movement_type", create_type=False)


class StockCurrent(Base):
    __tablename__ = "stock_current"

    product_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    quantity_boxes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    quantity_units: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_movement_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    movement_type: Mapped[MovementType] = mapped_column(movement_type_enum, nullable=False)
    quantity_boxes: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_units: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_after_boxes: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_after_units: Mapped[int] = mapped_column(Integer, nullable=False)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL")
    )
    reversed_movement_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("stock_movements.id", ondelete="RESTRICT")
    )
    is_negative_dispatch: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index(
            "idx_movements_no_double_reversal",
            "reversed_movement_id",
            unique=True,
            postgresql_where=text("reversed_movement_id IS NOT NULL"),
        ),
    )

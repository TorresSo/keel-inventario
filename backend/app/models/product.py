import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM as PGEnum, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductOrigin(str, enum.Enum):
    FABRICACION_PROPIA = "FABRICACION_PROPIA"
    IMPORTADO_BRASIL = "IMPORTADO_BRASIL"
    IMPORTADO_CHINA = "IMPORTADO_CHINA"


class ProductCategory(str, enum.Enum):
    ESCOBILLONES = "ESCOBILLONES"
    BASES_Y_CABOS = "BASES_Y_CABOS"
    CEPILLOS = "CEPILLOS"
    BALDES_Y_ACCESORIOS = "BALDES_Y_ACCESORIOS"
    INSUMOS = "INSUMOS"
    MATERIA_PRIMA = "MATERIA_PRIMA"
    FIBRA = "FIBRA"


product_origin_enum = PGEnum(ProductOrigin, name="product_origin", create_type=False)
product_category_enum = PGEnum(ProductCategory, name="product_category", create_type=False)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[ProductCategory] = mapped_column(
        product_category_enum, nullable=False, index=True
    )
    origin: Mapped[ProductOrigin] = mapped_column(
        product_origin_enum, nullable=False, server_default="FABRICACION_PROPIA"
    )
    pack_size: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    min_stock_boxes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

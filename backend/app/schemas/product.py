import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.product import ProductCategory, ProductOrigin


class ProductBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: ProductCategory
    origin: ProductOrigin = ProductOrigin.FABRICACION_PROPIA
    pack_size: int = Field(default=1, ge=1)
    min_stock_boxes: int = Field(default=0, ge=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    category: ProductCategory | None = None
    origin: ProductOrigin | None = None
    pack_size: int | None = Field(default=None, ge=1)
    min_stock_boxes: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

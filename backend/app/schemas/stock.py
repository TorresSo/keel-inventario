import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.stock import MovementType


class StockCurrentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    product_code: str
    product_name: str
    category: str
    origin: str
    quantity_boxes: int
    quantity_units: int
    min_stock_boxes: int
    pack_size: int
    last_movement_at: datetime | None
    is_below_minimum: bool


class StockAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: uuid.UUID
    product_code: str
    product_name: str
    quantity_boxes: int
    min_stock_boxes: int
    shortage_boxes: int


class MovementCreate(BaseModel):
    product_id: uuid.UUID
    movement_type: MovementType
    quantity_boxes: int = Field(description="Positive for inflow, negative for outflow")
    quantity_units: int = 0
    notes: str | None = None


class MovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    product_code: str | None = None
    product_name: str | None = None
    movement_type: MovementType
    quantity_boxes: int
    quantity_units: int
    stock_after_boxes: int
    stock_after_units: int
    order_id: uuid.UUID | None
    reversed_movement_id: uuid.UUID | None
    is_negative_dispatch: bool
    notes: str | None
    created_by: uuid.UUID
    created_at: datetime


class ReverseMovementRequest(BaseModel):
    notes: str | None = None
    confirm_negative: bool = Field(
        default=False,
        description="Must be true if reversing this movement leaves stock negative",
    )

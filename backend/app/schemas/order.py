import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.order import OrderStatus


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    product_id: uuid.UUID | None
    product_code_raw: str | None
    product_name_raw: str | None
    product_code: str | None = None
    product_name: str | None = None
    quantity_boxes_requested: int
    quantity_boxes_available: int | None
    quantity_boxes_shortage: int | None
    quantity_boxes_after_dispatch: int | None
    has_shortage: bool
    will_go_negative: bool


class OrderItemUpdateRequest(BaseModel):
    quantity_boxes_requested: int = Field(ge=0)


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID | None
    client_name_raw: str | None
    order_date: date | None
    transport: str | None
    file_name: str | None
    status: OrderStatus
    confirmed_at: datetime | None
    confirmed_by: uuid.UUID | None
    imported_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class OrderDetailResponse(OrderResponse):
    items: list[OrderItemResponse]


class OrderPreviewResponse(BaseModel):
    orders: list[OrderDetailResponse]
    parsed_via_ocr: bool = False
    warnings: list[str] = []


class ConfirmDispatchRequest(BaseModel):
    accept_negative: bool = Field(
        default=False,
        description="Must be true to confirm dispatch when one or more items would leave stock negative",
    )


class ConfirmDispatchConflictDetail(BaseModel):
    product_code: str
    product_name: str
    quantity_requested: int
    quantity_available: int
    quantity_after_dispatch: int

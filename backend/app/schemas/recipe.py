import uuid

from pydantic import BaseModel, ConfigDict, Field


class RecipeItem(BaseModel):
    component_id: uuid.UUID
    quantity_per_box: int = Field(ge=1, description="Units of component consumed per box of finished product")


class RecipeItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    component_id: uuid.UUID
    component_code: str
    component_name: str
    component_pack_size: int
    component_current_units: int
    quantity_per_box: int


class RecipeUpdateRequest(BaseModel):
    items: list[RecipeItem]


class ProduceRequest(BaseModel):
    product_id: uuid.UUID
    quantity_boxes: int = Field(ge=1)
    notes: str | None = None
    force: bool = Field(
        default=False,
        description="Allow production even when component stock would go negative",
    )


class ProduceConsumptionDetail(BaseModel):
    component_id: uuid.UUID
    component_code: str
    component_name: str
    units_consumed: int
    boxes_consumed: int
    units_available_before: int
    units_available_after: int
    shortage_units: int = 0


class ProduceResponse(BaseModel):
    finished_movement_id: uuid.UUID
    finished_product_code: str
    finished_quantity_boxes: int
    consumed: list[ProduceConsumptionDetail]


class ProducibilityRow(BaseModel):
    product_id: uuid.UUID
    product_code: str
    product_name: str
    product_category: str
    producible_boxes: int
    limiting_component_code: str | None = None
    limiting_component_name: str | None = None
    components_count: int


class ProducibilityResponse(BaseModel):
    intermediates: list[ProducibilityRow]
    finals: list[ProducibilityRow]

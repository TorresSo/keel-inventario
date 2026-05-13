import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    cuit: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    locality: str | None = Field(default=None, max_length=255)
    province: str | None = Field(default=None, max_length=100)
    transport: str | None = Field(default=None, max_length=255)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    cuit: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=500)
    locality: str | None = Field(default=None, max_length=255)
    province: str | None = Field(default=None, max_length=100)
    transport: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class ClientResponse(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

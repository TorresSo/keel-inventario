import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None = None
    action: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    payload: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime

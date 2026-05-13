from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_gerencia
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_log(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    entity_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_gerencia),
) -> list[dict]:
    stmt = (
        select(
            AuditLog.id,
            AuditLog.user_id,
            User.email.label("user_email"),
            AuditLog.action,
            AuditLog.entity_type,
            AuditLog.entity_id,
            AuditLog.payload,
            AuditLog.ip_address,
            AuditLog.created_at,
        )
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)

    result = await db.execute(stmt)
    return [
        {
            "id": row.id,
            "user_id": row.user_id,
            "user_email": row.user_email,
            "action": row.action,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "payload": row.payload,
            "ip_address": str(row.ip_address) if row.ip_address else None,
            "created_at": row.created_at,
        }
        for row in result.all()
    ]

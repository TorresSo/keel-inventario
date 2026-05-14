import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_any_role, require_gerencia
from app.models.user import User
from app.schemas.stock import (
    MovementCreate,
    MovementResponse,
    ReverseMovementRequest,
    StockAlertResponse,
    StockCurrentResponse,
)
from app.services import stock_service

router = APIRouter(prefix="/api/v1/stock", tags=["stock"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[StockCurrentResponse])
async def list_current_stock(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[dict]:
    return await stock_service.list_current_stock(db)


@router.get("/alerts", response_model=list[StockAlertResponse])
async def list_alerts(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[dict]:
    return await stock_service.list_alerts(db)


@router.get("/movements", response_model=list[MovementResponse])
async def list_all_movements(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[dict]:
    return await stock_service.list_movements(db, limit=limit, offset=offset)


@router.get("/{product_id}/movements", response_model=list[MovementResponse])
async def list_movements_for_product(
    product_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[dict]:
    return await stock_service.list_movements(
        db, product_id=product_id, limit=limit, offset=offset
    )


@router.post(
    "/movement",
    response_model=MovementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_movement(
    payload: MovementCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_any_role),
) -> MovementResponse:
    movement = await stock_service.register_movement(
        db,
        product_id=payload.product_id,
        movement_type=payload.movement_type,
        quantity_boxes=payload.quantity_boxes,
        quantity_units=payload.quantity_units,
        user_id=user.id,
        notes=payload.notes,
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(movement)
    return MovementResponse.model_validate(movement)


@router.post(
    "/movements/{movement_id}/reverse",
    response_model=MovementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def reverse_movement(
    movement_id: uuid.UUID,
    payload: ReverseMovementRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_gerencia),
) -> MovementResponse:
    movement = await stock_service.reverse_movement(
        db,
        movement_id=movement_id,
        user_id=user.id,
        notes=payload.notes,
        confirm_negative=payload.confirm_negative,
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(movement)
    return MovementResponse.model_validate(movement)

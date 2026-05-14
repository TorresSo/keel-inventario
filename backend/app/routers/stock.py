import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
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


@router.get("/export", response_class=StreamingResponse)
async def export_stock_xlsx(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> StreamingResponse:
    """Download a snapshot of current stock as a multi-sheet XLSX (one sheet per category)."""
    from openpyxl import Workbook

    rows = await stock_service.list_current_stock(db)

    wb = Workbook()
    wb.remove(wb.active)

    by_cat: dict[str, list[dict]] = {}
    for r in rows:
        cat_key = (
            r["category"].value if hasattr(r["category"], "value") else str(r["category"])
        )
        by_cat.setdefault(cat_key, []).append(r)

    for cat in sorted(by_cat):
        ws = wb.create_sheet(cat[:31])
        ws.append(
            [
                "Código",
                "Nombre",
                "Origen",
                "FR (unid/caja)",
                "Cajas",
                "Unidades",
                "Mínimo",
                "Alerta",
            ]
        )
        for r in sorted(by_cat[cat], key=lambda x: x["product_name"]):
            origin = (
                r["origin"].value if hasattr(r["origin"], "value") else str(r["origin"])
            )
            ws.append(
                [
                    r["product_code"],
                    r["product_name"],
                    origin,
                    r["pack_size"],
                    r["quantity_boxes"],
                    r["quantity_units"],
                    r["min_stock_boxes"],
                    "BAJO" if r["is_below_minimum"] else "OK",
                ]
            )
        # Reasonable column widths
        for col_letter, width in zip("ABCDEFGH", (12, 42, 18, 10, 10, 12, 10, 10)):
            ws.column_dimensions[col_letter].width = width

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"stock-keel-{datetime.now().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        buf,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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

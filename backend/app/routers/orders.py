import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_any_role
from app.models.user import User
from app.schemas.order import (
    ConfirmDispatchRequest,
    OrderDetailResponse,
    OrderItemResponse,
    OrderItemUpdateRequest,
    OrderPreviewResponse,
    OrderResponse,
)
from app.services import order_service
from app.services.file_parser_service import FileParserService

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

_parser_service = FileParserService()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=list[OrderResponse])
async def list_orders(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
):
    return await order_service.list_orders(db, limit=limit, offset=offset)


@router.post(
    "/upload",
    response_model=OrderPreviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_order(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_any_role),
) -> OrderPreviewResponse:
    parsed = await _parser_service.parse(file)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract any order from the file",
        )

    orders = await order_service.create_orders_from_parsed(
        db,
        parsed_orders=parsed,
        user_id=user.id,
        file_name=file.filename,
    )
    for o in orders:
        await order_service.preview_order(db, o.id)

    await db.commit()
    db.expire_all()

    detailed = []
    for o in orders:
        detail = await order_service.get_order_detail(db, o.id)
        if detail is not None:
            detailed.append(OrderDetailResponse.model_validate(detail))

    return OrderPreviewResponse(
        orders=detailed,
        parsed_via_ocr=any(p.source_via_ocr for p in parsed),
        warnings=[w for p in parsed for w in p.warnings],
    )


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_order(
    order_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
):
    order = await order_service.get_order_detail(db, order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    return order


@router.patch(
    "/{order_id}/items/{item_id}", response_model=OrderItemResponse
)
async def update_order_item(
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: OrderItemUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
):
    item = await order_service.update_order_item(
        db,
        order_id=order_id,
        item_id=item_id,
        new_quantity=payload.quantity_boxes_requested,
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_dispatch(
    order_id: uuid.UUID,
    payload: ConfirmDispatchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_any_role),
):
    order = await order_service.confirm_dispatch(
        db,
        order_id=order_id,
        user_id=user.id,
        accept_negative=payload.accept_negative,
        ip_address=_client_ip(request),
    )
    await db.commit()
    await db.refresh(order)
    return order

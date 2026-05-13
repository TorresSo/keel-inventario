import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit import AuditLog
from app.models.client import Client
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.models.stock import MovementType, StockCurrent
from app.services import stock_service
from app.services.file_parser_service import ParsedOrder


async def _match_product(db: AsyncSession, code: str | None) -> Product | None:
    if not code:
        return None
    code = code.strip()
    if not code:
        return None
    result = await db.execute(select(Product).where(Product.code == code))
    return result.scalar_one_or_none()


async def _match_or_create_client(
    db: AsyncSession, name: str | None, transport: str | None
) -> Client | None:
    if not name:
        return None
    name = name.strip()
    if not name:
        return None
    result = await db.execute(select(Client).where(Client.name.ilike(name)))
    client = result.scalar_one_or_none()
    if client is None:
        client = Client(name=name, transport=transport)
        db.add(client)
        await db.flush()
    return client


async def _get_order_with_items(db: AsyncSession, order_id: uuid.UUID) -> Order | None:
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items))
    )
    return result.scalar_one_or_none()


async def create_orders_from_parsed(
    db: AsyncSession,
    *,
    parsed_orders: list[ParsedOrder],
    user_id: uuid.UUID,
    file_name: str | None,
) -> list[Order]:
    created: list[Order] = []
    for parsed in parsed_orders:
        client = await _match_or_create_client(db, parsed.client_name, parsed.transport)
        order = Order(
            client_id=client.id if client else None,
            client_name_raw=parsed.client_name,
            order_date=parsed.order_date,
            transport=parsed.transport,
            file_name=file_name,
            status=OrderStatus.PENDIENTE,
            imported_by=user_id,
        )
        db.add(order)
        await db.flush()

        for item in parsed.items:
            product = await _match_product(db, item.code)
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id if product else None,
                    product_code_raw=item.code,
                    product_name_raw=item.name,
                    quantity_boxes_requested=item.quantity_boxes,
                )
            )
        await db.flush()
        created.append(order)
    return created


async def preview_order(db: AsyncSession, order_id: uuid.UUID) -> Order:
    order = await _get_order_with_items(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    for item in order.items:
        if item.product_id is None:
            available = 0
        else:
            stock = (
                await db.execute(
                    select(StockCurrent).where(StockCurrent.product_id == item.product_id)
                )
            ).scalar_one_or_none()
            available = stock.quantity_boxes if stock else 0

        requested = item.quantity_boxes_requested or 0
        item.quantity_boxes_available = available
        item.quantity_boxes_shortage = max(0, requested - available)
        item.quantity_boxes_after_dispatch = available - requested

    order.status = OrderStatus.PREVISUALIZADO
    await db.flush()
    return order


async def update_order_item(
    db: AsyncSession,
    *,
    order_id: uuid.UUID,
    item_id: uuid.UUID,
    new_quantity: int,
) -> OrderItem:
    order = (
        await db.execute(select(Order).where(Order.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.PREVISUALIZADO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Order must be in PREVISUALIZADO status to edit items "
                f"(current: {order.status.value})"
            ),
        )

    item = (
        await db.execute(
            select(OrderItem).where(
                OrderItem.id == item_id, OrderItem.order_id == order_id
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order item not found")

    if item.product_id is None:
        available = 0
    else:
        stock = (
            await db.execute(
                select(StockCurrent).where(StockCurrent.product_id == item.product_id)
            )
        ).scalar_one_or_none()
        available = stock.quantity_boxes if stock else 0

    item.quantity_boxes_requested = new_quantity
    item.quantity_boxes_available = available
    item.quantity_boxes_shortage = max(0, new_quantity - available)
    item.quantity_boxes_after_dispatch = available - new_quantity
    await db.flush()
    return item


async def confirm_dispatch(
    db: AsyncSession,
    *,
    order_id: uuid.UUID,
    user_id: uuid.UUID,
    accept_negative: bool = False,
    ip_address: str | None = None,
) -> Order:
    order = await _get_order_with_items(db, order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status != OrderStatus.PREVISUALIZADO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Order must be in PREVISUALIZADO status to confirm "
                f"(current: {order.status.value})"
            ),
        )

    conflicts: list[dict] = []
    for item in order.items:
        if item.product_id is None or item.quantity_boxes_requested <= 0:
            continue
        stock = (
            await db.execute(
                select(StockCurrent)
                .where(StockCurrent.product_id == item.product_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        available = stock.quantity_boxes if stock else 0
        after = available - item.quantity_boxes_requested

        item.quantity_boxes_available = available
        item.quantity_boxes_shortage = max(0, item.quantity_boxes_requested - available)
        item.quantity_boxes_after_dispatch = after

        if after < 0:
            conflicts.append(
                {
                    "item_id": str(item.id),
                    "product_code": item.product_code_raw,
                    "product_name": item.product_name_raw,
                    "quantity_requested": item.quantity_boxes_requested,
                    "quantity_available": available,
                    "quantity_after_dispatch": after,
                }
            )

    if conflicts and not accept_negative:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DISPATCH_WOULD_GO_NEGATIVE", "conflicts": conflicts},
        )

    for item in order.items:
        if item.product_id is None or item.quantity_boxes_requested <= 0:
            continue
        await stock_service.register_movement(
            db,
            product_id=item.product_id,
            movement_type=MovementType.EGRESO_DESPACHO,
            quantity_boxes=-item.quantity_boxes_requested,
            quantity_units=0,
            user_id=user_id,
            notes=f"Dispatch order {order.id}",
            order_id=order.id,
            is_negative_dispatch=(item.quantity_boxes_after_dispatch or 0) < 0,
            ip_address=ip_address,
        )

    order.status = OrderStatus.CONFIRMADO
    order.confirmed_by = user_id
    order.confirmed_at = datetime.now(timezone.utc)

    db.add(
        AuditLog(
            user_id=user_id,
            action="CONFIRM_DISPATCH",
            entity_type="order",
            entity_id=order.id,
            payload={
                "order_id": str(order.id),
                "items_dispatched": len(
                    [i for i in order.items if i.product_id and i.quantity_boxes_requested > 0]
                ),
                "accepted_negative": accept_negative,
                "had_conflicts": bool(conflicts),
            },
            ip_address=ip_address,
        )
    )
    await db.flush()
    return order


async def list_orders(
    db: AsyncSession, *, limit: int = 50, offset: int = 0
) -> list[Order]:
    result = await db.execute(
        select(Order).order_by(Order.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_order_detail(db: AsyncSession, order_id: uuid.UUID) -> Order | None:
    return await _get_order_with_items(db, order_id)

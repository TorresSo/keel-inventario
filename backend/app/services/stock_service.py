import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.product import Product
from app.models.stock import MovementType, StockCurrent, StockMovement


async def _lock_or_create_stock(db: AsyncSession, product_id: uuid.UUID) -> StockCurrent:
    result = await db.execute(
        select(StockCurrent)
        .where(StockCurrent.product_id == product_id)
        .with_for_update()
    )
    stock = result.scalar_one_or_none()
    if stock is None:
        stock = StockCurrent(product_id=product_id, quantity_boxes=0, quantity_units=0)
        db.add(stock)
        await db.flush()
    return stock


async def register_movement(
    db: AsyncSession,
    *,
    product_id: uuid.UUID,
    movement_type: MovementType,
    quantity_boxes: int,
    quantity_units: int,
    user_id: uuid.UUID,
    notes: str | None = None,
    order_id: uuid.UUID | None = None,
    is_negative_dispatch: bool = False,
    reversed_movement_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    audit_payload_extra: dict | None = None,
) -> StockMovement:
    """Insert movement + update stock_current + audit_log in a single transaction unit.

    Does NOT commit — caller (router or order_service) is responsible for that
    so multiple movements can be batched in one DB transaction.
    """
    stock = await _lock_or_create_stock(db, product_id)

    stock.quantity_boxes += quantity_boxes
    stock.quantity_units += quantity_units
    stock.last_movement_at = func.now()

    movement = StockMovement(
        product_id=product_id,
        movement_type=movement_type,
        quantity_boxes=quantity_boxes,
        quantity_units=quantity_units,
        stock_after_boxes=stock.quantity_boxes,
        stock_after_units=stock.quantity_units,
        order_id=order_id,
        reversed_movement_id=reversed_movement_id,
        is_negative_dispatch=is_negative_dispatch,
        notes=notes,
        created_by=user_id,
    )
    db.add(movement)
    await db.flush()

    audit_payload: dict = {
        "movement_id": str(movement.id),
        "product_id": str(product_id),
        "movement_type": movement_type.value,
        "quantity_boxes": quantity_boxes,
        "quantity_units": quantity_units,
        "stock_after_boxes": stock.quantity_boxes,
        "stock_after_units": stock.quantity_units,
        "order_id": str(order_id) if order_id else None,
        "is_negative_dispatch": is_negative_dispatch,
    }
    if audit_payload_extra:
        audit_payload.update(audit_payload_extra)

    audit = AuditLog(
        user_id=user_id,
        action=f"STOCK_{movement_type.value}",
        entity_type="stock_movement",
        entity_id=movement.id,
        payload=audit_payload,
        ip_address=ip_address,
    )
    db.add(audit)
    await db.flush()

    return movement


async def reverse_movement(
    db: AsyncSession,
    *,
    movement_id: uuid.UUID,
    user_id: uuid.UUID,
    notes: str | None = None,
    confirm_negative: bool = False,
    ip_address: str | None = None,
) -> StockMovement:
    original = (
        await db.execute(
            select(StockMovement)
            .where(StockMovement.id == movement_id)
            .with_for_update()
        )
    ).scalar_one_or_none()

    if original is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Movement not found"
        )

    if original.movement_type == MovementType.REVERSA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reverse a reversal movement",
        )

    already_reversed = (
        await db.execute(
            select(StockMovement.id).where(
                StockMovement.reversed_movement_id == movement_id
            )
        )
    ).scalar_one_or_none()
    if already_reversed is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Movement has already been reversed",
        )

    delta_boxes = -original.quantity_boxes
    delta_units = -original.quantity_units

    stock = await _lock_or_create_stock(db, original.product_id)
    new_boxes = stock.quantity_boxes + delta_boxes
    if new_boxes < 0 and not confirm_negative:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "REVERSAL_WOULD_GO_NEGATIVE",
                "product_id": str(original.product_id),
                "current_boxes": stock.quantity_boxes,
                "boxes_after_reversal": new_boxes,
            },
        )

    return await register_movement(
        db,
        product_id=original.product_id,
        movement_type=MovementType.REVERSA,
        quantity_boxes=delta_boxes,
        quantity_units=delta_units,
        user_id=user_id,
        notes=notes or f"Reversion of movement {original.id}",
        reversed_movement_id=movement_id,
        ip_address=ip_address,
        audit_payload_extra={
            "reversed_movement": {
                "id": str(original.id),
                "type": original.movement_type.value,
                "quantity_boxes": original.quantity_boxes,
                "quantity_units": original.quantity_units,
                "created_at": original.created_at.isoformat()
                if original.created_at
                else None,
                "created_by": str(original.created_by),
            }
        },
    )


async def list_current_stock(db: AsyncSession) -> list[dict]:
    stmt = (
        select(
            Product.id.label("product_id"),
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            Product.category,
            Product.pack_size,
            Product.min_stock_boxes,
            func.coalesce(StockCurrent.quantity_boxes, 0).label("quantity_boxes"),
            func.coalesce(StockCurrent.quantity_units, 0).label("quantity_units"),
            StockCurrent.last_movement_at,
        )
        .select_from(Product)
        .outerjoin(StockCurrent, StockCurrent.product_id == Product.id)
        .where(Product.is_active.is_(True))
        .order_by(Product.code)
    )
    result = await db.execute(stmt)
    return [
        {
            "product_id": row.product_id,
            "product_code": row.product_code,
            "product_name": row.product_name,
            "category": row.category,
            "quantity_boxes": row.quantity_boxes,
            "quantity_units": row.quantity_units,
            "min_stock_boxes": row.min_stock_boxes,
            "pack_size": row.pack_size,
            "last_movement_at": row.last_movement_at,
            "is_below_minimum": row.quantity_boxes < row.min_stock_boxes,
        }
        for row in result.all()
    ]


async def list_alerts(db: AsyncSession) -> list[dict]:
    qty = func.coalesce(StockCurrent.quantity_boxes, 0)
    stmt = (
        select(
            Product.id.label("product_id"),
            Product.code.label("product_code"),
            Product.name.label("product_name"),
            qty.label("quantity_boxes"),
            Product.min_stock_boxes,
        )
        .select_from(Product)
        .outerjoin(StockCurrent, StockCurrent.product_id == Product.id)
        .where(Product.is_active.is_(True), qty < Product.min_stock_boxes)
        .order_by(Product.code)
    )
    result = await db.execute(stmt)
    return [
        {
            "product_id": row.product_id,
            "product_code": row.product_code,
            "product_name": row.product_name,
            "quantity_boxes": row.quantity_boxes,
            "min_stock_boxes": row.min_stock_boxes,
            "shortage_boxes": row.min_stock_boxes - row.quantity_boxes,
        }
        for row in result.all()
    ]


async def list_movements(
    db: AsyncSession,
    *,
    product_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    stmt = (
        select(
            StockMovement,
            Product.code.label("product_code"),
            Product.name.label("product_name"),
        )
        .join(Product, Product.id == StockMovement.product_id)
        .order_by(StockMovement.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)

    result = await db.execute(stmt)
    out = []
    for row in result.all():
        m: StockMovement = row[0]
        out.append(
            {
                "id": m.id,
                "product_id": m.product_id,
                "product_code": row.product_code,
                "product_name": row.product_name,
                "movement_type": m.movement_type,
                "quantity_boxes": m.quantity_boxes,
                "quantity_units": m.quantity_units,
                "stock_after_boxes": m.stock_after_boxes,
                "stock_after_units": m.stock_after_units,
                "order_id": m.order_id,
                "reversed_movement_id": m.reversed_movement_id,
                "is_negative_dispatch": m.is_negative_dispatch,
                "notes": m.notes,
                "created_by": m.created_by,
                "created_at": m.created_at,
            }
        )
    return out

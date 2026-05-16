import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.product import Product
from app.models.recipe import ProductRecipe
from app.models.stock import MovementType, StockCurrent
from app.services import stock_service


async def get_recipe(db: AsyncSession, product_id: uuid.UUID) -> list[dict]:
    C = aliased(Product)
    stmt = (
        select(
            ProductRecipe.id,
            ProductRecipe.component_id,
            ProductRecipe.quantity_per_box,
            C.code.label("component_code"),
            C.name.label("component_name"),
            C.pack_size.label("component_pack_size"),
            StockCurrent.quantity_units.label("component_current_units"),
        )
        .join(C, C.id == ProductRecipe.component_id)
        .outerjoin(
            StockCurrent, StockCurrent.product_id == ProductRecipe.component_id
        )
        .where(ProductRecipe.product_id == product_id)
        .order_by(C.name)
    )
    result = await db.execute(stmt)
    return [
        {
            "id": row.id,
            "component_id": row.component_id,
            "component_code": row.component_code,
            "component_name": row.component_name,
            "component_pack_size": row.component_pack_size or 1,
            "component_current_units": row.component_current_units or 0,
            "quantity_per_box": row.quantity_per_box,
        }
        for row in result.all()
    ]


async def set_recipe(
    db: AsyncSession,
    product_id: uuid.UUID,
    items: list[dict],
) -> list[dict]:
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    seen_components: set[uuid.UUID] = set()
    for item in items:
        if item["component_id"] == product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A product cannot be a component of itself",
            )
        if item["component_id"] in seen_components:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Component {item['component_id']} listed more than once",
            )
        seen_components.add(item["component_id"])
        exists = (
            await db.execute(
                select(Product.id).where(Product.id == item["component_id"])
            )
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Component {item['component_id']} not found",
            )

    await db.execute(
        delete(ProductRecipe).where(ProductRecipe.product_id == product_id)
    )
    for item in items:
        db.add(
            ProductRecipe(
                product_id=product_id,
                component_id=item["component_id"],
                quantity_per_box=item["quantity_per_box"],
            )
        )
    await db.commit()
    return await get_recipe(db, product_id)


def _ceil_div(a: int, b: int) -> int:
    return -(-a // b) if b else 0


async def get_producibility(db: AsyncSession) -> dict:
    """For every product that has a recipe, compute how many boxes can be
    produced from the current component stock (limited by the scarcest
    component). Split into 'intermediates' (products that are also components
    of something else, e.g. cabo, base) and 'finals' (products that are not
    used as a component anywhere, e.g. escobillón terminado).
    """
    P = aliased(Product, name="prod")
    C = aliased(Product, name="comp")
    stmt = (
        select(
            ProductRecipe.product_id,
            P.code.label("product_code"),
            P.name.label("product_name"),
            P.category.label("product_category"),
            ProductRecipe.component_id,
            C.code.label("component_code"),
            C.name.label("component_name"),
            ProductRecipe.quantity_per_box,
            func.coalesce(StockCurrent.quantity_units, 0).label("component_units"),
        )
        .join(P, P.id == ProductRecipe.product_id)
        .join(C, C.id == ProductRecipe.component_id)
        .outerjoin(
            StockCurrent, StockCurrent.product_id == ProductRecipe.component_id
        )
    )
    rows = (await db.execute(stmt)).all()

    by_product: dict = {}
    components_used: set = set()
    for r in rows:
        components_used.add(r.component_id)
        bucket = by_product.setdefault(
            r.product_id,
            {
                "product_id": r.product_id,
                "product_code": r.product_code,
                "product_name": r.product_name,
                "product_category": (
                    r.product_category.value
                    if hasattr(r.product_category, "value")
                    else str(r.product_category)
                ),
                "items": [],
            },
        )
        possible = (
            r.component_units // r.quantity_per_box if r.quantity_per_box > 0 else 0
        )
        bucket["items"].append(
            {
                "component_code": r.component_code,
                "component_name": r.component_name,
                "quantity_per_box": r.quantity_per_box,
                "component_units_available": r.component_units,
                "producible_from_this": possible,
            }
        )

    intermediates: list[dict] = []
    finals: list[dict] = []
    for pid, data in by_product.items():
        if not data["items"]:
            continue
        producible = min(item["producible_from_this"] for item in data["items"])
        limiting = min(data["items"], key=lambda x: x["producible_from_this"])
        out = {
            "product_id": data["product_id"],
            "product_code": data["product_code"],
            "product_name": data["product_name"],
            "product_category": data["product_category"],
            "producible_boxes": producible,
            "limiting_component_code": limiting["component_code"],
            "limiting_component_name": limiting["component_name"],
            "components_count": len(data["items"]),
        }
        (intermediates if pid in components_used else finals).append(out)

    intermediates.sort(key=lambda x: x["product_name"])
    finals.sort(key=lambda x: x["product_name"])
    return {"intermediates": intermediates, "finals": finals}


async def produce(
    db: AsyncSession,
    *,
    product_id: uuid.UUID,
    quantity_boxes: int,
    user_id: uuid.UUID,
    notes: str | None = None,
    force: bool = False,
    ip_address: str | None = None,
) -> dict:
    if quantity_boxes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="quantity_boxes must be > 0",
        )

    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finished product not found"
        )

    recipe = await get_recipe(db, product_id)

    consumed_preview: list[dict] = []
    shortages: list[dict] = []
    for r in recipe:
        pack = r["component_pack_size"] or 1
        units_needed = r["quantity_per_box"] * quantity_boxes
        available = r["component_current_units"]
        units_after = available - units_needed
        boxes_consumed = _ceil_div(units_needed, pack)
        detail = {
            "component_id": r["component_id"],
            "component_code": r["component_code"],
            "component_name": r["component_name"],
            "units_consumed": units_needed,
            "boxes_consumed": boxes_consumed,
            "units_available_before": available,
            "units_available_after": units_after,
            "shortage_units": max(0, -units_after),
        }
        consumed_preview.append(detail)
        if units_after < 0:
            shortages.append(
                {
                    "component_code": r["component_code"],
                    "component_name": r["component_name"],
                    "units_needed": units_needed,
                    "units_available": available,
                    "shortage": -units_after,
                }
            )

    if shortages and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "INSUFFICIENT_COMPONENTS", "shortages": shortages},
        )

    finished_units = product.pack_size * quantity_boxes
    finished_mov = await stock_service.register_movement(
        db,
        product_id=product_id,
        movement_type=MovementType.INGRESO_PRODUCCION,
        quantity_boxes=quantity_boxes,
        quantity_units=finished_units,
        user_id=user_id,
        notes=notes or f"Producción de {quantity_boxes} caja(s)",
        ip_address=ip_address,
        audit_payload_extra={"recipe_components": len(recipe)},
    )

    for preview in consumed_preview:
        await stock_service.register_movement(
            db,
            product_id=preview["component_id"],
            movement_type=MovementType.EGRESO_MERMA,
            quantity_boxes=-preview["boxes_consumed"],
            quantity_units=-preview["units_consumed"],
            user_id=user_id,
            notes=f"Consumo por producción de {product.code} ({quantity_boxes} cajas)",
            ip_address=ip_address,
            audit_payload_extra={
                "produced_product_id": str(product_id),
                "produced_product_code": product.code,
                "produced_boxes": quantity_boxes,
            },
        )

    await db.commit()

    return {
        "finished_movement_id": finished_mov.id,
        "finished_product_code": product.code,
        "finished_quantity_boxes": quantity_boxes,
        "consumed": consumed_preview,
    }

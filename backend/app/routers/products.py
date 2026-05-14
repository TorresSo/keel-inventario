import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_any_role, require_gerencia
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.recipe import RecipeItemResponse, RecipeUpdateRequest
from app.services import recipe_service

router = APIRouter(prefix="/api/v1/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[Product]:
    result = await db.execute(select(Product).order_by(Product.code))
    return list(result.scalars().all())


@router.post(
    "", response_model=ProductResponse, status_code=status.HTTP_201_CREATED
)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_gerencia),
) -> Product:
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product code '{payload.code}' already exists",
        )
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_gerencia),
) -> Product:
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}/recipe", response_model=list[RecipeItemResponse])
async def get_recipe(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_any_role),
) -> list[dict]:
    return await recipe_service.get_recipe(db, product_id)


@router.put("/{product_id}/recipe", response_model=list[RecipeItemResponse])
async def set_recipe(
    product_id: uuid.UUID,
    payload: RecipeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_gerencia),
) -> list[dict]:
    items = [
        {"component_id": i.component_id, "quantity_per_box": i.quantity_per_box}
        for i in payload.items
    ]
    return await recipe_service.set_recipe(db, product_id, items)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_gerencia),
) -> None:
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )
    product.is_active = False
    await db.commit()

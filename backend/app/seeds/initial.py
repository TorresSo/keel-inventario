"""Initial seed: admin user + full product catalog + opening stock.

The catalog is read directly from STOCK AL DIA 2024.xlsx (the real spreadsheet
KEEL uses today). 175 products across 11 categories from 3 origins.

Idempotent: re-running skips records that already exist.

Run with:
    python -m app.seeds.initial
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database import async_session
from app.models.product import Product, ProductCategory, ProductOrigin
from app.models.stock import StockCurrent
from app.models.user import User, UserRole
from app.seeds._parse_excel import parse_workbook

ADMIN_EMAIL = "admin@keel.com"
ADMIN_PASSWORD = "keel2025"


async def seed_admin_user(db: AsyncSession) -> None:
    existing = (
        await db.execute(select(User).where(User.email == ADMIN_EMAIL))
    ).scalar_one_or_none()
    if existing is not None:
        print(f"[seed] admin user '{ADMIN_EMAIL}' already exists, skipping")
        return

    db.add(
        User(
            email=ADMIN_EMAIL,
            full_name="Administrador KEEL",
            password_hash=hash_password(ADMIN_PASSWORD),
            role=UserRole.GERENCIA,
        )
    )
    print(f"[seed] created admin user: {ADMIN_EMAIL} (role: GERENCIA)")


async def seed_catalog_and_stock(db: AsyncSession) -> None:
    rows = parse_workbook()
    existing_codes = {
        r[0] for r in (await db.execute(select(Product.code))).all()
    }

    created_products = 0
    created_stock = 0

    for r in rows:
        code = r["code"]
        if code in existing_codes:
            # ensure stock row exists even if product was created on a prior run
            pid = (
                await db.execute(select(Product.id).where(Product.code == code))
            ).scalar_one()
            existing_stock = (
                await db.execute(
                    select(StockCurrent).where(StockCurrent.product_id == pid)
                )
            ).scalar_one_or_none()
            if existing_stock is None and (r["qty_boxes"] or r["qty_units"]):
                db.add(
                    StockCurrent(
                        product_id=pid,
                        quantity_boxes=r["qty_boxes"],
                        quantity_units=r["qty_units"],
                    )
                )
                created_stock += 1
            continue

        product = Product(
            code=code,
            name=r["name"],
            category=ProductCategory(r["category"]),
            origin=ProductOrigin(r["origin"]),
            pack_size=r["pack_size"],
        )
        db.add(product)
        await db.flush()
        created_products += 1

        if r["qty_boxes"] or r["qty_units"]:
            db.add(
                StockCurrent(
                    product_id=product.id,
                    quantity_boxes=r["qty_boxes"],
                    quantity_units=r["qty_units"],
                )
            )
            created_stock += 1

    print(f"[seed] catalog: {created_products} new products")
    print(f"[seed] stock:   {created_stock} opening balances")


async def main() -> None:
    async with async_session() as db:
        await seed_admin_user(db)
        await seed_catalog_and_stock(db)
        await db.commit()
    print("[seed] done")


if __name__ == "__main__":
    asyncio.run(main())

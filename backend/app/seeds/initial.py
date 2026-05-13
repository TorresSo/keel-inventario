"""Initial seed: admin user + product catalog + opening stock.

Idempotent: re-running skips records that already exist.

Run with:
    python -m app.seeds.initial
"""
import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database import async_session
from app.models.product import Product, ProductCategory, ProductOrigin
from app.models.stock import StockCurrent
from app.models.user import User, UserRole

PRODUCTS: list[tuple[str, str, ProductCategory, ProductOrigin, int]] = [
    # ESCOBILLONES - FABRICACION_PROPIA
    ("210B", "ESCOBILLON PREMIUM", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 18),
    ("212", "ESCOBILLON ROBLE", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("219", "ESCOBILLON ARRAYAN", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("213", "ESCOBILLON NAHUEL", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 18),
    ("252", "ESCOBILLON SUPER KALPON", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 14),
    ("215", "ESCOBILLON ARAUCANO", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("250", "ESCOBILLON GONDOLA KALPON", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("216", "ESCOBILLON GOLF", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 24),
    ("217", "ESCOBILLON LACAR", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("218", "ESCOBILLON PANDA", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("221", "ESCOBILLON ACONCAGUA", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("283", "ESCOBILLON ARCE", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("405", "ESCOBILLON TRAFUL", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("222", "ESCOBILLON NEWEN", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("230", "ESCOBILLON FORTE", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("215P", "ESCOBILLON PUCARA", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 12),
    ("210", "ESCOBILLON COMPACTO", ProductCategory.ESCOBILLONES, ProductOrigin.FABRICACION_PROPIA, 14),
    # BASES_Y_CABOS - FABRICACION_PROPIA
    ("1016A", "CABO PANDA PINTADO", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 95),
    ("1016", "CABO PANDA", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 110),
    ("1017", "CABO PAVONE", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 109),
    ("1001", "CABO BARRENDERO", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 33),
    ("1022", "CABO VIOLIN", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 180),
    ("1006", "CABO DUCATO", ProductCategory.BASES_Y_CABOS, ProductOrigin.FABRICACION_PROPIA, 124),
    # ESPONJAS Bettanin - IMPORTADO_BRASIL (categorized as ESCOBILLONES per prompt)
    ("450120", "ESPONJA MULTIUSO IONES DE PLATA", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 120),
    ("BT484", "ESPONJA METALIZADA", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 60),
    ("BT487", "ESPONJA BRILHUS SALVA UÑAS", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 60),
    ("BT4451", "ESPONJA JEITOSA MULTIUSO", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 60),
    ("467", "ESPONJA PARA BAÑO", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 36),
    ("LS7509", "ESPONJA BAÑO EXFOLIANTE", ProductCategory.ESCOBILLONES, ProductOrigin.IMPORTADO_BRASIL, 60),
]


INITIAL_STOCK: dict[str, int] = {
    "212": 435,
    "219": 209,
    "213": 180,
    "252": 123,
    "215": 314,
    "250": 284,
    "216": 48,
    "217": 46,
    "218": 95,
    "221": 152,
    "283": 50,
    "405": 42,
    "BT4451": 141,
    "BT487": 86,
    "450120": 46,
}


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


async def seed_products(db: AsyncSession) -> dict[str, uuid.UUID]:
    existing_codes = {
        row[0] for row in (await db.execute(select(Product.code))).all()
    }
    code_to_id: dict[str, uuid.UUID] = {}

    for code, name, category, origin, pack_size in PRODUCTS:
        if code in existing_codes:
            pid = (
                await db.execute(select(Product.id).where(Product.code == code))
            ).scalar_one()
            code_to_id[code] = pid
            continue
        product = Product(
            code=code,
            name=name,
            category=category,
            origin=origin,
            pack_size=pack_size,
        )
        db.add(product)
        await db.flush()
        code_to_id[code] = product.id
        print(f"[seed] product {code:<8s} {name}")

    return code_to_id


async def seed_initial_stock(
    db: AsyncSession, code_to_id: dict[str, uuid.UUID]
) -> None:
    for code, qty in INITIAL_STOCK.items():
        pid = code_to_id.get(code)
        if pid is None:
            print(f"[seed] WARNING: product {code} not found in catalog, skipping stock")
            continue

        existing = (
            await db.execute(
                select(StockCurrent).where(StockCurrent.product_id == pid)
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue

        db.add(StockCurrent(product_id=pid, quantity_boxes=qty, quantity_units=0))
        print(f"[seed] stock {code:<8s} {qty} cajas")


async def main() -> None:
    async with async_session() as db:
        await seed_admin_user(db)
        code_to_id = await seed_products(db)
        await seed_initial_stock(db, code_to_id)
        await db.commit()
    print("[seed] done")


if __name__ == "__main__":
    asyncio.run(main())

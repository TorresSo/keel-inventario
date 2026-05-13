from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import audit as audit_router
from app.routers import auth as auth_router
from app.routers import clients as clients_router
from app.routers import orders as orders_router
from app.routers import products as products_router
from app.routers import stock as stock_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="KEEL Inventario API",
        description="Sistema de gestión de inventario y pedidos — KEEL S.A. (Línea Mapuche)",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router)
    app.include_router(products_router.router)
    app.include_router(stock_router.router)
    app.include_router(clients_router.router)
    app.include_router(orders_router.router)
    app.include_router(audit_router.router)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()


__all__ = ["app", "settings"]

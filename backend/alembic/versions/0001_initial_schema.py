"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    user_role = postgresql.ENUM("OPERARIO", "GERENCIA", name="user_role")
    user_role.create(bind, checkfirst=False)

    product_origin = postgresql.ENUM(
        "FABRICACION_PROPIA",
        "IMPORTADO_BRASIL",
        "IMPORTADO_CHINA",
        name="product_origin",
    )
    product_origin.create(bind, checkfirst=False)

    product_category = postgresql.ENUM(
        "ESCOBILLONES",
        "BASES_Y_CABOS",
        "CEPILLOS",
        "BALDES_Y_ACCESORIOS",
        "INSUMOS",
        "MATERIA_PRIMA",
        "FIBRA",
        name="product_category",
    )
    product_category.create(bind, checkfirst=False)

    movement_type = postgresql.ENUM(
        "INGRESO_PRODUCCION",
        "INGRESO_RECEPCION",
        "EGRESO_DESPACHO",
        "EGRESO_MERMA",
        "AJUSTE",
        "REVERSA",
        name="movement_type",
    )
    movement_type.create(bind, checkfirst=False)

    order_status = postgresql.ENUM(
        "PENDIENTE",
        "PREVISUALIZADO",
        "CONFIRMADO",
        "DESPACHADO",
        name="order_status",
    )
    order_status.create(bind, checkfirst=False)

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM(name="user_role", create_type=False),
            nullable=False,
            server_default="OPERARIO",
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "products",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column(
            "category",
            postgresql.ENUM(name="product_category", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "origin",
            postgresql.ENUM(name="product_origin", create_type=False),
            nullable=False,
            server_default="FABRICACION_PROPIA",
        ),
        sa.Column("pack_size", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "min_stock_boxes", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_products_code", "products", ["code"])
    op.create_index("idx_products_category", "products", ["category"])

    op.create_table(
        "stock_current",
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            primary_key=True,
        ),
        sa.Column(
            "quantity_boxes", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "quantity_units", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("last_movement_at", sa.DateTime(timezone=True)),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cuit", sa.String(20)),
        sa.Column("address", sa.String(500)),
        sa.Column("locality", sa.String(255)),
        sa.Column("province", sa.String(100)),
        sa.Column("transport", sa.String(255)),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_clients_name", "clients", ["name"])
    op.create_index("idx_clients_cuit", "clients", ["cuit"])

    op.create_table(
        "orders",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
        ),
        sa.Column("client_name_raw", sa.String(255)),
        sa.Column("order_date", sa.Date()),
        sa.Column("transport", sa.String(255)),
        sa.Column("file_name", sa.String(500)),
        sa.Column(
            "status",
            postgresql.ENUM(name="order_status", create_type=False),
            nullable=False,
            server_default="PENDIENTE",
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column(
            "confirmed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column(
            "imported_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_orders_client", "orders", ["client_id"])
    op.create_index("idx_orders_status", "orders", ["status"])
    op.create_index("idx_orders_created", "orders", [sa.text("created_at DESC")])

    op.create_table(
        "stock_movements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "movement_type",
            postgresql.ENUM(name="movement_type", create_type=False),
            nullable=False,
        ),
        sa.Column("quantity_boxes", sa.Integer(), nullable=False),
        sa.Column("quantity_units", sa.Integer(), nullable=False),
        sa.Column("stock_after_boxes", sa.Integer(), nullable=False),
        sa.Column("stock_after_units", sa.Integer(), nullable=False),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="SET NULL"),
        ),
        sa.Column(
            "reversed_movement_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("stock_movements.id", ondelete="RESTRICT"),
        ),
        sa.Column(
            "is_negative_dispatch",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("notes", sa.Text()),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index(
        "idx_movements_no_double_reversal",
        "stock_movements",
        ["reversed_movement_id"],
        unique=True,
        postgresql_where=sa.text("reversed_movement_id IS NOT NULL"),
    )
    op.create_index("idx_movements_product", "stock_movements", ["product_id"])
    op.create_index(
        "idx_movements_created", "stock_movements", [sa.text("created_at DESC")]
    )

    op.create_table(
        "order_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="SET NULL"),
        ),
        sa.Column("product_code_raw", sa.String(50)),
        sa.Column("product_name_raw", sa.String(255)),
        sa.Column(
            "quantity_boxes_requested",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("quantity_boxes_available", sa.Integer()),
        sa.Column("quantity_boxes_shortage", sa.Integer()),
        sa.Column("quantity_boxes_after_dispatch", sa.Integer()),
        sa.Column(
            "has_shortage",
            sa.Boolean(),
            sa.Computed("quantity_boxes_shortage > 0", persisted=True),
        ),
        sa.Column(
            "will_go_negative",
            sa.Boolean(),
            sa.Computed("quantity_boxes_after_dispatch < 0", persisted=True),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_order_items_order", "order_items", ["order_id"])

    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100)),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True)),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("ip_address", postgresql.INET()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("idx_audit_user", "audit_log", ["user_id"])
    op.create_index("idx_audit_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("idx_audit_created", "audit_log", [sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("order_items")
    op.drop_table("stock_movements")
    op.drop_table("orders")
    op.drop_table("clients")
    op.drop_table("stock_current")
    op.drop_table("products")
    op.drop_table("users")

    for enum_name in (
        "order_status",
        "movement_type",
        "product_category",
        "product_origin",
        "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

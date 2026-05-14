"""extend product_category enum with ESCOBAS, SECADORES, ESPONJAS, ANDENES

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_VALUES = ("ESCOBAS", "SECADORES", "ESPONJAS", "ANDENES")


def upgrade() -> None:
    # ALTER TYPE ADD VALUE in older Postgres required an autocommit block.
    # In 12+ it works inside a transaction, but autocommit is the safe
    # bet across versions.
    with op.get_context().autocommit_block():
        for value in NEW_VALUES:
            op.execute(
                sa.text(
                    f"ALTER TYPE product_category ADD VALUE IF NOT EXISTS '{value}'"
                )
            )


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum without
    # recreating the type and migrating all rows. Leaving the new values
    # in place is acceptable for a non-destructive downgrade.
    pass

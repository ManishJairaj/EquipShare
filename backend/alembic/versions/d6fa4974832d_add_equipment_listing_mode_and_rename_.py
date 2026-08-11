"""add equipment listing mode and rename price

Revision ID: d6fa4974832d
Revises: 8d796917ed93
Create Date: 2026-08-10 23:19:12.228453
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd6fa4974832d'
down_revision: Union[str, None] = '8d796917ed93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "equipment",
        sa.Column(
            "listing_mode",
            sa.String(length=10),
            server_default="rent",
            nullable=False,
        ),
    )
    op.alter_column(
        "equipment",
        "price_per_day",
        new_column_name="price",
        existing_type=sa.Numeric(precision=10, scale=2),
        existing_nullable=False,
    )
    op.create_check_constraint(
        "ck_equipment_listing_mode",
        "equipment",
        "listing_mode IN ('rent', 'sell')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_equipment_listing_mode", "equipment", type_="check")
    op.alter_column(
        "equipment",
        "price",
        new_column_name="price_per_day",
        existing_type=sa.Numeric(precision=10, scale=2),
        existing_nullable=False,
    )
    op.drop_column("equipment", "listing_mode")

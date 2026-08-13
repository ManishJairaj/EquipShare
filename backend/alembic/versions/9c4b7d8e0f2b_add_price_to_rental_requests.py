"""add price to rental requests

Revision ID: 9c4b7d8e0f2b
Revises: 2b4c6d8e0f1a
Create Date: 2026-08-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c4b7d8e0f2b"
down_revision: Union[str, None] = "2b4c6d8e0f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rental_requests",
        sa.Column(
            "price",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0.00",
        ),
    )


def downgrade() -> None:
    op.drop_column("rental_requests", "price")

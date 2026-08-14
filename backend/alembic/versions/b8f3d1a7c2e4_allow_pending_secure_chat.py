"""allow a secure chat to wait for the seller key

Revision ID: b8f3d1a7c2e4
Revises: a4e7c1d2f9b0
Create Date: 2026-08-14
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b8f3d1a7c2e4"
down_revision: Union[str, None] = "a4e7c1d2f9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("chat_conversations", "seller_public_key", nullable=True)


def downgrade() -> None:
    op.alter_column("chat_conversations", "seller_public_key", nullable=False)

"""add username to users

Revision ID: 8d796917ed93
Revises: 1f7df1eb9baf
Create Date: 2026-08-10 21:58:49.661473
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8d796917ed93'
down_revision: Union[str, None] = '1f7df1eb9baf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("username", sa.String(length=30), nullable=True)
    )
    op.execute(
        sa.text(
            "UPDATE users SET username = 'user_' || id::text "
            "WHERE username IS NULL"
        )
    )
    op.alter_column("users", "username", nullable=False)
    op.create_index(
        op.f("ix_users_username"), "users", ["username"], unique=True
    )
    op.create_check_constraint(
        "ck_users_username_lowercase",
        "users",
        "username = lower(username)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_username_lowercase", "users", type_="check")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")

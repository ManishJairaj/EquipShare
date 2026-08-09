"""create users and equipment tables

Revision ID: 75cc71cee4e1
Revises: 
Create Date: 2026-08-09 22:23:58.654833
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '75cc71cee4e1'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "equipment",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("condition", sa.String(length=50), nullable=False),
        sa.Column("price_per_day", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "availability_status",
            sa.String(length=50),
            server_default=sa.text("'available'"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_equipment_owner_id"), "equipment", ["owner_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_equipment_owner_id"), table_name="equipment")
    op.drop_table("equipment")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

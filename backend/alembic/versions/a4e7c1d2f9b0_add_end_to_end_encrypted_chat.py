"""add end-to-end encrypted chat

Revision ID: a4e7c1d2f9b0
Revises: 2ca36d24e6f1
Create Date: 2026-08-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4e7c1d2f9b0"
down_revision: Union[str, None] = "2ca36d24e6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("chat_public_key", sa.Text(), nullable=True))

    op.create_table(
        "chat_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("equipment_id", sa.Integer(), nullable=False),
        sa.Column("buyer_id", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("buyer_public_key", sa.Text(), nullable=False),
        sa.Column("seller_public_key", sa.Text(), nullable=False),
        sa.Column(
            "is_blocked", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("blocked_by_id", sa.Integer(), nullable=True),
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
        sa.CheckConstraint(
            "buyer_id <> seller_id", name="ck_chat_distinct_participants"
        ),
        sa.ForeignKeyConstraint(
            ["blocked_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["buyer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["equipment_id"], ["equipment.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "equipment_id",
            "buyer_id",
            "seller_id",
            name="uq_chat_conversation_participants",
        ),
    )
    op.create_index(
        op.f("ix_chat_conversations_buyer_id"),
        "chat_conversations",
        ["buyer_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_conversations_equipment_id"),
        "chat_conversations",
        ["equipment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_conversations_seller_id"),
        "chat_conversations",
        ["seller_id"],
        unique=False,
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("ciphertext", sa.Text(), nullable=False),
        sa.Column("iv", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["chat_conversations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chat_messages_conversation_id"),
        "chat_messages",
        ["conversation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_chat_messages_sender_id"),
        "chat_messages",
        ["sender_id"],
        unique=False,
    )

    op.alter_column("notifications", "rental_request_id", nullable=True)
    op.add_column(
        "notifications", sa.Column("conversation_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_notifications_conversation_id_chat_conversations",
        "notifications",
        "chat_conversations",
        ["conversation_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_notifications_conversation_id"),
        "notifications",
        ["conversation_id"],
        unique=False,
    )
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notifications_type",
        "notifications",
        "type IN ('new_request', 'request_accepted', 'request_rejected', 'new_chat_message')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notifications_type",
        "notifications",
        "type IN ('new_request', 'request_accepted', 'request_rejected')",
    )
    op.drop_index(op.f("ix_notifications_conversation_id"), table_name="notifications")
    op.drop_constraint(
        "fk_notifications_conversation_id_chat_conversations",
        "notifications",
        type_="foreignkey",
    )
    op.drop_column("notifications", "conversation_id")
    op.alter_column("notifications", "rental_request_id", nullable=False)

    op.drop_index(op.f("ix_chat_messages_sender_id"), table_name="chat_messages")
    op.drop_index(
        op.f("ix_chat_messages_conversation_id"), table_name="chat_messages"
    )
    op.drop_table("chat_messages")
    op.drop_index(op.f("ix_chat_conversations_seller_id"), table_name="chat_conversations")
    op.drop_index(
        op.f("ix_chat_conversations_equipment_id"), table_name="chat_conversations"
    )
    op.drop_index(op.f("ix_chat_conversations_buyer_id"), table_name="chat_conversations")
    op.drop_table("chat_conversations")
    op.drop_column("users", "chat_public_key")

import json
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import (
    ChatConversation,
    ChatMessage,
    Equipment,
    Notification,
    NotificationType,
    User,
)
from app.schemas import (
    ChatConversationCreate,
    ChatConversationDetail,
    ChatConversationOut,
    ChatMessageCreate,
    ChatMessageOut,
    ChatPublicKeyOut,
    ChatPublicKeyUpdate,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/chats", tags=["Chats"])

MAX_STORED_MESSAGES = 15


def serialize_public_key(public_key: dict[str, str]) -> str:
    return json.dumps(public_key, separators=(",", ":"), sort_keys=True)


def deserialize_public_key(public_key: str) -> dict[str, str]:
    return json.loads(public_key)


def chat_statement():
    return (
        select(ChatConversation)
        .options(
            joinedload(ChatConversation.equipment),
            joinedload(ChatConversation.buyer),
            joinedload(ChatConversation.seller),
            selectinload(ChatConversation.messages),
        )
        .execution_options(populate_existing=True)
    )


def get_chat_or_404(
    conversation_id: int, current_user: User, db: Session
) -> ChatConversation:
    conversation = db.scalar(
        chat_statement().where(ChatConversation.id == conversation_id)
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    if current_user.id not in {conversation.buyer_id, conversation.seller_id}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation",
        )
    return conversation


def conversation_response(
    conversation: ChatConversation,
    current_user: User,
    *,
    include_messages: bool = False,
) -> dict:
    messages = sorted(
        conversation.messages,
        key=lambda message: (message.created_at, message.id),
    )[-MAX_STORED_MESSAGES:]
    seller_has_replied = any(
        message.sender_id == conversation.seller_id for message in messages
    )
    is_buyer = current_user.id == conversation.buyer_id
    peer_public_key = (
        conversation.seller_public_key if is_buyer else conversation.buyer_public_key
    )
    response = {
        "id": conversation.id,
        "equipment": conversation.equipment,
        "buyer": conversation.buyer,
        "seller": conversation.seller,
        "current_user_role": "buyer" if is_buyer else "seller",
        "peer_public_key": (
            deserialize_public_key(peer_public_key) if peer_public_key else None
        ),
        "is_blocked": conversation.is_blocked,
        "blocked_by_id": conversation.blocked_by_id,
        "awaiting_seller_reply": bool(messages) and not seller_has_replied,
        "last_message_at": messages[-1].created_at if messages else None,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }
    if include_messages:
        response["messages"] = messages
    return response


@router.get("/key", response_model=ChatPublicKeyOut)
def get_chat_public_key(
    current_user: Annotated[User, Depends(get_current_user)],
) -> ChatPublicKeyOut:
    return ChatPublicKeyOut(
        public_key=(
            deserialize_public_key(current_user.chat_public_key)
            if current_user.chat_public_key
            else None
        )
    )


@router.put("/key", response_model=ChatPublicKeyOut)
def register_chat_public_key(
    key_data: ChatPublicKeyUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatPublicKeyOut:
    serialized_key = serialize_public_key(key_data.public_key)
    if current_user.chat_public_key and current_user.chat_public_key != serialized_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Secure chat is already linked to another browser. "
                "The encryption key cannot be replaced automatically."
            ),
        )
    if not current_user.chat_public_key:
        current_user.chat_public_key = serialized_key
        db.execute(
            update(ChatConversation)
            .where(
                ChatConversation.seller_id == current_user.id,
                ChatConversation.seller_public_key.is_(None),
            )
            .values(
                seller_public_key=serialized_key,
                updated_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
    return ChatPublicKeyOut(public_key=key_data.public_key)


@router.post("", response_model=ChatConversationDetail, status_code=status.HTTP_201_CREATED)
def create_or_get_conversation(
    chat_data: ChatConversationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    equipment = db.scalar(
        select(Equipment).options(joinedload(Equipment.owner)).where(
            Equipment.id == chat_data.equipment_id
        )
    )
    if equipment is None:
        raise HTTPException(status_code=404, detail="Equipment not found")
    if equipment.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owners cannot start a buyer conversation for their own listing",
        )
    if not current_user.chat_public_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Set up your secure chat key before starting a conversation",
        )
    conversation = db.scalar(
        chat_statement().where(
            ChatConversation.equipment_id == equipment.id,
            ChatConversation.buyer_id == current_user.id,
            ChatConversation.seller_id == equipment.owner_id,
        )
    )
    created = conversation is None
    if conversation is None:
        conversation = ChatConversation(
            equipment_id=equipment.id,
            buyer_id=current_user.id,
            seller_id=equipment.owner_id,
            buyer_public_key=current_user.chat_public_key,
            seller_public_key=equipment.owner.chat_public_key,
        )
        db.add(conversation)
        db.flush()
        db.add(
            Notification(
                user_id=equipment.owner_id,
                type=NotificationType.NEW_CHAT_MESSAGE.value,
                message=(
                    f"@{current_user.username} wants to start a secure chat about "
                    f"{equipment.name}."
                ),
                conversation_id=conversation.id,
            )
        )
        db.commit()
        conversation = db.scalar(
            chat_statement().where(ChatConversation.id == conversation.id)
        )

    response = conversation_response(conversation, current_user, include_messages=True)
    if not created:
        # FastAPI keeps the declared 201 for a stable create-or-open client contract.
        return response
    return response


@router.get("", response_model=list[ChatConversationOut])
def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict]:
    conversations = list(
        db.scalars(
            chat_statement()
            .where(
                or_(
                    ChatConversation.buyer_id == current_user.id,
                    ChatConversation.seller_id == current_user.id,
                )
            )
            .order_by(ChatConversation.updated_at.desc(), ChatConversation.id.desc())
        ).all()
    )
    return [conversation_response(item, current_user) for item in conversations]


@router.get("/{conversation_id}", response_model=ChatConversationDetail)
def get_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    conversation = get_chat_or_404(conversation_id, current_user, db)
    return conversation_response(conversation, current_user, include_messages=True)


@router.post(
    "/{conversation_id}/messages",
    response_model=ChatMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: int,
    message_data: ChatMessageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatMessage:
    conversation = get_chat_or_404(conversation_id, current_user, db)
    if conversation.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The seller has blocked this conversation",
        )

    prior_sender_ids = list(
        db.scalars(
            select(ChatMessage.sender_id).where(
                ChatMessage.conversation_id == conversation.id
            )
        ).all()
    )
    seller_has_replied = conversation.seller_id in prior_sender_ids
    if not prior_sender_ids and current_user.id != conversation.buyer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The buyer must send the first message",
        )
    if (
        current_user.id == conversation.buyer_id
        and prior_sender_ids
        and not seller_has_replied
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Please wait for the seller to reply before sending another message",
        )

    message = ChatMessage(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        ciphertext=message_data.ciphertext,
        iv=message_data.iv,
    )
    conversation.updated_at = datetime.now(timezone.utc)
    db.add(message)
    db.flush()

    stale_message_ids = list(
        db.scalars(
            select(ChatMessage.id)
            .where(ChatMessage.conversation_id == conversation.id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .offset(MAX_STORED_MESSAGES)
        ).all()
    )
    if stale_message_ids:
        db.execute(delete(ChatMessage).where(ChatMessage.id.in_(stale_message_ids)))

    recipient_id = (
        conversation.seller_id
        if current_user.id == conversation.buyer_id
        else conversation.buyer_id
    )
    db.add(
        Notification(
            user_id=recipient_id,
            type=NotificationType.NEW_CHAT_MESSAGE.value,
            message=f"@{current_user.username} sent you a secure message.",
            conversation_id=conversation.id,
        )
    )
    db.commit()
    db.refresh(message)
    return message


def set_blocked_state(
    conversation_id: int,
    blocked: bool,
    current_user: User,
    db: Session,
) -> dict:
    conversation = get_chat_or_404(conversation_id, current_user, db)
    if current_user.id != conversation.seller_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller can change the conversation block status",
        )
    conversation.is_blocked = blocked
    conversation.blocked_by_id = current_user.id if blocked else None
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    conversation = get_chat_or_404(conversation.id, current_user, db)
    return conversation_response(conversation, current_user, include_messages=True)


@router.patch("/{conversation_id}/block", response_model=ChatConversationDetail)
def block_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return set_blocked_state(conversation_id, True, current_user, db)


@router.patch("/{conversation_id}/unblock", response_model=ChatConversationDetail)
def unblock_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return set_blocked_state(conversation_id, False, current_user, db)

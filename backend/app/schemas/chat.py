from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


def validate_public_key(value: dict[str, Any]) -> dict[str, str]:
    required_values = {"kty": "EC", "crv": "P-256"}
    for field, expected in required_values.items():
        if value.get(field) != expected:
            raise ValueError(f"public key {field} must be {expected}")
    for field in ("x", "y"):
        coordinate = value.get(field)
        if not isinstance(coordinate, str) or not coordinate or len(coordinate) > 128:
            raise ValueError(f"public key {field} is invalid")
    return {"kty": "EC", "crv": "P-256", "x": value["x"], "y": value["y"]}


class ChatPublicKeyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Browser Web Crypto exports standard JWK metadata such as `ext` (bool)
    # and `key_ops` (list). Accept the real JWK shape, then retain only the
    # public P-256 coordinates in the validator below.
    public_key: dict[str, Any]

    @field_validator("public_key")
    @classmethod
    def public_key_must_be_p256(cls, value: dict[str, Any]) -> dict[str, str]:
        return validate_public_key(value)


class ChatPublicKeyOut(BaseModel):
    public_key: dict[str, str] | None


class ChatConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    equipment_id: int = Field(gt=0)


class ChatMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ciphertext: str = Field(min_length=1, max_length=16_000)
    iv: str = Field(min_length=12, max_length=128)


class ChatParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str


class ChatEquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    listing_mode: str


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    sender_id: int
    ciphertext: str
    iv: str
    created_at: datetime


class ChatConversationOut(BaseModel):
    id: int
    equipment: ChatEquipmentOut
    buyer: ChatParticipantOut
    seller: ChatParticipantOut
    current_user_role: str
    peer_public_key: dict[str, str] | None
    is_blocked: bool
    blocked_by_id: int | None
    awaiting_seller_reply: bool
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ChatConversationDetail(ChatConversationOut):
    messages: list[ChatMessageOut]

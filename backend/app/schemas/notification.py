from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: NotificationType
    message: str
    is_read: bool
    rental_request_id: int | None
    conversation_id: int | None
    created_at: datetime


class NotificationUnreadCount(BaseModel):
    unread_count: int


class NotificationsMarkedRead(BaseModel):
    marked_read: int

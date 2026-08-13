from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.schemas import (
    NotificationOut,
    NotificationsMarkedRead,
    NotificationUnreadCount,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_owned_notification_or_404(
    notification_id: int, current_user: User, db: Session
) -> Notification:
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return notification


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[Notification]:
    statement = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    )
    return list(db.scalars(statement).all())


@router.get("/unread-count", response_model=NotificationUnreadCount)
def get_unread_notification_count(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationUnreadCount:
    unread_count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
    ) or 0
    return NotificationUnreadCount(unread_count=unread_count)


@router.patch("/read-all", response_model=NotificationsMarkedRead)
def mark_all_notifications_read(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationsMarkedRead:
    notifications = list(
        db.scalars(
            select(Notification).where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ).all()
    )
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return NotificationsMarkedRead(marked_read=len(notifications))


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Notification:
    notification = get_owned_notification_or_404(notification_id, current_user, db)
    if not notification.is_read:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification

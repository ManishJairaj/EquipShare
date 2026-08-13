from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.notification import Notification

class StrEnum(str, Enum):
    def __str__(self) -> str:
        return str(self.value)

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RentalStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RentalRequest(Base):
    __tablename__ = "rental_requests"
    __table_args__ = (
        CheckConstraint("start_date <= end_date", name="ck_rental_requests_dates"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')",
            name="ck_rental_requests_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    equipment_id: Mapped[int] = mapped_column(
        ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True
    )
    borrower_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RentalStatus.PENDING, server_default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    equipment: Mapped["Equipment"] = relationship(back_populates="rental_requests")
    borrower: Mapped["User"] = relationship(back_populates="rental_requests")
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="rental_request", cascade="all, delete-orphan"
    )

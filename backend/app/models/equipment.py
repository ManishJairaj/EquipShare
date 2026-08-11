from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.rental_request import RentalRequest


class Equipment(Base):
    __tablename__ = "equipment"
    __table_args__ = (
        CheckConstraint(
            "listing_mode IN ('rent', 'sell')",
            name="ck_equipment_listing_mode",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    condition: Mapped[str] = mapped_column(String(50), nullable=False)
    listing_mode: Mapped[str] = mapped_column(
        String(10), nullable=False, default="rent", server_default="rent"
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    availability_status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="available", server_default="available"
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="equipment")
    rental_requests: Mapped[list["RentalRequest"]] = relationship(
        back_populates="equipment", cascade="all, delete-orphan"
    )

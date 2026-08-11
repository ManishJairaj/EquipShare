from datetime import date, datetime
from decimal import Decimal
from typing_extensions import Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.models import RentalStatus
from app.schemas.equipment import ListingMode


class RentalRequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    equipment_id: int
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        if self.start_date < date.today():
            raise ValueError("start_date cannot be in the past")
        return self


class RentalRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    equipment_id: int
    borrower_id: int
    start_date: date
    end_date: date
    status: RentalStatus
    created_at: datetime
    updated_at: datetime


class RentalEquipmentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    listing_mode: ListingMode
    price: Decimal
    owner_id: int


class RentalBorrowerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RentalRequestDetail(RentalRequestOut):
    equipment: RentalEquipmentSummary
    borrower: RentalBorrowerSummary

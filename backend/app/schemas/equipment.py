from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from app.schemas.review import ReviewOut


class StrEnum(str, Enum):
    def __str__(self) -> str:
        return str(self.value)


class AvailabilityStatus(StrEnum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"


class EquipmentCondition(StrEnum):
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"


class ListingMode(StrEnum):
    RENT = "rent"
    SELL = "sell"


class EquipmentSort(StrEnum):
    NEWEST = "newest"
    OLDEST = "oldest"
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


class OwnerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str


class EquipmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=100)
    condition: EquipmentCondition
    listing_mode: ListingMode
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    image_urls: list[str] = Field(default_factory=list)


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    condition: EquipmentCondition | None = None
    listing_mode: ListingMode | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    availability_status: AvailabilityStatus | None = None
    image_urls: list[str] | None = None


class RentalRangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    start_date: date
    end_date: date
    status: str


class EquipmentOut(EquipmentBase):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: int
    owner_id: int
    owner: OwnerSummary
    rental_requests: list[RentalRangeOut] = []
    reviews: list[ReviewOut] = []
    created_at: datetime
    updated_at: datetime


class PaginatedEquipmentResponse(BaseModel):
    items: list[EquipmentOut]
    page: int
    limit: int
    total: int
    total_pages: int

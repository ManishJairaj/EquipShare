from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


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


class EquipmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=100)
    condition: EquipmentCondition
    price_per_day: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    condition: EquipmentCondition | None = None
    price_per_day: Decimal | None = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )
    availability_status: AvailabilityStatus | None = None


class EquipmentOut(EquipmentBase):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)

    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime

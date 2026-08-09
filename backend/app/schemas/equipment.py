from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class EquipmentBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: str = Field(min_length=1, max_length=100)
    condition: str = Field(min_length=1, max_length=50)
    price_per_day: Decimal = Field(gt=0, max_digits=10, decimal_places=2)


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=100)
    condition: str | None = Field(default=None, min_length=1, max_length=50)
    price_per_day: Decimal | None = Field(
        default=None, gt=0, max_digits=10, decimal_places=2
    )
    availability_status: str | None = Field(default=None, min_length=1, max_length=50)


class EquipmentOut(EquipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    availability_status: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

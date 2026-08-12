from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReviewerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str


class ReviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    equipment_id: int
    reviewer_id: int
    rating: int
    comment: str
    created_at: datetime
    reviewer: ReviewerSummary

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import Equipment, User
from app.schemas import (
    AvailabilityStatus,
    EquipmentCondition,
    EquipmentCreate,
    EquipmentOut,
    EquipmentSort,
    EquipmentUpdate,
    ListingMode,
    PaginatedEquipmentResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["Equipment"])


def get_equipment_or_404(equipment_id: int, db: Session) -> Equipment:
    equipment = db.scalars(
        select(Equipment)
        .options(joinedload(Equipment.owner), joinedload(Equipment.rental_requests))
        .where(Equipment.id == equipment_id)
    ).unique().first()
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found",
        )
    return equipment


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    equipment_data: EquipmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Equipment:
    equipment = Equipment(
        **equipment_data.model_dump(),
        owner_id=current_user.id,
    )
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return get_equipment_or_404(equipment.id, db)


@router.get("", response_model=PaginatedEquipmentResponse)
def list_equipment(
    db: Annotated[Session, Depends(get_db)],
    search: Annotated[str | None, Query(max_length=100)] = None,
    listing_mode: ListingMode | None = None,
    category: Annotated[str | None, Query(max_length=100)] = None,
    condition: EquipmentCondition | None = None,
    availability_status: AvailabilityStatus | None = None,
    min_price: Annotated[Decimal | None, Query(ge=0)] = None,
    max_price: Annotated[Decimal | None, Query(ge=0)] = None,
    sort: EquipmentSort = EquipmentSort.NEWEST,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedEquipmentResponse:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="min_price must be less than or equal to max_price",
        )

    filters = []
    normalized_search = search.strip() if search else ""
    normalized_category = category.strip() if category else ""

    if normalized_search:
        search_pattern = f"%{normalized_search}%"
        filters.append(
            or_(
                Equipment.name.ilike(search_pattern),
                Equipment.description.ilike(search_pattern),
                Equipment.category.ilike(search_pattern),
            )
        )
    if listing_mode is not None:
        filters.append(Equipment.listing_mode == listing_mode)
    if normalized_category:
        filters.append(func.lower(Equipment.category) == normalized_category.lower())
    if condition is not None:
        filters.append(Equipment.condition == condition)
    if availability_status is not None:
        filters.append(Equipment.availability_status == availability_status)
    if min_price is not None:
        filters.append(Equipment.price >= min_price)
    if max_price is not None:
        filters.append(Equipment.price <= max_price)

    total = db.scalar(
        select(func.count(Equipment.id)).where(*filters)
    ) or 0

    sort_columns = {
        EquipmentSort.NEWEST: (Equipment.created_at.desc(), Equipment.id.desc()),
        EquipmentSort.OLDEST: (Equipment.created_at.asc(), Equipment.id.asc()),
        EquipmentSort.PRICE_ASC: (Equipment.price.asc(), Equipment.id.asc()),
        EquipmentSort.PRICE_DESC: (Equipment.price.desc(), Equipment.id.desc()),
    }
    offset = (page - 1) * limit
    statement = (
        select(Equipment)
        .options(joinedload(Equipment.owner), selectinload(Equipment.rental_requests))
        .where(*filters)
        .order_by(*sort_columns[sort])
        .offset(offset)
        .limit(limit)
    )
    items = list(db.scalars(statement).all())

    return PaginatedEquipmentResponse(
        items=items,
        page=page,
        limit=limit,
        total=total,
        total_pages=(total + limit - 1) // limit,
    )


@router.get("/me", response_model=list[EquipmentOut])
def list_my_equipment(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Equipment]:
    statement = (
        select(Equipment)
        .options(joinedload(Equipment.owner), joinedload(Equipment.rental_requests))
        .where(Equipment.owner_id == current_user.id)
        .order_by(Equipment.id)
    )
    return list(db.scalars(statement).unique().all())


@router.get("/{equipment_id}", response_model=EquipmentOut)
def get_equipment(
    equipment_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Equipment:
    return get_equipment_or_404(equipment_id, db)


@router.patch("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: int,
    equipment_data: EquipmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Equipment:
    equipment = get_equipment_or_404(equipment_id, db)
    if equipment.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this equipment",
        )

    for field, value in equipment_data.model_dump(exclude_unset=True).items():
        setattr(equipment, field, value)

    db.commit()
    db.refresh(equipment)
    return get_equipment_or_404(equipment.id, db)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    equipment = get_equipment_or_404(equipment_id, db)
    if equipment.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this equipment",
        )

    db.delete(equipment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

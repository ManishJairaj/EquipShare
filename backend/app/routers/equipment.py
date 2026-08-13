from decimal import Decimal
import os
import shutil
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status, UploadFile, File
from sqlalchemy import func, or_, select, delete
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import Equipment, User, Review, RentalRequest
from app.models.notification import Notification
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
from app.schemas.review import ReviewCreate, ReviewOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["Equipment"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "uploads"
)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_image(
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
) -> dict[str, str]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    
    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Validate file content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
        
    # Generate unique filename
    extension = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}"
        )
        
    # Return the relative URL
    return {"image_url": f"/static/uploads/{filename}"}


def get_equipment_or_404(equipment_id: int, db: Session) -> Equipment:
    equipment = db.scalars(
        select(Equipment)
        .options(
            joinedload(Equipment.owner),
            joinedload(Equipment.rental_requests),
            selectinload(Equipment.reviews).joinedload(Review.reviewer),
        )
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

    # Explicitly cascade delete reviews
    db.execute(delete(Review).where(Review.equipment_id == equipment_id))

    # Explicitly cascade delete notifications related to requests for this equipment
    db.execute(
        delete(Notification).where(
            Notification.rental_request_id.in_(
                select(RentalRequest.id).where(RentalRequest.equipment_id == equipment_id)
            )
        )
    )

    # Explicitly cascade delete rental requests
    db.execute(delete(RentalRequest).where(RentalRequest.equipment_id == equipment_id))

    db.delete(equipment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{equipment_id}/reviews", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    equipment_id: int,
    review_data: ReviewCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Review:
    equipment = get_equipment_or_404(equipment_id, db)
    
    # Verify reviewer is not the owner
    if equipment.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot review your own equipment listing",
        )
        
    review = Review(
        **review_data.model_dump(),
        equipment_id=equipment_id,
        reviewer_id=current_user.id,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    # Reload review with reviewer details
    db_review = db.scalars(
        select(Review)
        .options(joinedload(Review.reviewer))
        .where(Review.id == review.id)
    ).first()
    
    if db_review is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load review with relations",
        )
        
    return db_review

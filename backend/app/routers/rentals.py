from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Equipment, RentalRequest, RentalStatus, User
from app.schemas import (
    AvailabilityStatus,
    ListingMode,
    RentalRequestCreate,
    RentalRequestDetail,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/rentals", tags=["Rentals"])


def get_rental_or_404(request_id: int, db: Session) -> RentalRequest:
    statement = (
        select(RentalRequest)
        .options(
            joinedload(RentalRequest.equipment),
            joinedload(RentalRequest.borrower),
        )
        .where(RentalRequest.id == request_id)
    )
    rental_request = db.scalar(statement)
    if rental_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rental request not found",
        )
    return rental_request


def require_equipment_owner(
    rental_request: RentalRequest, current_user: User
) -> None:
    if rental_request.equipment.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the equipment owner can perform this action",
        )


def require_pending(rental_request: RentalRequest) -> None:
    if rental_request.status != RentalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This action is only allowed for pending requests",
        )


@router.post("", response_model=RentalRequestDetail, status_code=status.HTTP_201_CREATED)
def create_rental_request(
    request_data: RentalRequestCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RentalRequest:
    equipment = db.get(Equipment, request_data.equipment_id)
    if equipment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found",
        )
    if equipment.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot request your own equipment",
        )
    if equipment.availability_status != AvailabilityStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Equipment is currently unavailable",
        )

    duplicate_statement = select(RentalRequest).where(
        RentalRequest.equipment_id == request_data.equipment_id,
        RentalRequest.borrower_id == current_user.id,
        RentalRequest.start_date == request_data.start_date,
        RentalRequest.end_date == request_data.end_date,
        RentalRequest.status == RentalStatus.PENDING,
    )
    if db.scalar(duplicate_statement) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An identical pending rental request already exists",
        )

    rental_request = RentalRequest(
        **request_data.model_dump(),
        borrower_id=current_user.id,
        status=RentalStatus.PENDING,
    )
    db.add(rental_request)
    db.commit()
    db.refresh(rental_request)
    return get_rental_or_404(rental_request.id, db)


@router.get("/my-requests", response_model=list[RentalRequestDetail])
def list_my_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[RentalRequest]:
    statement = (
        select(RentalRequest)
        .options(
            joinedload(RentalRequest.equipment),
            joinedload(RentalRequest.borrower),
        )
        .where(RentalRequest.borrower_id == current_user.id)
        .order_by(RentalRequest.created_at.desc())
    )
    return list(db.scalars(statement).all())


@router.get("/incoming", response_model=list[RentalRequestDetail])
def list_incoming_requests(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[RentalRequest]:
    statement = (
        select(RentalRequest)
        .join(RentalRequest.equipment)
        .options(
            joinedload(RentalRequest.equipment),
            joinedload(RentalRequest.borrower),
        )
        .where(Equipment.owner_id == current_user.id)
        .order_by(RentalRequest.created_at.desc())
    )
    return list(db.scalars(statement).all())


@router.get("/{request_id}", response_model=RentalRequestDetail)
def get_rental_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RentalRequest:
    rental_request = get_rental_or_404(request_id, db)
    if (
        rental_request.borrower_id != current_user.id
        and rental_request.equipment.owner_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this rental request",
        )
    return rental_request


@router.patch("/{request_id}/accept", response_model=RentalRequestDetail)
def accept_rental_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RentalRequest:
    rental_request = get_rental_or_404(request_id, db)
    require_equipment_owner(rental_request, current_user)
    require_pending(rental_request)

    overlap_statement = select(RentalRequest).where(
        RentalRequest.equipment_id == rental_request.equipment_id,
        RentalRequest.id != rental_request.id,
        RentalRequest.status == RentalStatus.ACCEPTED,
        RentalRequest.start_date <= rental_request.end_date,
        RentalRequest.end_date >= rental_request.start_date,
    )
    if db.scalar(overlap_statement) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This equipment already has an accepted rental for these dates",
        )

    rental_request.status = RentalStatus.ACCEPTED
    if rental_request.equipment.listing_mode == ListingMode.SELL:
        rental_request.equipment.availability_status = "unavailable"
    db.commit()
    db.refresh(rental_request)
    return get_rental_or_404(rental_request.id, db)


@router.patch("/{request_id}/reject", response_model=RentalRequestDetail)
def reject_rental_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RentalRequest:
    rental_request = get_rental_or_404(request_id, db)
    require_equipment_owner(rental_request, current_user)
    require_pending(rental_request)
    rental_request.status = RentalStatus.REJECTED
    db.commit()
    db.refresh(rental_request)
    return get_rental_or_404(rental_request.id, db)


@router.patch("/{request_id}/cancel", response_model=RentalRequestDetail)
def cancel_rental_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RentalRequest:
    rental_request = get_rental_or_404(request_id, db)
    if rental_request.borrower_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the borrower can cancel this request",
        )
    if rental_request.status not in {
        RentalStatus.PENDING,
        RentalStatus.ACCEPTED,
    }:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending or accepted requests can be cancelled",
        )

    if rental_request.status == RentalStatus.ACCEPTED:
        if rental_request.equipment.listing_mode == ListingMode.SELL:
            rental_request.equipment.availability_status = "available"
    rental_request.status = RentalStatus.CANCELLED
    db.commit()
    db.refresh(rental_request)
    return get_rental_or_404(rental_request.id, db)

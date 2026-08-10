from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Equipment, User
from app.schemas import EquipmentCreate, EquipmentOut, EquipmentUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/equipment", tags=["Equipment"])


def get_equipment_or_404(equipment_id: int, db: Session) -> Equipment:
    equipment = db.scalar(
        select(Equipment)
        .options(joinedload(Equipment.owner))
        .where(Equipment.id == equipment_id)
    )
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


@router.get("", response_model=list[EquipmentOut])
def list_equipment(db: Annotated[Session, Depends(get_db)]) -> list[Equipment]:
    statement = (
        select(Equipment)
        .options(joinedload(Equipment.owner))
        .order_by(Equipment.id)
    )
    return list(db.scalars(statement).all())


@router.get("/me", response_model=list[EquipmentOut])
def list_my_equipment(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[Equipment]:
    statement = (
        select(Equipment)
        .options(joinedload(Equipment.owner))
        .where(Equipment.owner_id == current_user.id)
        .order_by(Equipment.id)
    )
    return list(db.scalars(statement).all())


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

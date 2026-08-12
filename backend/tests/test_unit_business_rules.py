from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.routers.rentals import create_rental_request
from app.schemas import RentalRequestCreate


def test_sale_listing_rejects_future_rental_dates_before_writing_to_database():
    current_user = SimpleNamespace(id=2)
    sale_equipment = SimpleNamespace(
        id=10,
        owner_id=1,
        listing_mode="sell",
        availability_status="available",
    )
    db = Mock()
    db.get.return_value = sale_equipment
    tomorrow = date.today() + timedelta(days=1)
    request = RentalRequestCreate(
        equipment_id=sale_equipment.id,
        start_date=tomorrow,
        end_date=tomorrow,
    )

    with pytest.raises(HTTPException) as exc_info:
        create_rental_request(request, current_user, db)

    assert exc_info.value.status_code == 400
    db.add.assert_not_called()
    db.commit.assert_not_called()

from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from scripts.test_database import configure_test_database

configure_test_database()

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import Equipment, User


def register_and_login(
    client: TestClient, name: str, email: str, password: str
) -> tuple[dict, dict[str, str]]:
    registration = client.post(
        "/auth/register",
        json={
            "name": name,
            "username": f"test_{uuid4().hex[:20]}",
            "email": email,
            "password": password,
        },
    )
    assert registration.status_code == 201, registration.text

    login = client.post(
        "/auth/login",
        data={"username": email, "password": password},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return registration.json(), {"Authorization": f"Bearer {token}"}


def main() -> None:
    unique_id = uuid4().hex
    user_a_email = f"equipment-owner-a-{unique_id}@example.com"
    user_b_email = f"equipment-owner-b-{unique_id}@example.com"
    password = "EquipmentIntegrationTest!42"
    client = TestClient(app)

    equipment_payload = {
        "name": "Mirrorless Camera",
        "description": "Camera body for student projects",
        "category": "camera",
        "condition": "excellent",
        "listing_mode": "rent",
        "price": "500.00",
        "availability_status": "available",
    }

    try:
        assert client.post("/equipment", json=equipment_payload).status_code == 401

        user_a, user_a_headers = register_and_login(
            client, "Equipment Owner A", user_a_email, password
        )
        user_b, user_b_headers = register_and_login(
            client, "Equipment Owner B", user_b_email, password
        )

        injected_owner = equipment_payload | {"owner_id": user_b["id"]}
        assert (
            client.post(
                "/equipment", json=injected_owner, headers=user_a_headers
            ).status_code
            == 422
        )

        created_a = client.post(
            "/equipment", json=equipment_payload, headers=user_a_headers
        )
        assert created_a.status_code == 201, created_a.text
        equipment_a = created_a.json()
        equipment_a_id = equipment_a["id"]
        assert equipment_a["owner_id"] == user_a["id"]
        assert equipment_a["owner"] == {
            "id": user_a["id"],
            "username": user_a["username"],
            "name": user_a["name"],
        }
        assert equipment_a["listing_mode"] == "rent"
        assert Decimal(equipment_a["price"]) == Decimal("500.00")

        invalid_mode = client.post(
            "/equipment",
            json=equipment_payload | {"listing_mode": "exchange"},
            headers=user_a_headers,
        )
        assert invalid_mode.status_code == 422

        created_b = client.post(
            "/equipment",
            json=equipment_payload
            | {
                "name": "User B Camera",
                "listing_mode": "sell",
                "price": "15000.00",
            },
            headers=user_b_headers,
        )
        assert created_b.status_code == 201, created_b.text
        equipment_b = created_b.json()
        equipment_b_id = equipment_b["id"]
        assert equipment_b["listing_mode"] == "sell"
        assert Decimal(equipment_b["price"]) == Decimal("15000.00")
        assert equipment_b["owner"]["username"] == user_b["username"]

        future = date.today() + timedelta(days=10)
        sale_rental = client.post(
            "/rentals",
            headers=user_a_headers,
            json={
                "equipment_id": equipment_b_id,
                "start_date": future.isoformat(),
                "end_date": (future + timedelta(days=1)).isoformat(),
            },
        )
        assert sale_rental.status_code == 400, sale_rental.text

        all_equipment = client.get("/equipment")
        assert all_equipment.status_code == 200
        returned_ids = {item["id"] for item in all_equipment.json()["items"]}
        assert {equipment_a_id, equipment_b_id} <= returned_ids

        public_item = client.get(f"/equipment/{equipment_a_id}")
        assert public_item.status_code == 200
        assert public_item.json()["owner_id"] == user_a["id"]
        assert client.get("/equipment/2147483647").status_code == 404

        user_a_equipment = client.get("/equipment/me", headers=user_a_headers)
        user_b_equipment = client.get("/equipment/me", headers=user_b_headers)
        assert user_a_equipment.status_code == 200
        assert user_b_equipment.status_code == 200
        assert {item["id"] for item in user_a_equipment.json()} == {equipment_a_id}
        assert {item["id"] for item in user_b_equipment.json()} == {equipment_b_id}

        forbidden_update = client.patch(
            f"/equipment/{equipment_a_id}",
            json={"name": "Unauthorized change"},
            headers=user_b_headers,
        )
        assert forbidden_update.status_code == 403

        forbidden_delete = client.delete(
            f"/equipment/{equipment_a_id}", headers=user_b_headers
        )
        assert forbidden_delete.status_code == 403

        assert (
            client.patch(
                f"/equipment/{equipment_a_id}",
                json={"owner_id": user_b["id"]},
                headers=user_a_headers,
            ).status_code
            == 422
        )
        assert (
            client.patch(
                f"/equipment/{equipment_a_id}",
                json={"condition": "broken"},
                headers=user_a_headers,
            ).status_code
            == 422
        )

        updated = client.patch(
            f"/equipment/{equipment_a_id}",
            json={
                "condition": "good",
                "listing_mode": "sell",
                "price": "12000.00",
                "availability_status": "unavailable",
            },
            headers=user_a_headers,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["condition"] == "good"
        assert updated.json()["listing_mode"] == "sell"
        assert updated.json()["availability_status"] == "unavailable"
        assert Decimal(updated.json()["price"]) == Decimal("12000.00")
        assert updated.json()["owner_id"] == user_a["id"]

        deleted_a = client.delete(
            f"/equipment/{equipment_a_id}", headers=user_a_headers
        )
        assert deleted_a.status_code == 204
        assert client.get(f"/equipment/{equipment_a_id}").status_code == 404

        deleted_b = client.delete(
            f"/equipment/{equipment_b_id}", headers=user_b_headers
        )
        assert deleted_b.status_code == 204

        print("Equipment CRUD tests passed.")
        print("Equipment ownership tests passed.")
        print("My-equipment tests passed.")
    finally:
        with SessionLocal() as db:
            users = list(
                db.scalars(
                    select(User).where(User.email.in_([user_a_email, user_b_email]))
                ).all()
            )
            user_ids = [user.id for user in users]
            if user_ids:
                db.execute(delete(Equipment).where(Equipment.owner_id.in_(user_ids)))
                db.execute(delete(User).where(User.id.in_(user_ids)))
                db.commit()
            assert not db.scalar(
                select(User).where(User.email.in_([user_a_email, user_b_email]))
            )


if __name__ == "__main__":
    main()

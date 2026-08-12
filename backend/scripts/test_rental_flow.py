from datetime import date, timedelta
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
    return registration.json(), {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }


def create_equipment(
    client: TestClient,
    headers: dict[str, str],
    name: str,
    availability_status: str = "available",
) -> dict:
    response = client.post(
        "/equipment",
        headers=headers,
        json={
            "name": name,
            "description": "Rental workflow integration test equipment",
            "category": "test equipment",
            "condition": "good",
            "listing_mode": "rent",
            "price": "12.50",
            "availability_status": availability_status,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def rental_payload(equipment_id: int, start_offset: int, end_offset: int) -> dict:
    today = date.today()
    return {
        "equipment_id": equipment_id,
        "start_date": (today + timedelta(days=start_offset)).isoformat(),
        "end_date": (today + timedelta(days=end_offset)).isoformat(),
    }


def main() -> None:
    unique_id = uuid4().hex
    emails = [
        f"rental-owner-{unique_id}@example.com",
        f"rental-borrower-{unique_id}@example.com",
        f"rental-other-{unique_id}@example.com",
    ]
    password = "RentalIntegrationTest!42"
    client = TestClient(app)

    try:
        user_a, owner_headers = register_and_login(
            client, "Rental Owner", emails[0], password
        )
        user_b, borrower_headers = register_and_login(
            client, "Rental Borrower", emails[1], password
        )
        _, other_headers = register_and_login(
            client, "Unrelated User", emails[2], password
        )

        owner_equipment = create_equipment(
            client, owner_headers, "Owner Rental Camera"
        )
        unavailable_equipment = create_equipment(
            client, owner_headers, "Unavailable Camera", "unavailable"
        )
        borrower_equipment = create_equipment(
            client, borrower_headers, "Borrower-owned Camera"
        )

        main_payload = rental_payload(owner_equipment["id"], 10, 12)
        assert client.post("/rentals", json=main_payload).status_code == 401
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=main_payload | {"borrower_id": user_a["id"]},
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=main_payload | {"status": "accepted"},
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=rental_payload(2147483647, 10, 12),
            ).status_code
            == 404
        )
        assert (
            client.post(
                "/rentals",
                headers=owner_headers,
                json=main_payload,
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=rental_payload(unavailable_equipment["id"], 10, 12),
            ).status_code
            == 409
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=rental_payload(borrower_equipment["id"], 10, 12),
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json={
                    "equipment_id": owner_equipment["id"],
                    "start_date": (date.today() - timedelta(days=1)).isoformat(),
                    "end_date": date.today().isoformat(),
                },
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/rentals",
                headers=borrower_headers,
                json=rental_payload(owner_equipment["id"], 12, 10),
            ).status_code
            == 422
        )

        created = client.post(
            "/rentals", headers=borrower_headers, json=main_payload
        )
        assert created.status_code == 201, created.text
        main_request = created.json()
        main_request_id = main_request["id"]
        assert main_request["borrower_id"] == user_b["id"]
        assert main_request["equipment_id"] == owner_equipment["id"]
        assert main_request["status"] == "pending"
        assert main_request["borrower"] == {
            "id": user_b["id"],
            "name": user_b["name"],
        }

        duplicate = client.post(
            "/rentals", headers=borrower_headers, json=main_payload
        )
        assert duplicate.status_code == 409

        overlapping = client.post(
            "/rentals",
            headers=other_headers,
            json=rental_payload(owner_equipment["id"], 11, 13),
        )
        assert overlapping.status_code == 201, overlapping.text
        overlapping_request_id = overlapping.json()["id"]

        my_requests = client.get("/rentals/my-requests", headers=borrower_headers)
        assert my_requests.status_code == 200
        assert main_request_id in {item["id"] for item in my_requests.json()}

        incoming = client.get("/rentals/incoming", headers=owner_headers)
        assert incoming.status_code == 200
        assert {main_request_id, overlapping_request_id} <= {
            item["id"] for item in incoming.json()
        }

        assert (
            client.get(
                f"/rentals/{main_request_id}", headers=borrower_headers
            ).status_code
            == 200
        )
        assert (
            client.get(f"/rentals/{main_request_id}", headers=owner_headers).status_code
            == 200
        )
        assert (
            client.get(f"/rentals/{main_request_id}", headers=other_headers).status_code
            == 403
        )
        assert client.get("/rentals/2147483647", headers=owner_headers).status_code == 404

        assert (
            client.patch(
                f"/rentals/{main_request_id}/accept", headers=borrower_headers
            ).status_code
            == 403
        )
        assert (
            client.patch(
                f"/rentals/{main_request_id}/reject", headers=borrower_headers
            ).status_code
            == 403
        )
        assert (
            client.patch(
                f"/rentals/{main_request_id}/accept", headers=other_headers
            ).status_code
            == 403
        )
        assert (
            client.patch(
                f"/rentals/{main_request_id}/cancel", headers=other_headers
            ).status_code
            == 403
        )

        accepted = client.patch(
            f"/rentals/{main_request_id}/accept", headers=owner_headers
        )
        assert accepted.status_code == 200, accepted.text
        assert accepted.json()["status"] == "accepted"
        assert (
            client.patch(
                f"/rentals/{main_request_id}/accept", headers=owner_headers
            ).status_code
            == 409
        )

        overlap_conflict = client.patch(
            f"/rentals/{overlapping_request_id}/accept", headers=owner_headers
        )
        assert overlap_conflict.status_code == 409

        equipment_after_accept = client.get(f"/equipment/{owner_equipment['id']}")
        assert equipment_after_accept.json()["availability_status"] == "available"

        reject_request = client.post(
            "/rentals",
            headers=borrower_headers,
            json=rental_payload(owner_equipment["id"], 20, 21),
        )
        assert reject_request.status_code == 201
        reject_request_id = reject_request.json()["id"]
        rejected = client.patch(
            f"/rentals/{reject_request_id}/reject", headers=owner_headers
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"
        assert (
            client.patch(
                f"/rentals/{reject_request_id}/accept", headers=owner_headers
            ).status_code
            == 409
        )
        assert (
            client.patch(
                f"/rentals/{reject_request_id}/cancel", headers=borrower_headers
            ).status_code
            == 409
        )

        cancel_request = client.post(
            "/rentals",
            headers=borrower_headers,
            json=rental_payload(owner_equipment["id"], 30, 31),
        )
        assert cancel_request.status_code == 201
        cancel_request_id = cancel_request.json()["id"]
        assert (
            client.patch(
                f"/rentals/{cancel_request_id}/cancel", headers=owner_headers
            ).status_code
            == 403
        )
        cancelled = client.patch(
            f"/rentals/{cancel_request_id}/cancel", headers=borrower_headers
        )
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"
        assert (
            client.patch(
                f"/rentals/{cancel_request_id}/cancel", headers=borrower_headers
            ).status_code
            == 409
        )

        accepted_cancel = client.patch(
            f"/rentals/{main_request_id}/cancel", headers=borrower_headers
        )
        assert accepted_cancel.status_code == 200
        assert accepted_cancel.json()["status"] == "cancelled"

        print("Rental creation and listing tests passed.")
        print("Rental authorization and transitions tests passed.")
        print("Rental overlap protection tests passed.")
    finally:
        with SessionLocal() as db:
            users = list(db.scalars(select(User).where(User.email.in_(emails))).all())
            user_ids = [user.id for user in users]
            if user_ids:
                db.execute(delete(Equipment).where(Equipment.owner_id.in_(user_ids)))
                db.execute(delete(User).where(User.id.in_(user_ids)))
                db.commit()
            assert db.scalar(select(User).where(User.email.in_(emails))) is None


if __name__ == "__main__":
    main()

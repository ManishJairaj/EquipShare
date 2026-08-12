from datetime import date

import pytest


pytestmark = pytest.mark.integration


def test_rental_request_uses_authenticated_borrower(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="rent")
    response = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 201
    assert response.json()["borrower_id"] == users["borrower"].id
    assert response.json()["status"] == "pending"


def test_owner_cannot_request_own_equipment(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="rent")
    response = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 400


def test_owner_can_accept_pending_request(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"])
    created = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{created['id']}/accept", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"


def test_owner_can_reject_pending_request(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"])
    created = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{created['id']}/reject", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_borrower_can_cancel_pending_request(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"])
    created = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{created['id']}/cancel", headers=auth_headers(users["borrower"])
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.parametrize("action", ["accept", "reject", "cancel"])
def test_unrelated_user_cannot_modify_request(
    client, users, equipment_factory, auth_headers, request_payload, action
):
    equipment = equipment_factory(owner=users["owner"])
    created = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{created['id']}/{action}", headers=auth_headers(users["other"])
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("start_day", "end_day"),
    [(12, 14), (5, 11), (15, 18)],
)
def test_accept_rejects_inclusive_overlapping_dates(
    client,
    users,
    user_factory,
    equipment_factory,
    auth_headers,
    start_day,
    end_day,
):
    year = date.today().year + 1
    equipment = equipment_factory(owner=users["owner"])
    first = client.post(
        "/rentals",
        json={
            "equipment_id": equipment.id,
            "start_date": f"{year}-01-10",
            "end_date": f"{year}-01-15",
        },
        headers=auth_headers(users["borrower"]),
    ).json()
    assert client.patch(
        f"/rentals/{first['id']}/accept", headers=auth_headers(users["owner"])
    ).status_code == 200

    second_borrower = user_factory(
        username="second_borrower", email="second-borrower@example.com"
    )
    overlapping = client.post(
        "/rentals",
        json={
            "equipment_id": equipment.id,
            "start_date": f"{year}-01-{start_day:02d}",
            "end_date": f"{year}-01-{end_day:02d}",
        },
        headers=auth_headers(second_borrower),
    ).json()
    response = client.patch(
        f"/rentals/{overlapping['id']}/accept", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 409


def test_accept_allows_range_starting_after_existing_end_date(
    client, users, user_factory, equipment_factory, auth_headers
):
    year = date.today().year + 1
    equipment = equipment_factory(owner=users["owner"])
    first = client.post(
        "/rentals",
        json={
            "equipment_id": equipment.id,
            "start_date": f"{year}-01-10",
            "end_date": f"{year}-01-15",
        },
        headers=auth_headers(users["borrower"]),
    ).json()
    client.patch(
        f"/rentals/{first['id']}/accept", headers=auth_headers(users["owner"])
    )
    second_borrower = user_factory(
        username="second_borrower", email="second-borrower@example.com"
    )
    second = client.post(
        "/rentals",
        json={
            "equipment_id": equipment.id,
            "start_date": f"{year}-01-16",
            "end_date": f"{year}-01-18",
        },
        headers=auth_headers(second_borrower),
    ).json()
    response = client.patch(
        f"/rentals/{second['id']}/accept", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200


def test_equipment_with_related_requests_lists_once_without_eager_load_error(
    client, users, user_factory, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"], category="regression")
    client.post(
        "/rentals",
        json=request_payload(equipment.id, 10, 11),
        headers=auth_headers(users["borrower"]),
    )
    second_borrower = user_factory(
        username="second_borrower", email="second-borrower@example.com"
    )
    client.post(
        "/rentals",
        json=request_payload(equipment.id, 20, 21),
        headers=auth_headers(second_borrower),
    )

    response = client.get("/equipment", params={"category": "regression"})
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert [item["id"] for item in response.json()["items"]] == [equipment.id]
    assert len(response.json()["items"][0]["rental_requests"]) == 2

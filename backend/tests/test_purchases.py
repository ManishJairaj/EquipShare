from datetime import date

import pytest


pytestmark = pytest.mark.integration


def purchase_payload(equipment_id):
    today = date.today().isoformat()
    return {"equipment_id": equipment_id, "start_date": today, "end_date": today}


def test_sell_listing_accepts_mode_inferred_purchase_request(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    response = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 201
    assert response.json()["equipment"]["listing_mode"] == "sell"


def test_purchase_notifies_seller_that_item_was_purchased(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(
        owner=users["owner"], name="Campus Projector", listing_mode="sell"
    )
    response = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 201

    notifications = client.get(
        "/notifications", headers=auth_headers(users["owner"])
    )
    assert notifications.status_code == 200
    notification = notifications.json()[0]
    assert notification["type"] == "new_request"
    assert notification["rental_request_id"] == response.json()["id"]
    assert notification["is_read"] is False
    assert "Borrower purchased Campus Projector" in notification["message"]


def test_sell_listing_rejects_future_dated_rental_request(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    response = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 400


def test_owner_cannot_buy_own_listing(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    response = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 400


def test_accepted_purchase_marks_item_unavailable_and_blocks_another_buyer(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    purchase = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    accepted = client.patch(
        f"/rentals/{purchase['id']}/accept", headers=auth_headers(users["owner"])
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    assert client.get(f"/equipment/{equipment.id}").json()["availability_status"] == "unavailable"
    response = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["other"]),
    )
    assert response.status_code == 409


def test_sold_item_rejects_rental_shaped_request(
    client, users, equipment_factory, auth_headers, request_payload
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    purchase = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    client.patch(
        f"/rentals/{purchase['id']}/accept", headers=auth_headers(users["owner"])
    )
    response = client.post(
        "/rentals",
        json=request_payload(equipment.id, 10, 12),
        headers=auth_headers(users["other"]),
    )
    assert response.status_code in {400, 409}


def test_seller_can_reject_purchase(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    purchase = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{purchase['id']}/reject", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_buyer_can_cancel_purchase(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    purchase = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{purchase['id']}/cancel", headers=auth_headers(users["borrower"])
    )
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.parametrize("action", ["accept", "reject", "cancel"])
def test_unrelated_user_cannot_modify_purchase(
    client, users, equipment_factory, auth_headers, action
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="sell")
    purchase = client.post(
        "/rentals",
        json=purchase_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    ).json()
    response = client.patch(
        f"/rentals/{purchase['id']}/{action}", headers=auth_headers(users["other"])
    )
    assert response.status_code == 403


def test_request_type_cannot_be_spoofed_by_client(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(owner=users["owner"], listing_mode="rent")
    response = client.post(
        "/rentals",
        json=purchase_payload(equipment.id) | {"request_type": "purchase"},
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 422

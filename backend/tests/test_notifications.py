import pytest


pytestmark = pytest.mark.integration


def create_request(client, users, equipment_factory, auth_headers, request_payload):
    equipment = equipment_factory(
        owner=users["owner"], name="Notification Camera", listing_mode="rent"
    )
    response = client.post(
        "/rentals",
        json=request_payload(equipment.id),
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_new_request_creates_owner_notification(
    client, users, equipment_factory, auth_headers, request_payload
):
    request = create_request(
        client, users, equipment_factory, auth_headers, request_payload
    )

    owner_notifications = client.get(
        "/notifications", headers=auth_headers(users["owner"])
    )
    borrower_notifications = client.get(
        "/notifications", headers=auth_headers(users["borrower"])
    )

    assert owner_notifications.status_code == 200
    assert borrower_notifications.status_code == 200
    assert borrower_notifications.json() == []
    notification = owner_notifications.json()[0]
    assert notification["type"] == "new_request"
    assert notification["rental_request_id"] == request["id"]
    assert notification["is_read"] is False
    assert "Borrower requested Notification Camera" in notification["message"]


def test_accept_creates_borrower_notification(
    client, users, equipment_factory, auth_headers, request_payload
):
    request = create_request(
        client, users, equipment_factory, auth_headers, request_payload
    )
    response = client.patch(
        f"/rentals/{request['id']}/accept", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200

    notifications = client.get(
        "/notifications", headers=auth_headers(users["borrower"])
    ).json()
    assert len(notifications) == 1
    assert notifications[0]["type"] == "request_accepted"
    assert notifications[0]["message"] == (
        "Your request for Notification Camera was accepted."
    )


def test_reject_creates_borrower_notification(
    client, users, equipment_factory, auth_headers, request_payload
):
    request = create_request(
        client, users, equipment_factory, auth_headers, request_payload
    )
    response = client.patch(
        f"/rentals/{request['id']}/reject", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 200

    notifications = client.get(
        "/notifications", headers=auth_headers(users["borrower"])
    ).json()
    assert len(notifications) == 1
    assert notifications[0]["type"] == "request_rejected"
    assert notifications[0]["message"] == (
        "Your request for Notification Camera was rejected."
    )


def test_user_cannot_access_another_users_notification(
    client, users, equipment_factory, auth_headers, request_payload
):
    create_request(client, users, equipment_factory, auth_headers, request_payload)
    notification = client.get(
        "/notifications", headers=auth_headers(users["owner"])
    ).json()[0]

    response = client.patch(
        f"/notifications/{notification['id']}/read",
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 404


def test_mark_notification_read_updates_unread_count(
    client, users, equipment_factory, auth_headers, request_payload
):
    create_request(client, users, equipment_factory, auth_headers, request_payload)
    headers = auth_headers(users["owner"])
    notification = client.get("/notifications", headers=headers).json()[0]

    before = client.get("/notifications/unread-count", headers=headers)
    assert before.status_code == 200
    assert before.json() == {"unread_count": 1}

    marked = client.patch(
        f"/notifications/{notification['id']}/read", headers=headers
    )
    assert marked.status_code == 200
    assert marked.json()["is_read"] is True
    assert client.get("/notifications/unread-count", headers=headers).json() == {
        "unread_count": 0
    }


def test_mark_all_notifications_read(
    client,
    users,
    user_factory,
    equipment_factory,
    auth_headers,
    request_payload,
):
    equipment = equipment_factory(owner=users["owner"], name="Shared Camera")
    second_borrower = user_factory(
        username="notification_borrower_2", email="notification-2@example.com"
    )
    for borrower, offsets in ((users["borrower"], (10, 11)), (second_borrower, (20, 21))):
        response = client.post(
            "/rentals",
            json=request_payload(equipment.id, *offsets),
            headers=auth_headers(borrower),
        )
        assert response.status_code == 201

    headers = auth_headers(users["owner"])
    assert client.get("/notifications/unread-count", headers=headers).json() == {
        "unread_count": 2
    }
    response = client.patch("/notifications/read-all", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"marked_read": 2}
    assert client.get("/notifications/unread-count", headers=headers).json() == {
        "unread_count": 0
    }

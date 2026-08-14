import pytest


pytestmark = pytest.mark.integration


def public_key(seed: str) -> dict[str, str]:
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": f"x-coordinate-{seed}",
        "y": f"y-coordinate-{seed}",
    }


def browser_public_key(seed: str) -> dict[str, object]:
    return {
        **public_key(seed),
        "ext": True,
        "key_ops": [],
    }


def enable_chat(client, user, auth_headers, seed: str):
    response = client.put(
        "/chats/key",
        json={"public_key": public_key(seed)},
        headers=auth_headers(user),
    )
    assert response.status_code == 200, response.text


def create_conversation(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"], name="Secure Camera")
    enable_chat(client, users["owner"], auth_headers, "owner")
    enable_chat(client, users["borrower"], auth_headers, "borrower")
    response = client.post(
        "/chats",
        json={"equipment_id": equipment.id},
        headers=auth_headers(users["borrower"]),
    )
    assert response.status_code == 201, response.text
    return equipment, response.json()


def encrypted_payload(number: int) -> dict[str, str]:
    return {
        "ciphertext": f"encrypted-message-{number}",
        "iv": f"initial-vector-{number:04d}",
    }


def test_chat_routes_require_authentication(client):
    assert client.get("/chats").status_code == 401
    assert client.get("/chats/key").status_code == 401
    assert client.post("/chats", json={"equipment_id": 1}).status_code == 401


def test_browser_exported_jwk_is_accepted_and_normalized(
    client, users, auth_headers
):
    response = client.put(
        "/chats/key",
        json={"public_key": browser_public_key("browser")},
        headers=auth_headers(users["owner"]),
    )

    assert response.status_code == 200, response.text
    assert response.json()["public_key"] == public_key("browser")


def test_buyer_can_open_pending_chat_before_seller_initializes_key(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(owner=users["owner"], name="Pending Key Camera")
    enable_chat(client, users["borrower"], auth_headers, "borrower-pending")

    opened = client.post(
        "/chats",
        json={"equipment_id": equipment.id},
        headers=auth_headers(users["borrower"]),
    )
    assert opened.status_code == 201, opened.text
    assert opened.json()["peer_public_key"] is None

    notifications = client.get(
        "/notifications", headers=auth_headers(users["owner"])
    ).json()
    assert notifications[0]["conversation_id"] == opened.json()["id"]

    enable_chat(client, users["owner"], auth_headers, "owner-pending")
    refreshed = client.get(
        f"/chats/{opened.json()['id']}",
        headers=auth_headers(users["borrower"]),
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["peer_public_key"] == public_key("owner-pending")


def test_buyer_creates_encrypted_conversation_for_seller_listing(
    client, users, equipment_factory, auth_headers
):
    equipment, conversation = create_conversation(
        client, users, equipment_factory, auth_headers
    )
    assert conversation["equipment"]["id"] == equipment.id
    assert conversation["buyer"]["id"] == users["borrower"].id
    assert conversation["seller"]["id"] == users["owner"].id
    assert conversation["current_user_role"] == "buyer"
    assert conversation["peer_public_key"] == public_key("owner")
    assert conversation["messages"] == []


def test_owner_cannot_start_buyer_chat_for_own_listing(
    client, users, equipment_factory, auth_headers
):
    equipment = equipment_factory(owner=users["owner"])
    enable_chat(client, users["owner"], auth_headers, "owner")
    response = client.post(
        "/chats",
        json={"equipment_id": equipment.id},
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 400


def test_first_contact_waits_for_seller_reply_and_creates_notification(
    client, users, equipment_factory, auth_headers
):
    _, conversation = create_conversation(client, users, equipment_factory, auth_headers)
    conversation_id = conversation["id"]

    seller_first = client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(0),
        headers=auth_headers(users["owner"]),
    )
    assert seller_first.status_code == 409

    opening = client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(1),
        headers=auth_headers(users["borrower"]),
    )
    assert opening.status_code == 201
    assert opening.json()["ciphertext"] == "encrypted-message-1"

    buyer_again = client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(2),
        headers=auth_headers(users["borrower"]),
    )
    assert buyer_again.status_code == 409

    notifications = client.get(
        "/notifications", headers=auth_headers(users["owner"])
    ).json()
    assert notifications[0]["type"] == "new_chat_message"
    assert notifications[0]["conversation_id"] == conversation_id
    assert notifications[0]["rental_request_id"] is None
    assert "encrypted-message" not in notifications[0]["message"]

    reply = client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(3),
        headers=auth_headers(users["owner"]),
    )
    assert reply.status_code == 201

    buyer_after_reply = client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(4),
        headers=auth_headers(users["borrower"]),
    )
    assert buyer_after_reply.status_code == 201


def test_seller_can_block_and_continue_conversation(
    client, users, equipment_factory, auth_headers
):
    _, conversation = create_conversation(client, users, equipment_factory, auth_headers)
    conversation_id = conversation["id"]
    client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(1),
        headers=auth_headers(users["borrower"]),
    )
    client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(2),
        headers=auth_headers(users["owner"]),
    )

    assert client.patch(
        f"/chats/{conversation_id}/block", headers=auth_headers(users["borrower"])
    ).status_code == 403

    blocked = client.patch(
        f"/chats/{conversation_id}/block", headers=auth_headers(users["owner"])
    )
    assert blocked.status_code == 200
    assert blocked.json()["is_blocked"] is True
    assert client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(3),
        headers=auth_headers(users["borrower"]),
    ).status_code == 403

    continued = client.patch(
        f"/chats/{conversation_id}/unblock", headers=auth_headers(users["owner"])
    )
    assert continued.status_code == 200
    assert continued.json()["is_blocked"] is False
    assert client.post(
        f"/chats/{conversation_id}/messages",
        json=encrypted_payload(4),
        headers=auth_headers(users["borrower"]),
    ).status_code == 201


def test_unrelated_user_cannot_access_conversation(
    client, users, equipment_factory, auth_headers
):
    _, conversation = create_conversation(client, users, equipment_factory, auth_headers)
    response = client.get(
        f"/chats/{conversation['id']}", headers=auth_headers(users["other"])
    )
    assert response.status_code == 403


def test_only_latest_fifteen_encrypted_messages_are_retained(
    client, users, equipment_factory, auth_headers
):
    _, conversation = create_conversation(client, users, equipment_factory, auth_headers)
    conversation_id = conversation["id"]
    for number in range(17):
        sender = users["borrower"] if number != 1 else users["owner"]
        response = client.post(
            f"/chats/{conversation_id}/messages",
            json=encrypted_payload(number),
            headers=auth_headers(sender),
        )
        assert response.status_code == 201, response.text

    detail = client.get(
        f"/chats/{conversation_id}", headers=auth_headers(users["borrower"])
    ).json()
    assert len(detail["messages"]) == 15
    assert detail["messages"][0]["ciphertext"] == "encrypted-message-2"
    assert detail["messages"][-1]["ciphertext"] == "encrypted-message-16"
    assert all("plaintext" not in message for message in detail["messages"])

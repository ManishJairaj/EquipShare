import pytest


pytestmark = pytest.mark.integration


def equipment_payload(**overrides):
    payload = {
        "name": "Student Camera",
        "description": "Camera for a student film",
        "category": "cameras",
        "condition": "good",
        "listing_mode": "rent",
        "price": "500.00",
        "availability_status": "available",
    }
    return payload | overrides


def test_owner_is_derived_from_authenticated_user(client, users, auth_headers):
    owner = users["owner"]
    response = client.post(
        "/equipment", json=equipment_payload(), headers=auth_headers(owner)
    )
    assert response.status_code == 201
    assert response.json()["owner_id"] == owner.id
    assert response.json()["owner"] == {
        "id": owner.id,
        "username": owner.username,
        "name": owner.name,
    }


def test_client_cannot_spoof_owner_id(client, users, auth_headers):
    response = client.post(
        "/equipment",
        json=equipment_payload(owner_id=users["other"].id),
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 422


@pytest.mark.parametrize("method", ["patch", "delete"])
def test_non_owner_cannot_modify_equipment(
    client, users, equipment_factory, auth_headers, method
):
    equipment = equipment_factory(owner=users["owner"])
    request = getattr(client, method)
    kwargs = {"json": {"name": "Unauthorized"}} if method == "patch" else {}
    response = request(
        f"/equipment/{equipment.id}", headers=auth_headers(users["other"]), **kwargs
    )
    assert response.status_code == 403


def test_owner_can_update_equipment(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"])
    response = client.patch(
        f"/equipment/{equipment.id}",
        json={"name": "Updated Camera", "price": "650.00"},
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Camera"
    assert response.json()["price"] == "650.00"


def test_owner_can_delete_equipment(client, users, equipment_factory, auth_headers):
    equipment = equipment_factory(owner=users["owner"])
    response = client.delete(
        f"/equipment/{equipment.id}", headers=auth_headers(users["owner"])
    )
    assert response.status_code == 204
    assert client.get(f"/equipment/{equipment.id}").status_code == 404


def test_malformed_equipment_returns_structured_validation_error(
    client, users, auth_headers
):
    response = client.post(
        "/equipment",
        json=equipment_payload(condition="broken", price="not-a-number"),
        headers=auth_headers(users["owner"]),
    )
    assert response.status_code == 422
    assert isinstance(response.json().get("detail"), list)

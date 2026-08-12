import pytest
from sqlalchemy import select

from tests.conftest import DEFAULT_PASSWORD


pytestmark = pytest.mark.integration


def registration_payload(**overrides):
    payload = {
        "name": "New Student",
        "username": "new_student",
        "email": "new-student@example.com",
        "password": DEFAULT_PASSWORD,
    }
    return payload | overrides


def test_registration_hashes_password_and_returns_safe_fields(client, db_session):
    from app.models import User
    from app.services.security import verify_password

    response = client.post("/auth/register", json=registration_payload())

    assert response.status_code == 201
    assert set(response.json()) == {"id", "name", "username", "email", "created_at"}
    assert "password" not in response.json()
    assert "hashed_password" not in response.json()
    user = db_session.scalar(select(User).where(User.username == "new_student"))
    assert user is not None
    assert user.hashed_password != DEFAULT_PASSWORD
    assert verify_password(DEFAULT_PASSWORD, user.hashed_password)


def test_duplicate_username_is_rejected_case_insensitively(client):
    assert client.post("/auth/register", json=registration_payload()).status_code == 201
    response = client.post(
        "/auth/register",
        json=registration_payload(username="NEW_STUDENT", email="other@example.com"),
    )
    assert response.status_code == 409


def test_duplicate_email_is_rejected_case_insensitively(client):
    assert client.post("/auth/register", json=registration_payload()).status_code == 201
    response = client.post(
        "/auth/register",
        json=registration_payload(username="other_student", email="NEW-STUDENT@EXAMPLE.COM"),
    )
    assert response.status_code == 409


@pytest.mark.parametrize(
    "overrides",
    [
        {"password": "short"},
        {"username": "invalid username"},
    ],
)
def test_invalid_registration_returns_structured_validation_error(client, overrides):
    response = client.post("/auth/register", json=registration_payload(**overrides))
    assert response.status_code == 422
    assert isinstance(response.json().get("detail"), list)


def test_login_accepts_username(client, user_factory):
    user = user_factory(username="login_user", email="login@example.com")
    response = client.post(
        "/auth/login", data={"username": user.username, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"]


def test_login_accepts_email(client, user_factory):
    user = user_factory(username="login_user", email="login@example.com")
    response = client.post(
        "/auth/login", data={"username": user.email, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_wrong_password_returns_generic_401(client, user_factory):
    user = user_factory(username="login_user")
    response = client.post(
        "/auth/login", data={"username": user.username, "password": "WrongPassword!42"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username/email or password"


@pytest.mark.parametrize("identifier", ["missing_user", "missing@example.com"])
def test_unknown_login_identifier_returns_generic_401(client, identifier):
    response = client.post(
        "/auth/login", data={"username": identifier, "password": DEFAULT_PASSWORD}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect username/email or password"


def test_auth_me_accepts_valid_token(client, user_factory, auth_headers):
    user = user_factory(username="current_user")
    response = client.get("/auth/me", headers=auth_headers(user))
    assert response.status_code == 200
    assert response.json()["id"] == user.id
    assert response.json()["username"] == user.username


def test_auth_me_rejects_missing_token(client):
    assert client.get("/auth/me").status_code == 401


def test_auth_me_rejects_invalid_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401

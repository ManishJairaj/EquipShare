from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import User
from app.services.security import create_access_token, verify_password


def main() -> None:
    unique_id = uuid4().hex
    username = f"auth_{unique_id[:20]}"
    email = f"auth-test-{unique_id}@example.com"
    unknown_email = f"missing-{unique_id}@example.com"
    password = "IntegrationTestPassword!42"
    client = TestClient(app)

    try:
        registration = client.post(
            "/auth/register",
            json={
                "name": "Authentication Test",
                "username": username,
                "email": email,
                "password": password,
            },
        )
        assert registration.status_code == 201, registration.text
        registration_data = registration.json()
        assert set(registration_data) == {
            "id",
            "name",
            "username",
            "email",
            "created_at",
        }
        assert "password" not in registration_data
        assert "hashed_password" not in registration_data

        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            assert user is not None
            assert user.hashed_password != password
            assert user.hashed_password.startswith("$argon2")
            assert verify_password(password, user.hashed_password)
            user_id = user.id

        duplicate = client.post(
            "/auth/register",
            json={
                "name": "Duplicate Username",
                "username": username.upper(),
                "email": f"other-{unique_id}@example.com",
                "password": password,
            },
        )
        assert duplicate.status_code == 409

        duplicate_email = client.post(
            "/auth/register",
            json={
                "name": "Duplicate Email",
                "username": f"other_{unique_id[:20]}",
                "email": email.upper(),
                "password": password,
            },
        )
        assert duplicate_email.status_code == 409

        username_login = client.post(
            "/auth/login",
            data={"username": username.upper(), "password": password},
        )
        assert username_login.status_code == 200, username_login.text
        login_data = username_login.json()
        assert login_data["token_type"] == "bearer"
        access_token = login_data["access_token"]
        assert access_token

        email_login = client.post(
            "/auth/login",
            data={"username": email.upper(), "password": password},
        )
        assert email_login.status_code == 200, email_login.text

        wrong_password = client.post(
            "/auth/login",
            data={"username": username, "password": "WrongPassword!42"},
        )
        assert wrong_password.status_code == 401

        wrong_email_password = client.post(
            "/auth/login",
            data={"username": email, "password": "WrongPassword!42"},
        )
        assert wrong_email_password.status_code == 401

        unknown_user = client.post(
            "/auth/login",
            data={"username": unknown_email, "password": password},
        )
        assert unknown_user.status_code == 401

        current_user = client.get(
            "/auth/me", headers={"Authorization": f"Bearer {access_token}"}
        )
        assert current_user.status_code == 200, current_user.text
        assert current_user.json() == registration_data

        assert client.get("/auth/me").status_code == 401
        assert (
            client.get(
                "/auth/me", headers={"Authorization": "Bearer invalid-token"}
            ).status_code
            == 401
        )

        expired_token = create_access_token(
            user_id, expires_delta=timedelta(seconds=-1)
        )
        expired = client.get(
            "/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert expired.status_code == 401

        print("Registration tests passed.")
        print("Login tests passed.")
        print("Protected endpoint tests passed.")
    finally:
        with SessionLocal() as db:
            test_user = db.scalar(select(User).where(User.email == email))
            if test_user is not None:
                db.delete(test_user)
                db.commit()
            assert db.scalar(select(User).where(User.email == email)) is None


if __name__ == "__main__":
    main()

from collections.abc import Callable, Generator
from datetime import date, timedelta

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from scripts.test_database import BACKEND_DIR, get_test_database_url

load_dotenv(BACKEND_DIR / ".env")

REQUIRED_TABLES = {
    "users",
    "equipment",
    "rental_requests",
    "reviews",
    "notifications",
    "chat_conversations",
    "chat_messages",
    "alembic_version",
}
DEFAULT_PASSWORD = "ValidTestPassword!42"


def _test_database_url() -> str:
    try:
        return get_test_database_url()
    except (RuntimeError, ValueError) as exc:
        raise pytest.UsageError(f"Refusing to run tests: {exc}") from None


def pytest_sessionstart(session: pytest.Session) -> None:
    """Abort before collection unless the dedicated test URL passes all guards."""
    _test_database_url()


@pytest.fixture(scope="session")
def test_engine() -> Generator[Engine, None, None]:
    engine = create_engine(_test_database_url(), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            existing_tables = set(inspect(connection).get_table_names())
    except Exception as exc:
        engine.dispose()
        pytest.fail(
            "Could not connect to TEST_DATABASE_URL "
            f"({type(exc).__name__}). Check the dedicated test database settings."
        )

    missing_tables = REQUIRED_TABLES - existing_tables
    if missing_tables:
        engine.dispose()
        pytest.fail(
            "The dedicated test database is not migrated. Run Alembic upgrade head "
            "against TEST_DATABASE_URL before running integration tests."
        )

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
    connection = test_engine.connect()
    outer_transaction = connection.begin()
    session = Session(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        session.close()
        if outer_transaction.is_active:
            outer_transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    from app.database import get_db
    from app.main import app

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def password_hash() -> str:
    from app.services.security import hash_password

    return hash_password(DEFAULT_PASSWORD)


@pytest.fixture
def user_factory(
    db_session: Session, password_hash: str
) -> Callable[..., object]:
    from app.models import User

    counter = 0

    def create_user(
        *,
        name: str | None = None,
        username: str | None = None,
        email: str | None = None,
    ) -> User:
        nonlocal counter
        counter += 1
        user = User(
            name=name or f"Test User {counter}",
            username=username or f"test_user_{counter}",
            email=email or f"test-user-{counter}@example.com",
            hashed_password=password_hash,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return create_user


@pytest.fixture
def auth_headers() -> Callable[[object], dict[str, str]]:
    from app.services.security import create_access_token

    def headers_for(user: object) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user.id)}"}

    return headers_for


@pytest.fixture
def users(user_factory: Callable[..., object]) -> dict[str, object]:
    return {
        "owner": user_factory(name="Owner", username="owner", email="owner@example.com"),
        "borrower": user_factory(
            name="Borrower", username="borrower", email="borrower@example.com"
        ),
        "other": user_factory(name="Other", username="other", email="other@example.com"),
    }


@pytest.fixture
def equipment_factory(
    db_session: Session,
) -> Callable[..., object]:
    from app.models import Equipment

    counter = 0

    def create_equipment(
        *,
        owner: object,
        name: str | None = None,
        description: str = "Test equipment description",
        category: str = "electronics",
        condition: str = "good",
        listing_mode: str = "rent",
        price: str = "500.00",
        availability_status: str = "available",
    ) -> Equipment:
        nonlocal counter
        counter += 1
        equipment = Equipment(
            owner_id=owner.id,
            name=name or f"Test Equipment {counter}",
            description=description,
            category=category,
            condition=condition,
            listing_mode=listing_mode,
            price=price,
            availability_status=availability_status,
        )
        db_session.add(equipment)
        db_session.commit()
        db_session.refresh(equipment)
        return equipment

    return create_equipment


@pytest.fixture
def request_payload() -> Callable[..., dict[str, object]]:
    def build(equipment_id: int, start_offset: int = 10, end_offset: int = 12):
        today = date.today()
        return {
            "equipment_id": equipment_id,
            "start_date": (today + timedelta(days=start_offset)).isoformat(),
            "end_date": (today + timedelta(days=end_offset)).isoformat(),
        }

    return build

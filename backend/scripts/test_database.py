"""Safety guard shared by legacy database integration test scripts."""

import os
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url


BACKEND_DIR = Path(__file__).resolve().parents[1]


def get_test_database_url() -> str:
    """Return a validated, dedicated PostgreSQL test URL without exposing it."""
    values = dotenv_values(BACKEND_DIR / ".env")
    test_database_url = os.getenv("TEST_DATABASE_URL") or values.get(
        "TEST_DATABASE_URL"
    )
    development_database_url = os.getenv("DATABASE_URL") or values.get(
        "DATABASE_URL"
    )

    if not test_database_url:
        raise RuntimeError(
            "TEST_DATABASE_URL is required; refusing to run against DATABASE_URL"
        )
    if development_database_url and make_url(test_database_url) == make_url(
        development_database_url
    ):
        raise RuntimeError(
            "TEST_DATABASE_URL must not point to the same database as DATABASE_URL"
        )
    if make_url(test_database_url).get_backend_name() != "postgresql":
        raise RuntimeError("TEST_DATABASE_URL must use PostgreSQL")

    return str(test_database_url)


def configure_test_database() -> None:
    """Point this process at the validated test database for legacy scripts."""
    os.environ["DATABASE_URL"] = get_test_database_url()

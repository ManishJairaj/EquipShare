from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_normal_runtime_engine_is_postgresql():
    from app.database import DATABASE_URL, engine

    assert DATABASE_URL
    assert engine.url.get_backend_name() == "postgresql"


def test_database_configuration_has_no_sqlite_fallback():
    source = (BACKEND_DIR / "app" / "database.py").read_text()
    assert "sqlite" not in source.lower()
    assert 'os.getenv("DATABASE_URL")' in source
    assert "if not DATABASE_URL" in source


def test_alembic_has_one_linear_head():
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    script = ScriptDirectory.from_config(config)
    assert script.get_heads() == ["2b4c6d8e0f1a"]


def test_migrations_represent_current_foundational_schema():
    migration_text = "\n".join(
        path.read_text() for path in sorted((BACKEND_DIR / "alembic" / "versions").glob("*.py"))
    )
    for required_schema_term in (
        '"username"',
        '"listing_mode"',
        'new_column_name="price"',
        '"availability_status"',
        "rental_requests",
        "notifications",
        '"owner_id"',
    ):
        assert required_schema_term in migration_text


def test_python_310_compatibility_helpers_are_retained():
    model_enum_source = (BACKEND_DIR / "app" / "models" / "rental_request.py").read_text()
    schema_enum_source = (BACKEND_DIR / "app" / "schemas" / "equipment.py").read_text()
    rental_schema_source = (BACKEND_DIR / "app" / "schemas" / "rental_request.py").read_text()

    assert "from enum import StrEnum" not in model_enum_source
    assert "from enum import StrEnum" not in schema_enum_source
    assert "from typing_extensions import Self" in rental_schema_source

"""Apply Alembic migrations to the dedicated PostgreSQL test database."""

from alembic import command
from alembic.config import Config
from scripts.test_database import BACKEND_DIR, configure_test_database


def main() -> None:
    configure_test_database()
    alembic_config = Config(str(BACKEND_DIR / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    print("Dedicated PostgreSQL test database migrated to Alembic head.")


if __name__ == "__main__":
    main()

"""Alembic migration smoke tests."""

import logging
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

from app.models import database


BACKEND_DIR = Path(__file__).resolve().parents[1]


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", database_url)
    return config


def _current_alembic_head(config: Config) -> str:
    head = ScriptDirectory.from_config(config).get_current_head()
    assert head is not None
    return head


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def _column_map(engine: sa.Engine, table_name: str) -> dict[str, dict]:
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(f"PRAGMA table_info({table_name})").mappings().all()
    return {row["name"]: dict(row) for row in rows}


def test_alembic_upgrade_creates_current_schema_from_empty_sqlite(tmp_path):
    db_path = tmp_path / "empty.db"
    engine = sa.create_engine(_sqlite_url(db_path))

    command.upgrade(_alembic_config(_sqlite_url(db_path)), "head")

    inspector = sa.inspect(engine)
    assert {
        "alembic_version",
        "friendships",
        "global_courses",
        "saved_schedules",
        "users",
    }.issubset(set(inspector.get_table_names()))

    users = _column_map(engine, "users")
    assert "kvkk_consent_at" in users
    assert "consent_version" in users

    saved_schedules = _column_map(engine, "saved_schedules")
    assert saved_schedules["user_id"]["notnull"] == 0

    with engine.connect() as conn:
        version = conn.execute(sa.text("select version_num from alembic_version")).scalar_one()
    assert version == _current_alembic_head(_alembic_config(_sqlite_url(db_path)))


def test_alembic_upgrade_baselines_existing_dev_sqlite_db(tmp_path):
    db_path = tmp_path / "legacy.db"
    engine = sa.create_engine(_sqlite_url(db_path))
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE TABLE users (
                id INTEGER NOT NULL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                created_at DATETIME,
                is_active BOOLEAN
            )
            """
        )
        conn.exec_driver_sql("CREATE INDEX ix_users_id ON users (id)")
        conn.exec_driver_sql("CREATE UNIQUE INDEX ix_users_email ON users (email)")
        conn.exec_driver_sql(
            """
            CREATE TABLE saved_schedules (
                id INTEGER NOT NULL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                courses_json TEXT NOT NULL,
                created_at DATETIME,
                share_id VARCHAR(64) UNIQUE,
                FOREIGN KEY(user_id) REFERENCES users (id)
            )
            """
        )
        conn.exec_driver_sql("CREATE INDEX ix_saved_schedules_id ON saved_schedules (id)")
        conn.exec_driver_sql(
            "INSERT INTO users (id, email, password_hash, role, is_active) "
            "VALUES (1, 'legacy@isik.edu.tr', 'hash', 'user', 1)"
        )
        conn.exec_driver_sql(
            "INSERT INTO saved_schedules (id, user_id, name, courses_json) "
            "VALUES (1, 1, 'Legacy schedule', '[]')"
        )

    command.upgrade(_alembic_config(_sqlite_url(db_path)), "head")

    users = _column_map(engine, "users")
    assert "kvkk_consent_at" in users
    assert "consent_version" in users
    assert _column_map(engine, "saved_schedules")["user_id"]["notnull"] == 0

    with engine.connect() as conn:
        assert conn.execute(sa.text("select count(*) from users")).scalar_one() == 1
        assert conn.execute(sa.text("select count(*) from saved_schedules")).scalar_one() == 1
        version = conn.execute(sa.text("select version_num from alembic_version")).scalar_one()
    assert version == _current_alembic_head(_alembic_config(_sqlite_url(db_path)))


def test_alembic_upgrade_preserves_existing_application_loggers(tmp_path):
    db_path = tmp_path / "logging.db"
    app_logger = logging.getLogger("isikschedule")
    previous_disabled = app_logger.disabled
    app_logger.disabled = False

    try:
        command.upgrade(_alembic_config(_sqlite_url(db_path)), "head")
        assert app_logger.disabled is False
    finally:
        app_logger.disabled = previous_disabled


def test_backend_dockerfile_copies_alembic_assets():
    dockerfile = (BACKEND_DIR / "Dockerfile").read_text(encoding="utf-8")

    assert "COPY alembic.ini ." in dockerfile
    assert "COPY alembic/ ./alembic/" in dockerfile


def test_init_db_runs_alembic_migrations_instead_of_create_all(monkeypatch):
    calls = []

    def record_migration():
        calls.append("migrate")

    def fail_create_all(**_kwargs):
        raise AssertionError("init_db should run Alembic migrations, not create_all")

    monkeypatch.setattr(database, "run_migrations", record_migration)
    monkeypatch.setattr(database.Base.metadata, "create_all", fail_create_all)

    database.init_db()

    assert calls == ["migrate"]

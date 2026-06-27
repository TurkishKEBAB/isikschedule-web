"""Shared pytest fixtures for the backend smoke suite.

Each test gets a fresh in-memory SQLite database, a fresh UPLOAD_DIR
under tmp_path, and a TestClient whose `get_db` dependency is wired to
the test session. Lifespan events are skipped so we never touch the
real on-disk data.db.
"""

from __future__ import annotations

import io
from typing import Iterator

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.main import app
from app.models.database import Base, get_db


@pytest.fixture(autouse=True)
def _isolate_rate_limiter() -> Iterator[None]:
    """Keep the process-wide slowapi limiter out of the way by default.

    The limiter instance lives at module scope (``app.core.rate_limit``) so
    its counters survive across tests. Disable it and clear its storage
    around every test; rate-limit tests re-enable it explicitly in their
    own body.
    """
    from app.core.rate_limit import limiter

    def _quiet_reset() -> None:
        limiter.enabled = False
        try:
            limiter.reset()
        except Exception:
            pass

    _quiet_reset()
    yield
    _quiet_reset()


@pytest.fixture()
def db_session() -> Iterator:
    """Per-test in-memory SQLite session.

    StaticPool keeps a single connection so the in-memory DB survives
    across calls within the test, and check_same_thread=False lets
    FastAPI/Starlette use it from worker threads.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(db_session, tmp_path, monkeypatch) -> Iterator[TestClient]:
    """TestClient with get_db overridden and UPLOAD_DIR isolated."""

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_dir))

    app.dependency_overrides[get_db] = _override_get_db
    # raise_server_exceptions=False so the global exception handler runs
    # and we can assert on its JSON shape instead of seeing the raw
    # exception bubble up through Starlette.
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def sample_xlsx_bytes() -> bytes:
    """Tiny in-memory xlsx covering one full course (lecture + lab + ps).

    Two main codes: SOFT3215 (lecture + lab) and MATH1101 (lecture only).
    Schedule slots are picked so the lecture+lab combo is conflict-free.
    """
    wb = Workbook()
    ws = wb.active
    ws.append(
        [
            "Ders Kodu",
            "Ders Adı",
            "AKTS",
            "Ders Saati",
            "Eğitmen Adı",
            "Eğitmen Soyadı",
            "Fakülte Adı",
        ]
    )
    rows = [
        ("SOFT3215.01", "Software Engineering", 6, "M1, M2", "Ada", "Lovelace", "FENS"),
        ("SOFT3215.LAB.1", "Software Engineering Lab", 0, "T3, T4", "Ada", "Lovelace", "FENS"),
        ("MATH1101.01", "Calculus I", 5, "W1, W2", "Carl", "Gauss", "FENS"),
    ]
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.fixture()
def sample_xlsx_upload(client, auth_headers, sample_xlsx_bytes):
    """Upload the sample xlsx (authenticated) and return the UploadResponse JSON."""
    response = client.post(
        "/api/upload",
        headers=auth_headers,
        files={
            "file": (
                "sample.xlsx",
                sample_xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture()
def auth_headers(client):
    """Register a fresh user and return Bearer auth headers."""
    register_payload = {
        "email": "smoke-user@isik.edu.tr",
        "password": "smoke-pass-123",
    }
    response = client.post("/api/auth/register", json=register_payload)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

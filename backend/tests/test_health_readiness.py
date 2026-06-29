"""Readiness probe contract tests."""

import pytest

from app.config import settings
from app.main import app
from app.models.database import get_db


def test_readiness_returns_healthy_when_dependencies_are_available(client):
    response = client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"]["database"]["ok"] is True
    assert body["checks"]["uploads"]["ok"] is True
    assert body["checks"]["config"]["ok"] is True


def test_readiness_returns_503_when_database_check_fails(client):
    class BrokenSession:
        def execute(self, statement):
            raise RuntimeError("database unavailable")

    def broken_db():
        yield BrokenSession()

    app.dependency_overrides[get_db] = broken_db

    response = client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["ready"] is False
    assert body["checks"]["database"]["ok"] is False
    assert "database unavailable" in body["checks"]["database"]["message"]


def test_readiness_returns_503_when_upload_directory_is_not_writable(client, tmp_path, monkeypatch):
    upload_path = tmp_path / "uploads-as-file"
    upload_path.write_text("not a directory", encoding="utf-8")
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_path))

    response = client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["ready"] is False
    assert body["checks"]["uploads"]["ok"] is False


@pytest.mark.parametrize(
    ("setting_name", "bad_value"),
    [
        ("DATABASE_URL", ""),
        ("SECRET_KEY", ""),
    ],
)
def test_readiness_returns_503_when_critical_config_is_missing(
    client, monkeypatch, setting_name, bad_value
):
    monkeypatch.setattr(settings, setting_name, bad_value)

    response = client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["ready"] is False
    assert body["checks"]["config"]["ok"] is False
    assert setting_name in body["checks"]["config"]["message"]

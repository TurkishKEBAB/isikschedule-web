"""Security regression tests for admin semester uploads."""

from __future__ import annotations

import io
import re
from pathlib import Path

import pytest
from fastapi import HTTPException, UploadFile

from app.core.auth import create_access_token, get_password_hash
from app.models.database import User


def _admin_headers(db_session) -> dict[str, str]:
    admin = User(
        email="admin-upload@isik.edu.tr",
        password_hash=get_password_hash("admin-pass-123"),
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()
    token = create_access_token({"sub": admin.email})
    return {"Authorization": f"Bearer {token}"}


def _courses() -> list[dict[str, object]]:
    return [
        {
            "code": "SOFT3215.01",
            "name": "Software Engineering",
            "ects": 6,
            "schedule": [("Monday", 1)],
        }
    ]


def test_admin_upload_rejects_legacy_xls(
    client,
    db_session,
    monkeypatch,
    tmp_path,
    sample_xlsx_bytes,
):
    from app.api.routes import admin as admin_routes

    monkeypatch.setattr(admin_routes, "UPLOAD_DIR", tmp_path / "uploads", raising=False)
    monkeypatch.setattr(admin_routes, "process_excel", lambda _path: _courses())

    response = client.post(
        "/api/admin/upload-semester",
        params={"semester": "2026-Fall"},
        headers=_admin_headers(db_session),
        files={"file": ("legacy.xls", sample_xlsx_bytes, "application/vnd.ms-excel")},
    )

    assert response.status_code == 400, response.text


def test_admin_upload_rejects_invalid_semester_before_saving(
    client,
    db_session,
    monkeypatch,
    tmp_path,
    sample_xlsx_bytes,
):
    from app.api.routes import admin as admin_routes

    upload_dir = tmp_path / "admin-uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(admin_routes, "UPLOAD_DIR", upload_dir, raising=False)
    monkeypatch.setattr(admin_routes, "process_excel", lambda _path: _courses())

    response = client.post(
        "/api/admin/upload-semester",
        params={"semester": "../2026-Fall"},
        headers=_admin_headers(db_session),
        files={
            "file": (
                "sample.xlsx",
                sample_xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert response.status_code == 400, response.text
    assert list(upload_dir.iterdir()) == []


def test_admin_upload_stores_uuid_filename_in_settings_upload_dir(
    client,
    db_session,
    monkeypatch,
    sample_xlsx_bytes,
):
    from app.api.routes import admin as admin_routes
    from app.config import settings

    monkeypatch.setattr(admin_routes, "process_excel", lambda path: _courses())

    legacy_path = Path("uploads") / "global_2026-Fall_client-name.xlsx"
    response = client.post(
        "/api/admin/upload-semester",
        params={"semester": "2026-Fall"},
        headers=_admin_headers(db_session),
        files={
            "file": (
                "client-name.xlsx",
                sample_xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    if legacy_path.exists():
        legacy_path.unlink()

    assert response.status_code == 200, response.text
    stored_files = list(Path(settings.UPLOAD_DIR).glob("*.xlsx"))
    assert len(stored_files) == 1
    assert re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.xlsx",
        stored_files[0].name,
    )
    assert "client-name" not in stored_files[0].name
    assert "2026-Fall" not in stored_files[0].name


@pytest.mark.anyio
async def test_admin_upload_filename_none_returns_400(db_session, monkeypatch):
    from app.api.routes import admin as admin_routes

    monkeypatch.setattr(admin_routes, "process_excel", lambda _path: _courses())
    admin = User(
        email="direct-admin@isik.edu.tr",
        password_hash=get_password_hash("admin-pass-123"),
        role="admin",
    )

    upload = UploadFile(file=io.BytesIO(b"not-important"), filename=None)
    with pytest.raises(HTTPException) as exc_info:
        await admin_routes.upload_semester(
            semester="2026-Fall",
            file=upload,
            db=db_session,
            admin=admin,
        )

    assert exc_info.value.status_code == 400

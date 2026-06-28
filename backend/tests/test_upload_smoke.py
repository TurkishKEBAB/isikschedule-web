"""Smoke tests for the Excel upload flow."""


def test_valid_xlsx_returns_preview(client, auth_headers, sample_xlsx_bytes):
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

    body = response.json()
    assert body["file_id"]
    assert body["course_count"] >= 1
    assert isinstance(body["preview"], list)
    assert body["preview"], "preview must contain at least one course"
    first = body["preview"][0]
    assert {"code", "name", "ects", "schedule"} <= set(first.keys())


def test_invalid_extension_rejected(client, auth_headers):
    response = client.post(
        "/api/upload",
        headers=auth_headers,
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400


def test_get_courses_after_upload(client, auth_headers, sample_xlsx_upload):
    file_id = sample_xlsx_upload["file_id"]
    response = client.get(
        f"/api/upload/{file_id}/courses",
        headers=auth_headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["file_id"] == file_id
    assert isinstance(body["courses"], list)
    assert body["courses"], "expected non-empty courses list"


def test_upload_requires_auth(client, sample_xlsx_bytes):
    """A5: anonymous upload is rejected before any parsing happens."""
    response = client.post(
        "/api/upload",
        files={
            "file": (
                "sample.xlsx",
                sample_xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code in (401, 403), response.text


def test_get_courses_requires_auth(client):
    """A5: anonymous course listing is rejected (no file_id enumeration)."""
    response = client.get(
        "/api/upload/00000000-0000-0000-0000-000000000000/courses",
    )
    assert response.status_code in (401, 403), response.text

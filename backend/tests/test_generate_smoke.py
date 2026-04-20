"""Smoke tests for the schedule generation flow."""


def test_generate_happy_path(client, sample_xlsx_upload):
    response = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": ["SOFT3215", "MATH1101"],
            "algorithm": "dfs",
        },
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["job_id"]
    assert body["status"] in {"completed", "processing", "failed"}
    assert "message" in body


def test_generate_rejects_empty_selection(client, sample_xlsx_upload):
    response = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": [],
        },
    )
    assert response.status_code == 400


def test_job_status_endpoint_returns_result(client, sample_xlsx_upload):
    start = client.post(
        "/api/generate",
        json={
            "file_id": sample_xlsx_upload["file_id"],
            "selected_main_codes": ["SOFT3215"],
        },
    )
    job_id = start.json()["job_id"]

    status = client.get(f"/api/jobs/{job_id}")
    assert status.status_code == 200, status.text
    payload = status.json()
    assert payload["job_id"] == job_id
    assert "status" in payload and "result" in payload

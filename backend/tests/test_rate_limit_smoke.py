"""Smoke test for upload rate limiting (A5).

The shared limiter is disabled for the rest of the suite by the autouse
``_isolate_rate_limiter`` fixture; this test re-enables it with a tiny limit
and verifies the per-IP threshold trips a 429 in the standard error shape.
"""


def _upload(client, auth_headers, xlsx_bytes):
    return client.post(
        "/api/upload",
        headers=auth_headers,
        files={
            "file": (
                "sample.xlsx",
                xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )


def test_upload_rate_limited_after_threshold(
    client, auth_headers, sample_xlsx_bytes, monkeypatch
):
    from app.config import settings
    from app.core.rate_limit import limiter

    monkeypatch.setattr(settings, "UPLOAD_RATE_LIMIT", "2/minute")
    limiter.reset()
    limiter.enabled = True

    assert _upload(client, auth_headers, sample_xlsx_bytes).status_code == 200
    assert _upload(client, auth_headers, sample_xlsx_bytes).status_code == 200

    throttled = _upload(client, auth_headers, sample_xlsx_bytes)
    assert throttled.status_code == 429, throttled.text
    assert throttled.json()["error"] == "Too many requests"

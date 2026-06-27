"""Smoke tests for the anonymous share flow.

Phase 1.5 will rework anonymous share ownership (currently the schedule
gets pinned to the first user in the table — see schedules.py:84-111).
These tests pin the response shape so that change can be made
deliberately rather than as collateral.
"""


def _seed_user(client):
    """Anonymous share currently requires at least one user in DB."""
    response = client.post(
        "/api/auth/register",
        json={"email": "owner@isik.edu.tr", "password": "owner-pw-1"},
    )
    assert response.status_code == 200, response.text


def test_anonymous_share_then_fetch_roundtrip(client):
    _seed_user(client)

    courses = [
        {"code": "SOFT3215.01", "main_code": "SOFT3215", "name": "SE", "schedule": []},
    ]
    share_response = client.post(
        "/api/schedules/share",
        json={"courses": courses},
    )
    assert share_response.status_code == 200, share_response.text
    share_body = share_response.json()
    assert share_body["share_code"]
    assert share_body["share_url"].endswith(share_body["share_code"])
    # A7: share codes must be high-entropy, not a truncated uuid (16 hex chars).
    assert len(share_body["share_code"]) >= 20

    fetch_response = client.get(f"/api/shared/{share_body['share_code']}")
    assert fetch_response.status_code == 200, fetch_response.text
    fetch_body = fetch_response.json()
    assert fetch_body["share_code"] == share_body["share_code"]
    assert fetch_body["schedule"]["courses_json"]


def test_unknown_share_code_returns_404(client):
    _seed_user(client)
    response = client.get("/api/shared/does-not-exist")
    assert response.status_code == 404


def test_cannot_mint_share_for_arbitrary_schedule_by_id(client):
    """A1 (IDOR): the unauthenticated share-by-integer-id endpoint must not
    hand back a share code for an existing schedule it doesn't own."""
    _seed_user(client)
    created = client.post(
        "/api/schedules/share",
        json={"courses": [{"code": "X", "main_code": "X", "name": "X", "schedule": []}]},
    ).json()
    schedule_id = client.get(f"/api/shared/{created['share_code']}").json()["schedule"]["id"]

    resp = client.post(f"/api/schedules/share/{schedule_id}")
    # Endpoint is removed, so the attacker gets no route and, crucially, no code.
    assert resp.status_code in (404, 405), resp.text
    assert "share_code" not in resp.json()

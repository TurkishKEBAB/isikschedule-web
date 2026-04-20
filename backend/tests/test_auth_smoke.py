"""Smoke tests for the auth flow.

These pin the response shape of /api/auth/register and /api/auth/login
so Phase 1 (SECRET_KEY consolidation, settings refactor) cannot
silently break the contract.
"""


def test_register_happy_path(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "alice@isik.edu.tr", "password": "alice-pw-1"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "alice@isik.edu.tr"
    assert body["user"]["role"] == "user"


def test_login_happy_path(client):
    client.post(
        "/api/auth/register",
        json={"email": "bob@isikun.edu.tr", "password": "bob-pw-1"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "bob@isikun.edu.tr", "password": "bob-pw-1"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]


def test_login_wrong_password_returns_401(client):
    client.post(
        "/api/auth/register",
        json={"email": "carol@isik.edu.tr", "password": "carol-pw-1"},
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "carol@isik.edu.tr", "password": "wrong"},
    )
    assert response.status_code == 401

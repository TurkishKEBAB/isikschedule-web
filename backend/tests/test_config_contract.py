"""Deployment configuration contract tests."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _production_settings(**overrides):
    values = {
        "APP_ENV": "production",
        "DEBUG": False,
        "SECRET_KEY": "prod-secret-key-that-is-not-the-default",
        "ADMIN_EMAIL": "admin@isik.edu.tr",
        "ADMIN_PASSWORD": "prod-admin-password",
        "CORS_ORIGINS": ["https://isikschedule.yigiokur.me"],
    }
    values.update(overrides)
    return Settings(**values)


def test_production_rejects_localhost_cors_origins():
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        _production_settings(CORS_ORIGINS=["http://localhost:3000"])


def test_production_accepts_public_https_cors_origin():
    settings = _production_settings()

    assert settings.CORS_ORIGINS == ["https://isikschedule.yigiokur.me"]

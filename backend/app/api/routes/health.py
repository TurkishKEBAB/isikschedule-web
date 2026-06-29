"""Health check endpoints."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_SECRET_KEY,
    settings,
)
from app.models.database import get_db

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for monitoring."""

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        environment=settings.APP_ENV,
    )


@router.get("/health/ready")
async def readiness_check(response: Response, db: Session = Depends(get_db)):
    """Readiness probe - checks if app can serve traffic."""
    checks = {
        "database": _check_database(db),
        "uploads": _check_upload_directory(),
        "config": _check_critical_config(),
    }
    ready = all(check["ok"] for check in checks.values())
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"ready": ready, "checks": checks}


def _check_database(db: Session) -> dict:
    """Run a cheap query against the configured database connection."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        return {"ok": False, "message": f"Database check failed: {exc}"}
    return {"ok": True}


def _check_upload_directory() -> dict:
    """Verify the upload directory already exists and accepts writes."""
    upload_dir = Path(settings.UPLOAD_DIR)
    if not upload_dir.exists():
        return {"ok": False, "message": f"Upload directory does not exist: {upload_dir}"}
    if not upload_dir.is_dir():
        return {"ok": False, "message": f"Upload path is not a directory: {upload_dir}"}

    try:
        with tempfile.NamedTemporaryFile(
            dir=upload_dir,
            prefix=".ready-check-",
            suffix=".tmp",
            delete=True,
        ) as probe:
            probe.write(b"ok")
            probe.flush()
    except Exception as exc:
        return {"ok": False, "message": f"Upload directory is not writable: {exc}"}
    return {"ok": True}


def _check_critical_config() -> dict:
    """Catch runtime config holes that would prevent safe request handling."""
    required_values = {
        "DATABASE_URL": settings.DATABASE_URL,
        "UPLOAD_DIR": settings.UPLOAD_DIR,
        "SECRET_KEY": settings.SECRET_KEY,
        "ADMIN_EMAIL": settings.ADMIN_EMAIL,
        "ADMIN_PASSWORD": settings.ADMIN_PASSWORD,
    }
    missing = [
        name
        for name, value in required_values.items()
        if not isinstance(value, str) or not value.strip()
    ]
    if missing:
        return {"ok": False, "message": f"Missing critical config: {', '.join(missing)}"}

    if settings.APP_ENV.lower() in {"production", "prod"}:
        insecure_defaults = []
        if settings.SECRET_KEY == DEFAULT_SECRET_KEY:
            insecure_defaults.append("SECRET_KEY")
        if settings.ADMIN_EMAIL == DEFAULT_ADMIN_EMAIL:
            insecure_defaults.append("ADMIN_EMAIL")
        if settings.ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
            insecure_defaults.append("ADMIN_PASSWORD")
        if insecure_defaults:
            return {
                "ok": False,
                "message": f"Insecure production config: {', '.join(insecure_defaults)}",
            }

    return {"ok": True}


@router.get("/health/live")
async def liveness_check():
    """Liveness probe - checks if app is running."""
    return {"alive": True}

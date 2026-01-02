"""Health check endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for monitoring."""
    from app.config import settings
    
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        environment=settings.APP_ENV,
    )


@router.get("/health/ready")
async def readiness_check():
    """Readiness probe - checks if app can serve traffic."""
    # TODO: Check database, redis connections
    return {"ready": True}


@router.get("/health/live")
async def liveness_check():
    """Liveness probe - checks if app is running."""
    return {"alive": True}

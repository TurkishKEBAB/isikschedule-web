"""
IşıkSchedule Backend - FastAPI Application

Enterprise-grade course scheduling API.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api.routes import upload, generate, schedules, health, auth, admin, courses, friends
from app.core.rate_limit import limiter
from app.models.database import init_db, create_admin_user

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("isikschedule")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"🚀 Starting {settings.APP_NAME} v1.0.0")
    print(f"📊 Environment: {settings.APP_ENV}")
    
    # Initialize database
    print("🗄️ Initializing database...")
    init_db()
    create_admin_user()
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-grade course scheduling platform for universities",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting (slowapi). The limiter instance lives in app.core.rate_limit;
# Starlette needs it on app.state for the exception handler to resolve it.
app.state.limiter = limiter

# CORS Middleware
# Phase 1.8: dev keeps the permissive wildcard behavior (configured via
# CORS_ORIGINS in .env, typically localhost:3000). Production narrows methods
# and headers to only what the frontend actually uses, so a leaked token
# cannot be exfiltrated via arbitrary cross-origin requests.
_is_production = settings.APP_ENV.lower() in {"production", "prod"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=(
        ["GET", "POST", "PUT", "DELETE", "OPTIONS"] if _is_production else ["*"]
    ),
    allow_headers=(
        ["Authorization", "Content-Type", "Accept"] if _is_production else ["*"]
    ),
)


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, tags=["Auth"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(courses.router, tags=["Courses"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(generate.router, prefix="/api", tags=["Generate"])
app.include_router(schedules.router, prefix="/api", tags=["Schedules"])
app.include_router(friends.router, prefix="/api", tags=["Friends"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc: RateLimitExceeded):
    """Return a 429 in the same {error, message} shape as other errors (K6)."""
    return JSONResponse(
        status_code=429,
        content={
            "error": "Too many requests",
            "message": "Rate limit exceeded. Please slow down and try again shortly.",
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler — logs full traceback, keeps response shape stable (K6)."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred",
        },
    )

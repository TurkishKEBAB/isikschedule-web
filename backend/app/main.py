"""
IşıkSchedule Backend - FastAPI Application

Enterprise-grade course scheduling API.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.routes import upload, generate, schedules, health, auth, admin, courses, friends
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

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

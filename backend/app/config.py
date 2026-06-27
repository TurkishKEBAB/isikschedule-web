"""
Application configuration using pydantic-settings.
"""

from functools import lru_cache
from typing import Any, List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# A2: these are intentionally non-functional placeholders, not real credentials.
# Real values must come from the environment / .env (see .env.example). They double
# as the "left at default" sentinels the production guard and bootstrap warning check.
DEFAULT_SECRET_KEY = "change-me-in-production"
DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "change-me-in-production"  # noqa: S105


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Application
    APP_NAME: str = "IşıkSchedule"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = DEFAULT_SECRET_KEY

    # Auth / JWT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite:///./data.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 100
    # Master switch (tests disable this so the shared limiter never trips).
    RATE_LIMIT_ENABLED: bool = True
    # Per-IP limit for the upload endpoints (slowapi limit string).
    UPLOAD_RATE_LIMIT: str = "20/minute"
    
    # Job Settings
    JOB_TIMEOUT_SECONDS: int = 300
    MAX_SCHEDULES_PER_JOB: int = 50

    # Admin bootstrap — development defaults are accepted with a warning;
    # production requires both to be set (see _require_production_admin).
    ADMIN_EMAIL: str = DEFAULT_ADMIN_EMAIL
    ADMIN_PASSWORD: str = DEFAULT_ADMIN_PASSWORD  # noqa: S105

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: Any) -> Any:
        """Accept common environment labels for debug mode."""
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        """Allow comma-separated origins in .env files."""
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                return value
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _require_production_secrets(self) -> "Settings":
        # Block insecure defaults in production so a forgotten env var can
        # never sign real tokens or ship a well-known admin credential.
        if self.APP_ENV.lower() in {"production", "prod"}:
            if self.SECRET_KEY == DEFAULT_SECRET_KEY:
                raise ValueError(
                    "SECRET_KEY must be overridden in production "
                    "(set SECRET_KEY env var or .env entry)."
                )
            if self.ADMIN_EMAIL == DEFAULT_ADMIN_EMAIL or self.ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
                raise ValueError(
                    "ADMIN_EMAIL and ADMIN_PASSWORD must be overridden in production."
                )
        return self

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()

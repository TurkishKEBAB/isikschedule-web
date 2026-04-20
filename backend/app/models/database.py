"""
Database models for IşıkSchedule.
Uses SQLite with SQLAlchemy ORM.
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime, timezone

from ..config import settings


def _utcnow() -> datetime:
    """Timezone-aware UTC 'now' used as the default for timestamp columns."""
    return datetime.now(timezone.utc)

DATABASE_URL = settings.DATABASE_URL

# check_same_thread is a SQLite-only pragma; harmless when absent for other drivers
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class User(Base):
    """User model for authentication."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")  # "admin" or "user"
    created_at = Column(DateTime, default=_utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    saved_schedules = relationship("SavedSchedule", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.email}>"


class SavedSchedule(Base):
    """Saved schedule for a user."""
    __tablename__ = "saved_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    # Nullable since Phase 1.5: anonymous shares have no owner. Filter
    # user_id IS NOT NULL when listing a user's own saved schedules.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    courses_json = Column(Text, nullable=False)  # JSON string of courses
    created_at = Column(DateTime, default=_utcnow)
    share_id = Column(String(64), unique=True, nullable=True)  # For sharing
    
    # Relationships
    user = relationship("User", back_populates="saved_schedules")
    
    def __repr__(self):
        return f"<SavedSchedule {self.name}>"


class Friendship(Base):
    """Friendship relationship between two users."""
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="pending")  # "pending", "accepted", "rejected"
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="friendships_sent")
    friend = relationship("User", foreign_keys=[friend_id], backref="friendships_received")

    def __repr__(self):
        return f"<Friendship {self.user_id} -> {self.friend_id} ({self.status})>"


class GlobalCourse(Base):
    """Global course data uploaded by admin."""
    __tablename__ = "global_courses"
    
    id = Column(Integer, primary_key=True, index=True)
    semester = Column(String(50), nullable=False)  # e.g., "2024-2025-Fall"
    courses_json = Column(Text, nullable=False)  # JSON string of all courses
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=_utcnow)
    is_active = Column(Boolean, default=True)  # Current active semester
    
    def __repr__(self):
        return f"<GlobalCourse {self.semester}>"


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")


def create_admin_user():
    """Create initial admin user if not exists, using settings (Phase 1.4)."""
    from ..core.auth import get_password_hash
    from ..config import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
    import logging

    log = logging.getLogger("isikschedule")
    admin_email = settings.ADMIN_EMAIL
    admin_password = settings.ADMIN_PASSWORD

    if admin_email == DEFAULT_ADMIN_EMAIL or admin_password == DEFAULT_ADMIN_PASSWORD:
        log.warning(
            "Using built-in ADMIN_EMAIL/ADMIN_PASSWORD default. "
            "Override via .env before deploying."
        )

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == admin_email).first()
        if not admin:
            admin = User(
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                role="admin",
            )
            db.add(admin)
            db.commit()
            log.info("Admin user created: %s", admin_email)
        else:
            log.info("Admin user already exists: %s", admin_email)
    finally:
        db.close()

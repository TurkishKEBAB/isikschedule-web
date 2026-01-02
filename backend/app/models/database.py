"""
Database models for IşıkSchedule.
Uses SQLite with SQLAlchemy ORM.
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database path
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data.db")

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

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
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    saved_schedules = relationship("SavedSchedule", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.email}>"


class SavedSchedule(Base):
    """Saved schedule for a user."""
    __tablename__ = "saved_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    courses_json = Column(Text, nullable=False)  # JSON string of courses
    created_at = Column(DateTime, default=datetime.utcnow)
    share_id = Column(String(64), unique=True, nullable=True)  # For sharing
    
    # Relationships
    user = relationship("User", back_populates="saved_schedules")
    
    def __repr__(self):
        return f"<SavedSchedule {self.name}>"


class GlobalCourse(Base):
    """Global course data uploaded by admin."""
    __tablename__ = "global_courses"
    
    id = Column(Integer, primary_key=True, index=True)
    semester = Column(String(50), nullable=False)  # e.g., "2024-2025-Fall"
    courses_json = Column(Text, nullable=False)  # JSON string of all courses
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
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
    """Create initial admin user if not exists."""
    from ..core.auth import get_password_hash
    
    db = SessionLocal()
    try:
        # Check if admin exists
        admin = db.query(User).filter(User.email == "23soft1040@isik.edu.tr").first()
        if not admin:
            admin = User(
                email="23soft1040@isik.edu.tr",
                password_hash=get_password_hash("yigit12okur1212"),
                role="admin"
            )
            db.add(admin)
            db.commit()
            print("Admin user created: 23soft1040@isik.edu.tr")
        else:
            print("Admin user already exists.")
    finally:
        db.close()

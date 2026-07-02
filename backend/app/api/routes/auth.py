"""
Authentication API routes.
Login, register, and user management.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ...config import CONSENT_VERSION, settings
from ...models.database import _utcnow, Friendship, get_db, GlobalCourse, SavedSchedule, User
from ...core.auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    get_current_user,
    validate_email_domain,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("isikschedule")

DATA_EXPORT_SCHEMA_VERSION = "2026-07-02"


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _json_value(raw_json: str) -> Any:
    try:
        return json.loads(raw_json)
    except json.JSONDecodeError:
        return raw_json


# Request/Response models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    accepted_terms: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: str


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    # Validate email domain
    if not validate_email_domain(request.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email must be from @isik.edu.tr or @isikun.edu.tr"
        )
    
    # Check password length
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    if not request.accepted_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="KVKK aydınlatma metni ve kullanım şartları kabul edilmeden kayıt yapılamaz.",
        )
    
    # Check if user exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        role="user",
        kvkk_consent_at=_utcnow(),
        consent_version=CONSENT_VERSION,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create token
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "role": user.role
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = authenticate_user(db, request.email, request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "role": user.role
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        created_at=current_user.created_at.isoformat()
    )


@router.get("/me/export")
async def export_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export the authenticated user's personal data."""
    saved_schedules = (
        db.query(SavedSchedule)
        .filter(SavedSchedule.user_id == current_user.id)
        .order_by(SavedSchedule.id)
        .all()
    )
    friendships = (
        db.query(Friendship)
        .filter(or_(Friendship.user_id == current_user.id, Friendship.friend_id == current_user.id))
        .order_by(Friendship.id)
        .all()
    )
    uploaded_global_courses = (
        db.query(GlobalCourse)
        .filter(GlobalCourse.uploaded_by == current_user.id)
        .order_by(GlobalCourse.id)
        .all()
    )

    log.info("User data export requested: user_id=%s", current_user.id)

    return {
        "schema_version": DATA_EXPORT_SCHEMA_VERSION,
        "generated_at": _utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "role": current_user.role,
            "is_active": current_user.is_active,
            "created_at": _isoformat(current_user.created_at),
            "kvkk_consent_at": _isoformat(current_user.kvkk_consent_at),
            "consent_version": current_user.consent_version,
        },
        "saved_schedules": [
            {
                "id": schedule.id,
                "name": schedule.name,
                "courses": _json_value(schedule.courses_json),
                "created_at": _isoformat(schedule.created_at),
                "share_id": schedule.share_id,
            }
            for schedule in saved_schedules
        ],
        "friendships": [
            {
                "id": friendship.id,
                "user_id": friendship.user_id,
                "friend_id": friendship.friend_id,
                "counterparty_user_id": friendship.friend_id
                if friendship.user_id == current_user.id
                else friendship.user_id,
                "counterparty_email": friendship.friend.email
                if friendship.user_id == current_user.id
                else friendship.user.email,
                "status": friendship.status,
                "created_at": _isoformat(friendship.created_at),
                "updated_at": _isoformat(friendship.updated_at),
            }
            for friendship in friendships
        ],
        "uploaded_global_courses": [
            {
                "id": course.id,
                "semester": course.semester,
                "uploaded_at": _isoformat(course.uploaded_at),
                "is_active": course.is_active,
            }
            for course in uploaded_global_courses
        ],
    }


@router.delete("/me")
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete the authenticated non-admin user account."""
    if current_user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be self-deleted",
        )

    user_id = current_user.id
    db.delete(current_user)
    db.commit()
    log.info("User account deleted: user_id=%s", user_id)
    return {"message": "Account deleted successfully"}


@router.post("/logout")
async def logout():
    """Logout (client should delete token)."""
    return {"message": "Logged out successfully"}

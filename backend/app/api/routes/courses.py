"""
Courses API routes.
Provides global courses from admin-uploaded Excel.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ...models.database import get_db, GlobalCourse

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("/global")
async def get_global_courses(db: Session = Depends(get_db)):
    """Get courses from the active semester (no auth required)."""
    active_semester = db.query(GlobalCourse).filter(GlobalCourse.is_active == True).first()
    
    if not active_semester:
        raise HTTPException(
            status_code=404,
            detail="No active semester found. Admin needs to upload course data."
        )
    
    courses = json.loads(active_semester.courses_json)
    
    return {
        "semester": active_semester.semester,
        "courses": courses,
        "count": len(courses)
    }


@router.get("/semesters")
async def list_available_semesters(db: Session = Depends(get_db)):
    """List all available semesters (no auth required)."""
    semesters = db.query(GlobalCourse).order_by(GlobalCourse.uploaded_at.desc()).all()
    
    return [
        {
            "id": sem.id,
            "semester": sem.semester,
            "is_active": sem.is_active,
            "uploaded_at": sem.uploaded_at.isoformat()
        }
        for sem in semesters
    ]

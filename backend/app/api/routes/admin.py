"""
Admin API routes.
Global Excel upload and user management.
"""

import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import shutil
from pathlib import Path

from ...models.database import get_db, User, GlobalCourse
from ...core.auth import get_current_admin
from ...core.excel_loader import process_excel

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class SemesterResponse(BaseModel):
    id: int
    semester: str
    course_count: int
    uploaded_at: str
    is_active: bool


class UserListResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: str
    schedules_count: int


class StatsResponse(BaseModel):
    total_users: int
    total_schedules: int
    active_semester: str | None
    total_courses: int


@router.post("/upload-semester")
async def upload_semester(
    semester: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Upload global Excel file for a semester. Only admin can do this."""
    # Validate file
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be Excel (.xlsx or .xls)")
    
    # Save file
    file_path = UPLOAD_DIR / f"global_{semester}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Process Excel
        courses = process_excel(str(file_path))
        
        if not courses:
            raise HTTPException(status_code=400, detail="No courses found in file")
        
        # Deactivate previous semesters
        db.query(GlobalCourse).update({"is_active": False})
        
        # Save to database
        global_course = GlobalCourse(
            semester=semester,
            courses_json=json.dumps(courses, ensure_ascii=False),
            uploaded_by=admin.id,
            is_active=True
        )
        db.add(global_course)
        db.commit()
        db.refresh(global_course)
        
        return {
            "message": f"Successfully uploaded {len(courses)} courses for {semester}",
            "semester": semester,
            "course_count": len(courses),
            "id": global_course.id
        }
        
    except Exception as e:
        # Clean up file on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/semesters", response_model=List[SemesterResponse])
async def list_semesters(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """List all uploaded semesters."""
    semesters = db.query(GlobalCourse).order_by(GlobalCourse.uploaded_at.desc()).all()
    
    result = []
    for sem in semesters:
        courses = json.loads(sem.courses_json)
        result.append(SemesterResponse(
            id=sem.id,
            semester=sem.semester,
            course_count=len(courses),
            uploaded_at=sem.uploaded_at.isoformat(),
            is_active=sem.is_active
        ))
    
    return result


@router.post("/semesters/{semester_id}/activate")
async def activate_semester(
    semester_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Activate a specific semester."""
    semester = db.query(GlobalCourse).filter(GlobalCourse.id == semester_id).first()
    if not semester:
        raise HTTPException(status_code=404, detail="Semester not found")
    
    # Deactivate all
    db.query(GlobalCourse).update({"is_active": False})
    
    # Activate selected
    semester.is_active = True
    db.commit()
    
    return {"message": f"Activated semester: {semester.semester}"}


@router.get("/users", response_model=List[UserListResponse])
async def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """List all users."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    
    result = []
    for user in users:
        result.append(UserListResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            created_at=user.created_at.isoformat(),
            schedules_count=len(user.saved_schedules)
        ))
    
    return result


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Get admin dashboard stats."""
    total_users = db.query(User).count()
    
    from ...models.database import SavedSchedule
    total_schedules = db.query(SavedSchedule).count()
    
    active_semester = db.query(GlobalCourse).filter(GlobalCourse.is_active == True).first()
    
    total_courses = 0
    semester_name = None
    if active_semester:
        courses = json.loads(active_semester.courses_json)
        total_courses = len(courses)
        semester_name = active_semester.semester
    
    return StatsResponse(
        total_users=total_users,
        total_schedules=total_schedules,
        active_semester=semester_name,
        total_courses=total_courses
    )

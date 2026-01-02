"""File upload endpoints."""

import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.core.excel_loader import process_excel

router = APIRouter()


class CoursePreview(BaseModel):
    code: str
    name: str
    ects: int
    teacher: Optional[str] = None
    schedule: str


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    course_count: int
    preview: List[CoursePreview]
    created_at: datetime


@router.post("/upload", response_model=UploadResponse)
async def upload_excel(file: UploadFile = File(...)):
    """
    Upload an Excel file containing course schedule data.
    
    Returns a preview of parsed courses.
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)"
        )
    
    # Validate file size
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB"
        )
    
    # Generate file ID
    file_id = str(uuid.uuid4())
    
    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save file
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}.xlsx")
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Parse Excel and get courses
    try:
        courses = process_excel(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing Excel file: {str(e)}"
        )
    
    # Create preview
    preview = []
    for course in courses[:10]:  # First 10 for preview
        preview.append(CoursePreview(
            code=course["code"],
            name=course["name"],
            ects=course["ects"],
            teacher=course.get("teacher"),
            schedule=course.get("schedule_str", "")
        ))
    
    return UploadResponse(
        file_id=file_id,
        filename=file.filename,
        course_count=len(courses),
        preview=preview,
        created_at=datetime.utcnow(),
    )


@router.get("/upload/{file_id}/courses")
async def get_courses(file_id: str):
    """Get all courses from an uploaded file."""
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}.xlsx")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Parse and return all courses
    try:
        courses = process_excel(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing Excel file: {str(e)}"
        )
    
    # Extract unique faculties and teachers
    faculties = list(set(c.get("faculty", "") for c in courses if c.get("faculty")))
    teachers = list(set(c.get("teacher", "") for c in courses if c.get("teacher")))
    
    return {
        "file_id": file_id,
        "courses": courses,
        "faculties": faculties,
        "teachers": teachers,
    }

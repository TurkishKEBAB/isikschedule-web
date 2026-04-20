"""File upload endpoints."""

import os
import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.core.excel_loader import process_excel

router = APIRouter()

# Matches the UUID4 string form that upload_excel emits. Used to reject
# path-traversal attempts on the {file_id} path parameter.
_FILE_ID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

# Accept only the modern xlsx container (Phase 1.7). Legacy .xls is a
# different binary format and has had exploitable parsers historically.
_ALLOWED_EXTS = {".xlsx"}
_ALLOWED_MIMES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",  # some browsers send this for uploaded xlsx
}


def _resolve_upload_path(file_id: str) -> str:
    """Validate file_id and return the absolute path of its upload.

    Raises 400 if the id doesn't match the UUID4 form we emit, which both
    blocks path traversal (../) and rejects obviously bogus inputs.
    """
    if not _FILE_ID_RE.match(file_id):
        raise HTTPException(status_code=400, detail="Invalid file_id")
    return os.path.join(settings.UPLOAD_DIR, f"{file_id}.xlsx")


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
    # Phase 1.7: extension + MIME allow-list, size enforcement, UUID-only
    # stored filename (never the client-supplied name).
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx)",
        )

    if file.content_type and file.content_type not in _ALLOWED_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Invalid MIME type for Excel upload",
        )

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    file_id = str(uuid.uuid4())
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Filename is our own UUID, never the client-supplied one — path traversal
    # via filename is structurally impossible here.
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
        created_at=datetime.now(timezone.utc),
    )


@router.get("/upload/{file_id}/courses")
async def get_courses(file_id: str):
    """Get all courses from an uploaded file."""
    file_path = _resolve_upload_path(file_id)

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

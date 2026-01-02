"""Schedule viewing and export endpoints."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter()


class CourseSlot(BaseModel):
    day: str
    slot: int
    course_code: str
    course_name: str
    teacher: str
    location: Optional[str] = None


class ScheduleResponse(BaseModel):
    id: str
    score: float
    total_ects: int
    conflict_count: int
    courses: List[CourseSlot]


@router.get("/schedules/{job_id}", response_model=List[ScheduleResponse])
async def get_schedules(job_id: str, limit: int = 10):
    """Get generated schedules for a job."""
    # TODO: Fetch from database
    return []


@router.get("/schedules/{job_id}/{schedule_index}")
async def get_schedule_detail(job_id: str, schedule_index: int):
    """Get detailed view of a specific schedule."""
    # TODO: Fetch specific schedule
    return {
        "id": f"{job_id}_{schedule_index}",
        "score": 85.5,
        "total_ects": 28,
        "conflict_count": 0,
        "courses": [],
        "statistics": {
            "total_hours": 24,
            "free_days": ["Friday"],
            "avg_daily_hours": 4.8,
        }
    }


@router.post("/schedules/{job_id}/{schedule_index}/export")
async def export_schedule(
    job_id: str,
    schedule_index: int,
    format: str = "pdf"  # pdf, ical, xlsx
):
    """Export a schedule in the specified format."""
    if format not in ["pdf", "ical", "xlsx"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid format. Supported: pdf, ical, xlsx"
        )
    
    # TODO: Generate export file
    # TODO: Return file download
    
    return {
        "message": f"Export to {format} started",
        "download_url": f"/api/downloads/{job_id}_{schedule_index}.{format}"
    }


@router.post("/schedules/{job_id}/{schedule_index}/share")
async def share_schedule(job_id: str, schedule_index: int):
    """Generate a shareable link for a schedule."""
    import uuid
    share_code = str(uuid.uuid4())[:8]
    
    return {
        "share_code": share_code,
        "share_url": f"https://isikschedule.com/s/{share_code}",
        "expires_in_days": 7,
    }


@router.get("/shared/{share_code}")
async def get_shared_schedule(share_code: str):
    """Get a schedule by share code."""
    # TODO: Fetch from database by share code
    return {
        "share_code": share_code,
        "schedule": None,
        "expired": False,
    }

"""Schedule viewing and export endpoints."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uuid

from ...models.database import get_db, SavedSchedule

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


class ShareAnonymousRequest(BaseModel):
    courses: list

@router.post("/schedules/share")
async def share_anonymous_schedule(request: ShareAnonymousRequest, db: Session = Depends(get_db)):
    """Generate a shareable link for an anonymous schedule.

    Phase 1.5: anonymous shares have user_id=NULL rather than being pinned
    to the first user in the table.
    """
    import json
    share_id = str(uuid.uuid4())[:16]

    schedule = SavedSchedule(
        user_id=None,
        name="Shared Schedule",
        courses_json=json.dumps(request.dict().get("courses", [])),
        share_id=share_id,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    return {
        "share_code": schedule.share_id,
        "share_url": f"/s/{schedule.share_id}",
    }

@router.post("/schedules/share/{schedule_id}")
async def share_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Generate a shareable link for a saved schedule."""
    schedule = db.query(SavedSchedule).filter(SavedSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if not schedule.share_id:
        schedule.share_id = str(uuid.uuid4())[:16]
        db.commit()
        db.refresh(schedule)
    
    return {
        "share_code": schedule.share_id,
        "share_url": f"/s/{schedule.share_id}"
    }


@router.get("/shared/{share_code}")
async def get_shared_schedule(share_code: str, db: Session = Depends(get_db)):
    """Get a schedule by share code."""
    schedule = db.query(SavedSchedule).filter(SavedSchedule.share_id == share_code).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Shared schedule not found")
        
    return {
        "share_code": share_code,
        "schedule": {
            "id": schedule.id,
            "name": schedule.name,
            "courses_json": schedule.courses_json,
            "created_at": schedule.created_at
        }
    }

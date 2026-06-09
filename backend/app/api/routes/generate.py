# pyright: strict
"""Schedule generation API endpoints."""

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import TypedDict, cast

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.excel_loader import process_excel
from app.models.database import GlobalCourse, SessionLocal
from app.scheduling.solver import (
    CourseData,
    Diagnosis,
    GeneratedSchedule,
    GenerationResult,
    SearchMetadata,
    generate_schedule_result,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class JobResult(TypedDict):
    schedules: list[GeneratedSchedule]
    diagnosis: Diagnosis
    metadata: SearchMetadata


class JobState(TypedDict):
    status: str
    progress: int
    message: str
    result: JobResult | None
    created_at: str


JOBS: dict[str, JobState] = {}


class GenerateRequest(BaseModel):
    file_id: str
    selected_main_codes: list[str]
    algorithm: str = "dfs"
    params: dict[str, object] | None = None


class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str


def generate_result_sync(
    all_courses: list[CourseData],
    selected_main_codes: list[str],
    _algorithm: str,
    params: dict[str, object],
) -> GenerationResult:
    """Generate schedules plus structural diagnosis and search metadata."""
    return generate_schedule_result(all_courses, selected_main_codes, params)


def generate_schedules_sync(
    all_courses: list[CourseData],
    selected_main_codes: list[str],
    algorithm: str,
    params: dict[str, object],
) -> list[GeneratedSchedule]:
    """Backward-compatible list-only wrapper used by existing callers/tests."""
    return generate_result_sync(
        all_courses,
        selected_main_codes,
        algorithm,
        params,
    )["schedules"]


def load_courses_for_generation(file_id: str) -> list[CourseData]:
    """Load courses from an uploaded file or the active global semester."""
    if file_id == "global":
        db = SessionLocal()
        try:
            active_semester = (
                db.query(GlobalCourse)
                .filter(GlobalCourse.is_active.is_(True))
                .first()
            )
            if not active_semester:
                raise HTTPException(
                    status_code=404,
                    detail="No active semester found",
                )
            courses_json = cast(str, active_semester.courses_json)
            return cast(list[CourseData], json.loads(courses_json))
        finally:
            db.close()

    from .upload import _resolve_upload_path  # pyright: ignore[reportPrivateUsage]

    file_path = _resolve_upload_path(file_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        return cast(list[CourseData], process_excel(file_path))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing file: {exc}",
        ) from exc


@router.post("/generate", response_model=JobResponse)
async def start_generation(request: GenerateRequest) -> JobResponse:
    """Run exact bounded schedule generation."""
    if not request.selected_main_codes:
        raise HTTPException(status_code=400, detail="No courses selected")
    if len(request.selected_main_codes) > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 courses allowed")

    all_courses = load_courses_for_generation(request.file_id)
    logger.info(
        "Loaded %s courses for source %s",
        len(all_courses),
        request.file_id,
    )

    job_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    JOBS[job_id] = {
        "status": "processing",
        "progress": 0,
        "message": "Starting generation...",
        "result": None,
        "created_at": created_at,
    }

    try:
        result = generate_result_sync(
            all_courses,
            request.selected_main_codes,
            request.algorithm,
            request.params or {},
        )
        JOBS[job_id] = {
            "status": "completed",
            "progress": 100,
            "message": f"Generated {len(result['schedules'])} schedules",
            "result": result,
            "created_at": created_at,
        }
    except Exception as exc:
        logger.exception("Generation error")
        JOBS[job_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(exc),
            "result": None,
            "created_at": created_at,
        }

    job = JOBS[job_id]
    return JobResponse(
        job_id=job_id,
        status=job["status"],
        message=job["message"],
    )


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str) -> dict[str, object]:
    """Get generation status and its result envelope."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "result": job["result"],
    }


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict[str, str]:
    """Cancel/delete an in-memory job."""
    if job_id in JOBS:
        del JOBS[job_id]
    return {"message": f"Job {job_id} deleted"}

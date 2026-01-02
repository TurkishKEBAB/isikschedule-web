"""Schedule generation endpoints with auto section selection."""

import os
import uuid
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from itertools import product

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.excel_loader import process_excel
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Simple in-memory job store
JOBS: Dict[str, dict] = {}


class GenerateRequest(BaseModel):
    file_id: str
    selected_main_codes: List[str]
    algorithm: str = "dfs"
    params: Optional[Dict] = None


class JobResponse(BaseModel):
    job_id: str
    status: str
    message: str


def has_conflict(schedule1: List, schedule2: List) -> bool:
    """Check if two schedules have time conflicts."""
    slots1 = set(tuple(s) if isinstance(s, list) else s for s in schedule1)
    slots2 = set(tuple(s) if isinstance(s, list) else s for s in schedule2)
    return bool(slots1 & slots2)


def courses_conflict(courses: List[dict]) -> bool:
    """Check if any courses in the list conflict with each other."""
    all_slots = []
    for course in courses:
        schedule = course.get("schedule", [])
        for slot in schedule:
            slot_tuple = tuple(slot) if isinstance(slot, list) else slot
            if slot_tuple in all_slots:
                return True
            all_slots.append(slot_tuple)
    return False


def count_conflicts(courses: List[dict]) -> int:
    """Count the number of time slot conflicts in a course list."""
    all_slots = []
    conflicts = 0
    for course in courses:
        schedule = course.get("schedule", [])
        for slot in schedule:
            slot_tuple = tuple(slot) if isinstance(slot, list) else slot
            if slot_tuple in all_slots:
                conflicts += 1
            else:
                all_slots.append(slot_tuple)
    return conflicts


def generate_schedules_sync(
    all_courses: List[dict],
    selected_main_codes: List[str],
    algorithm: str,
    params: dict
) -> List[dict]:
    """
    Generate schedules by:
    1. Grouping courses by main_code
    2. Finding all valid combinations of sections
    3. Returning conflict-free schedules that cover ALL selected courses
    """
    max_ects = params.get("max_ects", 45) if params else 45
    max_conflicts = params.get("max_conflicts", 0) if params else 0
    
    logger.info(f"Generating schedules for: {selected_main_codes}")
    logger.info(f"Max ECTS: {max_ects}, Max Conflicts: {max_conflicts}")
    
    # Normalize main codes to uppercase for comparison
    selected_main_codes_upper = [mc.upper() for mc in selected_main_codes]
    
    # Group courses by main_code
    course_groups: Dict[str, Dict[str, List[dict]]] = {}
    for course in all_courses:
        main_code = course["main_code"].upper()
        if main_code not in selected_main_codes_upper:
            continue
            
        if main_code not in course_groups:
            course_groups[main_code] = {"lecture": [], "lab": [], "ps": []}
        
        course_type = course.get("type", "lecture")
        course_groups[main_code][course_type].append(course)
    
    logger.info(f"Found course groups: {list(course_groups.keys())}")
    for mc, types in course_groups.items():
        logger.info(f"  {mc}: lectures={len(types['lecture'])}, labs={len(types['lab'])}, ps={len(types['ps'])}")
    
    def get_course_options(main_code: str) -> List[List[dict]]:
        """Get all possible section combinations for a course."""
        group = course_groups.get(main_code, {})
        lectures = group.get("lecture", [])
        labs = group.get("lab", [])
        ps_sections = group.get("ps", [])
        
        options = []
        
        # If no lectures, check for lab-only or PS-only
        if not lectures:
            if labs:
                for lab in labs:
                    options.append([lab])
            elif ps_sections:
                for ps in ps_sections:
                    options.append([ps])
            return options
        
        # For each lecture section
        for lecture in lectures:
            if not labs and not ps_sections:
                options.append([lecture])
            elif labs and not ps_sections:
                for lab in labs:
                    options.append([lecture, lab])
                # Also allow lecture-only if lab sections don't fit
                options.append([lecture])
            elif ps_sections and not labs:
                for ps in ps_sections:
                    options.append([lecture, ps])
                options.append([lecture])
            else:
                # Both lab and ps exist
                for lab in labs:
                    for ps in ps_sections:
                        options.append([lecture, lab, ps])
                # Also try combinations without lab or ps
                for lab in labs:
                    options.append([lecture, lab])
                for ps in ps_sections:
                    options.append([lecture, ps])
                options.append([lecture])
        
        return options
    
    # Get options for each selected main course
    main_codes_found = list(course_groups.keys())
    
    if not main_codes_found:
        logger.warning("No matching courses found in the Excel file")
        return []
    
    all_options = [(mc, get_course_options(mc)) for mc in main_codes_found]
    all_options = [(mc, opts) for mc, opts in all_options if opts]
    
    logger.info(f"Course options: {[(mc, len(opts)) for mc, opts in all_options]}")
    
    if not all_options:
        return []
    
    # Generate all possible combinations using itertools.product
    # This ensures we try ALL courses, not skip any
    option_lists = [opts for _, opts in all_options]
    
    valid_schedules = []
    
    # Use product to get all combinations
    for combination in product(*option_lists):
        # Flatten the combination
        all_selected = []
        for course_set in combination:
            all_selected.extend(course_set)
        
        # Check total ECTS
        total_ects = sum(c.get("ects", 0) for c in all_selected)
        if total_ects > max_ects:
            continue
        
        # Check for conflicts (allow up to max_conflicts)
        conflict_count = count_conflicts(all_selected)
        if conflict_count > max_conflicts:
            continue
        
        # Valid schedule found!
        valid_schedules.append((all_selected, conflict_count))
        
        if len(valid_schedules) >= 100:  # Limit
            break
    
    logger.info(f"Found {len(valid_schedules)} valid schedules")
    
    # Convert to response format with scores
    schedules = []
    for idx, (courses_list, conflict_count) in enumerate(valid_schedules):
        total_ects = sum(c.get("ects", 0) for c in courses_list)
        main_codes_covered = len(set(c.get("main_code", "").upper() for c in courses_list))
        
        # Score: prioritize less conflicts, then more courses, then higher ECTS
        score = (10 - conflict_count) * 50 + main_codes_covered * 20 + total_ects
        
        schedules.append({
            "id": str(idx + 1),
            "score": score,
            "total_ects": total_ects,
            "conflict_count": conflict_count,
            "course_count": main_codes_covered,
            "courses": courses_list
        })
    
    # Sort by score
    schedules.sort(key=lambda x: x["score"], reverse=True)
    
    return schedules[:20]


@router.post("/generate", response_model=JobResponse)
async def start_generation(request: GenerateRequest):
    """Start schedule generation with auto section selection."""
    if not request.selected_main_codes:
        raise HTTPException(status_code=400, detail="No courses selected")
    
    if len(request.selected_main_codes) > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 courses allowed")
    
    # Load courses from file
    file_path = os.path.join(settings.UPLOAD_DIR, f"{request.file_id}.xlsx")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        all_courses = process_excel(file_path)
        logger.info(f"Loaded {len(all_courses)} courses from Excel")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {e}")
    
    job_id = str(uuid.uuid4())
    
    JOBS[job_id] = {
        "status": "processing",
        "progress": 0,
        "message": "Starting generation...",
        "result": None,
        "created_at": datetime.utcnow().isoformat()
    }
    
    try:
        schedules = generate_schedules_sync(
            all_courses,
            request.selected_main_codes,
            request.algorithm,
            request.params or {}
        )
        
        JOBS[job_id] = {
            "status": "completed",
            "progress": 100,
            "message": f"Generated {len(schedules)} schedules",
            "result": {"schedules": schedules},
            "created_at": JOBS[job_id]["created_at"]
        }
    except Exception as e:
        logger.error(f"Generation error: {e}")
        JOBS[job_id] = {
            "status": "failed",
            "progress": 0,
            "message": str(e),
            "result": None,
            "created_at": JOBS[job_id]["created_at"]
        }
    
    return JobResponse(
        job_id=job_id,
        status=JOBS[job_id]["status"],
        message=JOBS[job_id]["message"],
    )


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a generation job."""
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
async def cancel_job(job_id: str):
    """Cancel/delete a job."""
    if job_id in JOBS:
        del JOBS[job_id]
    return {"message": f"Job {job_id} deleted"}

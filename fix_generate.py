import re

file_path = r"c:\Develop\Projects\isikschedule-web\backend\app\api\routes\generate.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace start_generation and add run_job
new_code = """from fastapi import BackgroundTasks

def run_job(job_id: str, all_courses, selected_main_codes, algorithm, params):
    try:
        result = generate_result_sync(all_courses, selected_main_codes, algorithm, params)
        JOBS[job_id]["status"] = "completed"
        JOBS[job_id]["progress"] = 100
        JOBS[job_id]["message"] = f"Generated {len(result['schedules'])} schedules"
        JOBS[job_id]["result"] = result
    except Exception as exc:
        logger.exception("Generation error")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["message"] = str(exc)

@router.post("/generate", response_model=JobResponse)
async def start_generation(request: GenerateRequest, background_tasks: BackgroundTasks) -> JobResponse:
    \"\"\"Run exact bounded schedule generation.\"\"\"
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

    background_tasks.add_task(
        run_job,
        job_id,
        all_courses,
        request.selected_main_codes,
        request.algorithm,
        request.params or {},
    )

    job = JOBS[job_id]
    return JobResponse(
        job_id=job_id,
        status=job["status"],
        message=job["message"],
    )
"""

content = re.sub(
    r"@router\.post\(\"/generate\".*?return JobResponse\([^)]+\)",
    new_code,
    content,
    flags=re.DOTALL
)

# Fix imports to ensure BackgroundTasks is there
if "BackgroundTasks" not in content:
    content = content.replace("from fastapi import APIRouter, HTTPException", "from fastapi import APIRouter, HTTPException, BackgroundTasks")
else:
    # Remove the duplicate import from our new_code if it was already inserted
    content = content.replace("from fastapi import BackgroundTasks\n\ndef run_job", "def run_job")

# Cleanup jobs older than 1 hour when checking status to avoid memory leak
status_code = """@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str) -> dict[str, object]:
    \"\"\"Get generation status and its result envelope.\"\"\"
    # Memory leak prevention: delete old jobs (>1 hr)
    now = datetime.now(timezone.utc)
    to_delete = []
    for jid, jstate in JOBS.items():
        try:
            j_time = datetime.fromisoformat(jstate["created_at"])
            if (now - j_time).total_seconds() > 3600:
                to_delete.append(jid)
        except Exception:
            pass
    for jid in to_delete:
        del JOBS[jid]

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
"""

content = re.sub(
    r"@router\.get\(\"/jobs/\{job_id\}\"\).*?return \{.*?\}",
    status_code,
    content,
    flags=re.DOTALL
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("generate.py patched successfully.")

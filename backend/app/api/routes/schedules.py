"""Schedule sharing endpoints.

Generation results are served from the in-memory JOBS store via `/api/jobs/{job_id}`
(see `generate.py`) and exports happen client-side (`frontend/app/lib/scheduleExport.ts`),
so this module only owns the persistent share/shared-link endpoints.
"""

import secrets

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ...models.database import get_db, SavedSchedule

router = APIRouter()


class ShareAnonymousRequest(BaseModel):
    courses: list

@router.post("/schedules/share")
async def share_anonymous_schedule(request: ShareAnonymousRequest, db: Session = Depends(get_db)):
    """Generate a shareable link for an anonymous schedule.

    Phase 1.5: anonymous shares have user_id=NULL rather than being pinned
    to the first user in the table.
    """
    import json
    # A7: unguessable share code (the /shared/{code} read is public).
    share_id = secrets.token_urlsafe(16)

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

# NOTE: A1 (IDOR) — the former `POST /schedules/share/{schedule_id}` endpoint
# was removed. It looked up any saved schedule by its incrementing integer id
# with no authentication or ownership check, letting an attacker enumerate ids
# and mint share codes for other users' schedules. The frontend never used it
# (it shares anonymously via `POST /schedules/share`). If owner-scoped sharing
# is needed later, reintroduce it with Depends(get_current_user) + an
# ownership filter (schedule.user_id == current_user.id).


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

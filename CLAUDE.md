# Claude Guide for IsikSchedule

## Mission

Work as a careful code agent inside this repo. Make the smallest change that solves the task, keep frontend and backend in sync, and avoid refactoring large files unless the task truly requires it.

## Start here

1. Read `README.md` for the intended product direction.
2. Inspect the actual runtime entrypoints:
   - `backend/app/main.py`
   - `backend/app/api/routes/`
   - `frontend/app/scheduler/page.tsx`
3. Check `git status --short` before editing because this repo may already be dirty.

## How the app works

- Users upload an Excel file from `frontend/app/upload/page.tsx`.
- The backend stores the file and parses courses in `backend/app/api/routes/upload.py`.
- The scheduler UI in `frontend/app/scheduler/page.tsx` loads either uploaded courses or global semester data.
- Schedule generation happens via `backend/app/api/routes/generate.py`.
- Export helpers live on the frontend in `frontend/app/lib/scheduleExport.ts`.

## Commands

```powershell
# from repo root
.\start-dev.bat

# backend only
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# frontend only
cd frontend
npm run dev
```

First-time setup:

```powershell
pip install -r backend\requirements.txt
cd frontend
npm install
```

## Things to watch closely

- `frontend/app/lib/api.ts` points to `http://localhost:8000` by default.
- `backend/app/models/database.py` currently defaults to SQLite (`data.db`), even though other docs/config still mention PostgreSQL.
- `backend/app/api/routes/generate.py` uses an in-memory `JOBS` store, so job state is not persistent.
- `backend/app/api/routes/schedules.py` still contains TODO and placeholder behavior in some endpoints.
- The scheduler page is a large client component with many state interactions, so broad edits can cause regressions quickly.

## Preferred working style

- Trace the full flow before editing: frontend trigger, API call, backend route, response shape, UI state update.
- Make minimal edits with clear intent.
- Keep API contracts explicit and consistent.
- Do not silently change naming conventions for course fields like `main_code`, `type`, `schedule`, or `ects`.
- If you find a mismatch between docs and code, trust the code and mention the mismatch in your summary.

## When changing frontend code

- Preserve existing Tailwind utility patterns unless there is a reason to standardize a section.
- Avoid unnecessary state rewrites in `frontend/app/scheduler/page.tsx`.
- Reuse helpers in `frontend/app/lib/` before introducing new utility files.

## When changing backend code

- Prefer route-level fixes that preserve current response structures unless coordinated frontend changes are included.
- Keep exceptions user-readable on known validation paths.
- Be careful with file paths under `uploads/` and any logic that depends on `file_id`.

## Finish checklist

- Check whether the edited flow touches both frontend and backend.
- Review for accidental changes outside the task.
- Mention any untested areas or known follow-up risks.

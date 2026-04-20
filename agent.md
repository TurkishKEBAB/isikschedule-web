# Agent Guide for IsikSchedule

## What this repo is

IsikSchedule is a full-stack university course scheduling app.

- Backend: FastAPI in `backend/app`
- Frontend: Next.js App Router in `frontend/app`
- Upload flow: Excel files are uploaded, parsed, and then used to build schedules
- Local storage: uploaded files live in `uploads/`

## Repo map

- `backend/app/main.py`: FastAPI app setup and router registration
- `backend/app/api/routes/upload.py`: upload Excel files and return parsed course data
- `backend/app/api/routes/generate.py`: generate schedule combinations
- `backend/app/api/routes/schedules.py`: schedule detail, export, and sharing endpoints
- `backend/app/models/database.py`: SQLAlchemy models and DB bootstrap
- `frontend/app/upload/page.tsx`: upload screen
- `frontend/app/scheduler/page.tsx`: main scheduler UI
- `frontend/app/lib/api.ts`: frontend API base URL
- `frontend/app/lib/scheduleExport.ts`: ICS export and schedule statistics

## Local development

Preferred Windows startup:

```powershell
.\start-dev.bat
```

Manual startup:

```powershell
# backend
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# frontend
cd frontend
npm run dev
```

Useful install commands:

```powershell
pip install -r backend\requirements.txt
cd frontend
npm install
```

## Important project realities

- The frontend defaults to `http://localhost:8000` through `frontend/app/lib/api.ts`.
- README mentions PostgreSQL and Redis, but current local model bootstrap in `backend/app/models/database.py` defaults to SQLite at `data.db`.
- `backend/app/config.py` still exposes a PostgreSQL-style `DATABASE_URL`, so be careful when changing persistence code.
- Schedule generation currently runs synchronously and stores jobs in the in-memory `JOBS` dictionary in `backend/app/api/routes/generate.py`.
- Some schedule endpoints are placeholders or partial implementations, especially in `backend/app/api/routes/schedules.py`.

## Editing guidelines

- Keep changes focused and do not rewrite unrelated parts of the repo.
- Preserve the existing stack: FastAPI on the backend, Next.js + React + Tailwind on the frontend.
- Follow existing naming and file placement patterns before introducing new abstractions.
- Prefer fixing root causes over adding one-off workarounds.
- Keep user-facing behavior consistent across upload, scheduler, and results flows.
- Avoid changing API shapes unless the matching frontend/backend call sites are updated together.

## Frontend notes

- The scheduler page is large and stateful. Make surgical edits instead of broad refactors unless necessary.
- State is persisted with `schedulerStorage` helpers and restored on page load.
- Export features are currently client-side in `scheduleExport.ts`.
- UI copy is mixed, with many Turkish user-facing strings. Match the surrounding file style when editing.

## Backend notes

- Uploaded Excel files are saved to `uploads/<file_id>.xlsx`.
- Course parsing is handled by `app.core.excel_loader.process_excel`.
- Generation groups courses by `main_code` and builds lecture/lab/ps combinations.
- Sharing currently depends on `SavedSchedule.share_id`.
- Startup creates DB tables and also auto-creates an admin user in `create_admin_user()`.

## Safety checks before finishing work

- If you change frontend behavior, sanity-check the matching backend route.
- If you change backend response shapes, inspect the consuming frontend page before finishing.
- If you touch scheduling logic, verify `main_code`, `type`, `ects`, and `schedule` assumptions still hold.
- Call out any config mismatch you did not resolve, especially around database usage.

## Good first commands for exploration

```powershell
rg --files
rg -n "APIRouter|fetch\\(|useState|JOBS|process_excel" backend frontend
git status --short
```

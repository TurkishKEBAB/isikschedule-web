# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mission

Work as a careful code agent inside this repo. Make the smallest change that solves the task, keep frontend and backend in sync, and avoid refactoring large files unless the task truly requires it.

## Start here

1. Read `README.md` for the intended product direction — but trust the code over the docs (see "Docs vs. reality" below).
2. Read `MAINTENANCE_PLAN.md` — it is the authoritative, phased roadmap with resolved decisions (K1–K7) and a live progress tracker. Phase 1 (security/consistency) is complete; Phase 2 (generate/share architecture) is next.
3. Inspect the actual runtime entrypoints:
   - `backend/app/main.py` (app wiring, routers, CORS, global exception handler)
   - `backend/app/api/routes/`
   - `frontend/app/scheduler/page.tsx`
4. Check `git status --short` before editing because this repo may already be dirty.

## Commands

```powershell
# Run both frontend + backend (from repo root)
.\start-dev.bat        # .\stop-dev.bat to stop

# Backend only (FastAPI on :8000, docs at /docs)
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Frontend only (Next.js on :3000)
cd frontend
npm run dev
```

Tests and lint:

```powershell
# Backend smoke suite (pytest, in-memory SQLite, no real data.db touched)
cd backend
..\.venv\Scripts\python.exe -m pytest            # all tests
..\.venv\Scripts\python.exe -m pytest tests/test_auth_smoke.py            # one file
..\.venv\Scripts\python.exe -m pytest tests/test_auth_smoke.py::test_name # one test

# Backend lint (ruff is the chosen linter/formatter)
..\.venv\Scripts\python.exe -m ruff check .

# Frontend lint
cd frontend
npm run lint
npm run build   # type-check + production build
```

First-time setup:

```powershell
pip install -r backend\requirements.txt
cd frontend
npm install
```

## Architecture

### Stack (actual, not what README claims)

- **Backend:** FastAPI + SQLAlchemy + **SQLite** (`backend/data.db`). Python 3.12.
- **Frontend:** Next.js 14 App Router, React 18, TypeScript, TailwindCSS. State via React context + `zustand`; data via `@tanstack/react-query` and `axios`.
- **No Redis/Celery/PostgreSQL despite README/docker-compose.** Schedule generation is synchronous (see below). Decision K1 in `MAINTENANCE_PLAN.md` makes sync-first official.

### Core flow

1. User uploads an `.xlsx` from `frontend/app/upload/page.tsx`.
2. `backend/app/api/routes/upload.py` validates and stores the file under `uploads/` (UUID `file_id`) and parses it via `backend/app/core/excel_loader.py`.
3. `frontend/app/scheduler/page.tsx` loads either uploaded courses or the active global semester, and the user picks `main_code`s.
4. `backend/app/api/routes/generate.py` takes selected `main_code`s and builds conflict-free combinations with `itertools.product` (capped by `MAX_SCHEDULES_PER_JOB`). It is `async def` but computes synchronously and returns in the same request ("fake async"); results live in an **in-memory `JOBS` dict** (not persistent — restart loses them). Reworking this is Phase 2.1.
5. Export to PDF/iCal happens **client-side** in `frontend/app/lib/scheduleExport.ts`.

### Routers (`backend/app/main.py`)

`health`, `auth`, `admin`, `courses` are mounted at root; `upload`, `generate`, `schedules`, `friends` are mounted under `/api`. There is a global exception handler that logs the traceback and returns a stable `{error, message}` JSON shape (K6 — response shapes must stay stable).

### Domain models — two distinct layers, don't confuse them

- **`backend/app/core/models.py`** — in-memory dataclasses for the scheduling logic: `Course`, `Schedule`, `CourseGroup`, `Grade`, `Transcript`. `Course.from_dict`/`to_dict` is the JSON boundary; note the field-name asymmetry — internal `course_type` serializes to `type`, `ects` may arrive as `credit`/`ECTS`, `has_lecture` ↔ `hasLecture`. Courses are grouped by `main_code` (lecture + ps + lab sections of the same course).
- **`backend/app/models/database.py`** — SQLAlchemy ORM persistence: `User`, `SavedSchedule`, `Friendship`, `GlobalCourse`. `SavedSchedule.user_id` is **nullable** (anonymous shares have no owner — filter `user_id IS NOT NULL` for a user's own list). No migration tool yet (`create_all()` only), so schema changes to an existing `data.db` need manual handling.

### Config & auth

- `backend/app/config.py` — pydantic-settings, single source of truth, loaded from `.env`. Defaults are dev-friendly SQLite; a `model_validator` **refuses to boot in production** if `SECRET_KEY` or admin creds are left at defaults.
- JWT auth (`backend/app/core/auth.py`) reads its secret/algorithm/expiry from `settings`. An admin user is bootstrapped on startup from `settings.ADMIN_EMAIL/ADMIN_PASSWORD`.

## Docs vs. reality

The README and `docker-compose.yml` describe an aspirational PostgreSQL + Redis + Celery + multi-algorithm stack. The running app is SQLite + synchronous generation, and the `algorithm` request param is currently ignored. When docs and code disagree, **trust the code and call out the mismatch** in your summary. `MAINTENANCE_PLAN.md` tracks the plan to reconcile these.

## Things to watch closely

- `frontend/app/lib/api.ts` only exports `API_BASE_URL` (defaults to `http://localhost:8000`); there is no central client yet, so most pages do their own `fetch`/`axios`.
- `backend/app/api/routes/schedules.py` still has TODO/placeholder behavior in some endpoints.
- `frontend/app/scheduler/page.tsx` (~2000 lines) and `results/page.tsx` are large client components with heavy state; broad edits regress easily.
- `frontend/app/context/LanguageContext.tsx` holds inline tr/en translations.

## Preferred working style

- Trace the full flow before editing: frontend trigger → API call → backend route → response shape → UI state update.
- Make minimal edits with clear intent. Keep API contracts explicit and consistent.
- Do not silently change naming conventions for course fields like `main_code`, `type`, `schedule`, or `ects`.
- Keep the backend smoke suite green; it is the regression net for security/contract changes.

### When changing frontend code

- Preserve existing Tailwind utility patterns unless there is a reason to standardize a section.
- Avoid unnecessary state rewrites in `frontend/app/scheduler/page.tsx`.
- Reuse helpers in `frontend/app/lib/` before introducing new utility files.

### When changing backend code

- Prefer route-level fixes that preserve current response structures unless coordinated frontend changes are included (K6).
- Keep exceptions user-readable on known validation paths.
- Be careful with file paths under `uploads/` and any logic that depends on `file_id`.

## Finish checklist

- Check whether the edited flow touches both frontend and backend.
- Run the backend smoke suite if you touched backend logic.
- Review for accidental changes outside the task.
- Mention any untested areas or known follow-up risks, and any docs/code mismatches you noticed.

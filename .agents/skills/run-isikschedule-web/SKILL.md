---
name: run-isikschedule-web
description: Build, run, drive, and screenshot the IşıkSchedule web app (FastAPI backend + Next.js frontend). Use when asked to start the app, launch the backend or frontend, log in, take a screenshot of a page (login/scheduler/admin), smoke-test the API, or confirm a change works in the running app.
---

IşıkSchedule is a course-scheduling web app: a **FastAPI backend** (`:8000`) and a
**Next.js 14 frontend** (`:3000`). There is no `chromium-cli`/Playwright here, so the
harness is a committed zero-dependency Node driver,
`.Codex/skills/run-isikschedule-web/driver.mjs`, that smoke-tests the API over
`fetch` and drives the frontend through an **already-installed Chrome** over the
DevTools Protocol (screenshots + a real login flow).

All paths below are relative to the repo root (`C:\Develop\Projects\isikschedule-web`).
Commands are written for the **Bash tool (git-bash)**, which is what was used to verify
them; a PowerShell note is called out where it matters (the backend env var).

## Prerequisites

- **Node 18+** for `fetch`, **Node 21+** for the global `WebSocket` the driver uses
  (verified on Node v24). `node --version`.
- **Python venv** already present at `.venv` (it is actually **Python 3.14**, not 3.12
  as the docs claim — see Gotchas).
- **Chrome or Edge installed** (the driver auto-detects
  `C:/Program Files/Google/Chrome/Application/chrome.exe`, falls back to Edge; override
  with `CHROME=/path/to/chrome.exe`).

First-time setup only (deps are already vendored here — `node_modules` and `.venv`
exist, so you can usually skip this):

```bash
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cd frontend && npm install
```

## Run (agent path)

Three steps: launch the backend (background), launch the frontend (background), then run
the driver. **Launch the two servers in the background** (Bash tool `run_in_background: true`,
or append ` &`); run everything else in the foreground.

**1. Backend — `PYTHONUTF8=1` is mandatory** (without it the emoji startup banner crashes
under Windows cp1252 when stdout is a pipe; see Gotchas):

```bash
cd backend && PYTHONUTF8=1 ../.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000 --host 127.0.0.1
```

PowerShell equivalent of the env var: `$env:PYTHONUTF8=1; ..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`

**2. Frontend:**

```bash
cd frontend && npm run dev
```

**3. Wait for both to be ready, then drive** (poll — don't sleep). The `api`, `login`,
and `smoke` commands log in as the admin, so **set `ADMIN_EMAIL` and `ADMIN_PASSWORD`
first** — nothing is hardcoded (this repo is public). Use the admin account the backend
bootstraps from its `ADMIN_EMAIL`/`ADMIN_PASSWORD` config (or `backend/.env`):

```bash
curl --retry 30 --retry-delay 1 --retry-connrefused -sf http://127.0.0.1:8000/health
curl --retry 30 --retry-delay 1 --retry-connrefused -sf -o /dev/null http://localhost:3000
ADMIN_EMAIL=admin@isik.edu.tr ADMIN_PASSWORD='your-admin-password' node .Codex/skills/run-isikschedule-web/driver.mjs smoke
```

PowerShell: `$env:ADMIN_EMAIL='admin@isik.edu.tr'; $env:ADMIN_PASSWORD='your-admin-password'; node .Codex\skills\run-isikschedule-web\driver.mjs smoke`

`smoke` exits 0 only if every backend check passes and the login flow reaches the
dashboard. Expected output ends with `screenshots in: <dir>` and four PNGs.

| command | what it does |
|---|---|
| `node .../driver.mjs api` | Backend-only smoke over `fetch`: `/health`, `/`, admin `login`, `/me`, `/api/courses/global` (200 or 404). No browser. |
| `node .../driver.mjs shot <url> <out.png>` | Headless-Chrome screenshot of any URL. |
| `node .../driver.mjs login [out.png]` | Fills the `/login` form, submits, follows the redirect, screenshots the dashboard. |
| `node .../driver.mjs smoke` | `api` + landing + scheduler + login flow. The full run. |

`api`, `login`, and `smoke` require `ADMIN_EMAIL`/`ADMIN_PASSWORD` in the environment and
error out if unset; `shot` does not need them.

Screenshots land in the OS temp dir — **Windows: `%TEMP%\isik-screens\`**
(`C:\Users\<you>\AppData\Local\Temp\isik-screens\`). The driver prints each absolute path.
`smoke` writes `landing.png`, `scheduler.png`, `login-filled.png`, `after-login.png`.

**Credentials:** none are baked into this skill (the repo is public). The driver reads
`ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment for the login-based commands and fails
loudly when they are missing. Note the matching defaults still live in `backend/app/config.py`
(product code, out of scope here) — rotate/override them there if that exposure matters.

To stop the servers (PowerShell, by port — git-bash mangles `taskkill /F /PID` flags):

```powershell
Get-NetTCPConnection -LocalPort 8000,3000 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Run (human path)

`start-dev.bat` opens two `cmd` windows (backend + frontend) and then the browser at
`/login`; `stop-dev.bat` kills both ports. Fine for a human at the machine; the agent path
above is better for scripted/headless use because it captures output and fails loudly.

## Test

Backend smoke suite — the regression net for the API:

```bash
cd backend && ../.venv/Scripts/python.exe -m pytest -q
```

Expected: `11 passed` (in-memory SQLite; does not touch `data.db`). pytest does **not**
need `PYTHONUTF8` — its output capture handles the emoji that crashes uvicorn.

Frontend: `npm run dev` is the working path (used above). Two caveats in the current repo,
both verified this session:

- **`npm run build` fails** — `/configure`, `/results`, and `/scheduler` error during
  static prerender with *"useSearchParams() should be wrapped in a suspense boundary"*.
  The dev server is unaffected; only the production export breaks.
- **`npm run lint` is unconfigured** — it prompts *"How would you like to configure
  ESLint?"* and cancels on non-interactive stdin, so it is not agent-safe as-is.

## Gotchas

- **Backend crashes on startup with `UnicodeEncodeError: '\U0001f680'`** when run with
  piped/redirected stdout (background tasks, CI). `main.py`'s lifespan `print("🚀 …")`
  can't encode under the cp1252 console codec. → Always launch the backend with
  `PYTHONUTF8=1`. (A real console works without it; a pipe does not.)
- **`.venv` is Python 3.14**, not 3.12 (README/AGENTS.md say 3.12). The tracebacks show
  `pythoncore-3.14-64`. It works fine — just don't trust the version in the docs.
- **`GET /api/courses/global` returns 404 on a fresh DB** — that's the healthy empty
  state (no admin has uploaded a semester). The scheduler page then shows an
  "upload Excel" modal. The driver treats 200 and 404 as pass.
- **Protected pages (`/admin`) render blank after a soft login redirect.** The standalone
  `/login` page writes `localStorage` directly and `router.replace`s, but `AuthProvider`
  only reads `localStorage` on its initial mount, so `RequireAuth` still sees `user = null`
  and returns `null` (blank). → After login, do a **full-page navigate** to the protected
  route so the provider re-mounts and reads the token. The driver's `login` flow already
  does this; a blank `/admin` screenshot is this bug, not a crash.
- **React-controlled inputs ignore `el.value = '…'`.** Setting `.value` doesn't fire
  React's `onChange`, so form state stays empty and submit posts blanks. The driver sets
  the value through the native `HTMLInputElement.prototype` setter, then dispatches a
  bubbling `input` event.
- **Next.js dev compiles each route on first navigation** — the first hit to `/scheduler`
  or `/admin` can take many seconds. The driver waits for real page text (up to 45s),
  never a fixed sleep. A blank shot usually means you screenshotted too early.
- **Docs describe a stack that isn't running.** README/`docker-compose.yml` claim
  PostgreSQL + Redis + Celery + multiple algorithms; the app is SQLite + synchronous
  generation and the `algorithm` param is ignored. Trust the code.

## Troubleshooting

- **`UnicodeEncodeError ... '\U0001f680'` / backend exits immediately**: missing UTF-8.
  Relaunch with `PYTHONUTF8=1` (see Gotchas).
- **`DRIVER ERROR ... ECONNREFUSED`**: a server isn't up. Confirm
  `curl http://127.0.0.1:8000/health` and `curl http://localhost:3000` both answer.
- **`Chrome/Edge not found`**: set `CHROME=/path/to/chrome.exe` (or `msedge.exe`).
- **`EADDRINUSE` / port already in use**: stop the old servers (the PowerShell stop
  command above, or `stop-dev.bat`) before relaunching.
- **libuv `UV_HANDLE_CLOSING` assertion on exit**: a Node-on-Windows crash when
  `process.exit()` runs with live keep-alive sockets. The driver avoids it by closing the
  undici dispatcher and letting the loop drain instead of hard-exiting — keep that pattern
  if you extend it.

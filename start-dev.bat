@echo off
title IşıkSchedule - Development Server
echo.
echo ========================================
echo   IşıkSchedule Development Server
echo ========================================
echo.

:: Check if ports are in use and kill them
echo [1/3] Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul

:: Start Backend
echo.
echo [2/3] Starting Backend (FastAPI on port 8000)...
cd /d "%~dp0backend"
start "IşıkSchedule Backend" cmd /k "py -m uvicorn app.main:app --reload --port 8000"

:: Wait a bit for backend to start
timeout /t 3 /nobreak > nul

:: Start Frontend
echo.
echo [3/3] Starting Frontend (Next.js on port 3000)...
cd /d "%~dp0frontend"
start "IşıkSchedule Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   Servers Started Successfully!
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Press any key to open frontend...
pause > nul

start http://localhost:3000/login

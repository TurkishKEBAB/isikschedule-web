@echo off
title IşıkSchedule - Stop Servers
echo.
echo Stopping all IşıkSchedule servers...

:: Kill backend (port 8000)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do taskkill /F /PID %%a 2>nul

:: Kill frontend (port 3000)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a 2>nul

echo.
echo All servers stopped!
timeout /t 2

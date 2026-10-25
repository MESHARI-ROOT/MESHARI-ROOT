@echo off
cd /d "%~dp0"
if not exist .env (
  echo Run Setup-Admin.cmd first.
  pause
  exit /b 1
)
call npx netlify login
if errorlevel 1 goto end
call npx netlify link
if errorlevel 1 goto end
call npx netlify env:import .env
if errorlevel 1 goto end
call npm run deploy
:end
pause

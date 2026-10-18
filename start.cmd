@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 LTS, then run start.cmd again.
  exit /b 1
)
if not exist ".env" (
  echo Local configuration is missing. See README.md.
  exit /b 1
)
if not exist "node_modules\" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
echo.
echo DHA Multan Building Control
call npm.cmd run dev
if errorlevel 1 (
  echo.
  echo Startup failed. Read the message above before trying again.
  exit /b 1
)

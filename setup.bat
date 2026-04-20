@echo off
title HbgBuss 3D - Setup
cd /d "%~dp0"

echo.
echo  Installerar paket (npm install)...
call npm install
if errorlevel 1 (
  echo FEL: npm install misslyckades. Ar Node.js installerat?
  pause
  exit /b 1
)

echo.
echo  Setup klar!
echo  Dubbelklicka pa start.bat for att starta appen.
echo.
pause

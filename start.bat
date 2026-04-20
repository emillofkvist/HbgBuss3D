@echo off
title HbgBuss 3D
cd /d "%~dp0"

echo Startar HbgBuss 3D...
start /B npm run dev

echo Vantar pa servern...
timeout /t 4 /nobreak > nul

start http://localhost:5173
echo.
echo Servern koer pa http://localhost:5173
echo Stang detta fonster for att stoppa servern.
npm run dev

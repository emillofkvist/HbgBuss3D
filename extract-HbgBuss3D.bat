@echo off
title Extrahera HbgBuss3D
setlocal

set "SRC=%~dp0HbgBuss3D"
set "DST=%USERPROFILE%\Claude\HbgBuss3D"

echo.
echo Kopierar HbgBuss3D till: %DST%
echo.

robocopy "%SRC%" "%DST%" /E /XD node_modules dist .git /XF .env.local /NFL /NDL /NJH

echo.
echo Skapar tom .env.local (fyll i dina nycklar)...
if not exist "%DST%\.env.local" (
  (
    echo VITE_MAPTILER_KEY=DIN_MAPTILER_NYCKEL
    echo VITE_TRAFIKLAB_KEY=DIN_TRAFIKLAB_RT_NYCKEL
    echo VITE_TRAFIKLAB_STATIC_KEY=DIN_TRAFIKLAB_STATIC_NYCKEL
  ) > "%DST%\.env.local"
)

echo.
echo Initierar eget git-repo i %DST%...
cd /d "%DST%"
if not exist ".git" (
  git init -b main
  git add -A
  git commit -m "feat: HbgBuss3D initial"
)

echo.
echo ============================================
echo  Klart! HbgBuss3D ar nu ett eget projekt:
echo  %DST%
echo.
echo  Nasta steg:
echo  1. Oppna .env.local och klistra in dina nycklar
echo  2. Oppna mappen i Claude Code Desktop
echo  3. Dubbelklicka start.bat for att kora appen
echo ============================================
echo.
pause

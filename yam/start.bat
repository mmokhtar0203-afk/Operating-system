@echo off
REM ============================================================
REM  YAM - Construction Documentation System
REM  Double-click this file to start the app in your browser.
REM  Keep the window that opens running while you use YAM.
REM ============================================================
title YAM - local server
cd /d "%~dp0"

REM 1) Python launcher (py), if installed
py -3 --version >nul 2>nul
if not errorlevel 1 (
  py -3 serve.py 8080
  goto :end
)

REM 2) python on PATH (ignores the Microsoft Store placeholder)
python --version >nul 2>nul
if not errorlevel 1 (
  python serve.py 8080
  goto :end
)

REM 3) No Python: use the built-in Windows PowerShell server
echo Python not found - starting the built-in PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" 8080

:end
pause

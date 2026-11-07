@echo off
REM Start YAM locally on http://localhost:8080
cd /d "%~dp0"
start "" http://localhost:8080
python -m http.server 8080

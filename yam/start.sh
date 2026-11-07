#!/usr/bin/env bash
# Start YAM locally (macOS / Linux). Keep this terminal open while using the app.
cd "$(dirname "$0")"
python3 serve.py "${1:-8080}"

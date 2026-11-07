#!/usr/bin/env bash
# Start YAM locally on http://localhost:8080
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "YAM running at http://localhost:$PORT  (Ctrl+C to stop)"
( sleep 1; (command -v open >/dev/null && open "http://localhost:$PORT") || (command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT") ) >/dev/null 2>&1 &
python3 -m http.server "$PORT"

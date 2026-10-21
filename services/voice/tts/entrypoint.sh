#!/usr/bin/env sh
set -eu

python /app/download_voice.py
exec uvicorn app:app --host 0.0.0.0 --port 8002

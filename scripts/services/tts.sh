#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SERVICE_DIR="${ROOT}/services/voice/tts"
VENV="${TTS_VENV:-$SERVICE_DIR/.venv}"

ensure_venv "$VENV" "$SERVICE_DIR/requirements.txt"

export PATH="$VENV/bin:$PATH"
export TTS_DATA_DIR="${TTS_DATA_DIR:-$LOCAL_DIR/tts-models}"
export TTS_VOICES="${TTS_VOICES:-en_US-lessac-medium,hi_IN-pratham-medium}"

mkdir -p "$TTS_DATA_DIR"
"$VENV/bin/python" "$SERVICE_DIR/download_voice.py"

exec "$VENV/bin/uvicorn" app:app \
  --app-dir "$SERVICE_DIR" \
  --host "${TTS_HOST:-127.0.0.1}" \
  --port "${TTS_PORT:-8002}"

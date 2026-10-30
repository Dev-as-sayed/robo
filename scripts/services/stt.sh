#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SERVICE_DIR="${ROOT}/services/voice/stt"
VENV="${STT_VENV:-$SERVICE_DIR/.venv}"

ensure_venv "$VENV" "$SERVICE_DIR/requirements.txt"

export HF_HOME="${HF_HOME:-$LOCAL_DIR/hf-cache}"
export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_DEVICE="${WHISPER_DEVICE:-cpu}"
export WHISPER_COMPUTE_TYPE="${WHISPER_COMPUTE_TYPE:-int8}"

exec "$VENV/bin/uvicorn" app:app \
  --app-dir "$SERVICE_DIR" \
  --host "${STT_HOST:-127.0.0.1}" \
  --port "${STT_PORT:-8001}"

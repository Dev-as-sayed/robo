#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

for pid_file in "$RUN_DIR"/*.pid; do
  [ -e "$pid_file" ] || continue

  name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" 2>/dev/null; then
    echo "$name: running (pid $pid)"
  else
    echo "$name: stopped (stale pid $pid)"
  fi
done

check_http() {
  local name="$1"
  local url="$2"

  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "$url" >/dev/null 2>&1; then
      echo "$name: healthy"
    else
      echo "$name: unreachable"
    fi
  fi
}

if command -v redis-cli >/dev/null 2>&1; then
  if [ "$(redis-cli -p "${REDIS_PORT:-6379}" ping 2>/dev/null || true)" = "PONG" ]; then
    echo "redis: healthy"
  else
    echo "redis: unreachable"
  fi
fi

check_http "minio" "http://127.0.0.1:${MINIO_PORT:-9000}/minio/health/live"
check_http "stt" "http://127.0.0.1:${STT_PORT:-8001}/health"
check_http "tts" "http://127.0.0.1:${TTS_PORT:-8002}/health"

#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

start_service() {
  local name="$1"
  local script="$2"
  local pid_file="$RUN_DIR/$name.pid"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name already running (pid $(cat "$pid_file"))"
    return
  fi

  if [ "$name" = "redis" ] && command -v redis-cli >/dev/null 2>&1; then
    if [ "$(redis-cli -p "${REDIS_PORT:-6379}" ping 2>/dev/null || true)" = "PONG" ]; then
      echo "redis already running on port ${REDIS_PORT:-6379}"
      return
    fi
  fi

  if command -v setsid >/dev/null 2>&1; then
    setsid "$script" > "$LOG_DIR/$name.log" 2>&1 &
  else
    nohup "$script" > "$LOG_DIR/$name.log" 2>&1 &
  fi
  local pid=$!
  printf '%s\n' "$pid" > "$pid_file"
  sleep 1

  if kill -0 "$pid" 2>/dev/null; then
    echo "$name started (pid $pid, log $LOG_DIR/$name.log)"
  else
    echo "$name failed to start; see $LOG_DIR/$name.log" >&2
    tail -n 20 "$LOG_DIR/$name.log" >&2 || true
    rm -f "$pid_file"
  fi
}

start_service redis "$ROOT/scripts/services/redis.sh"
start_service minio "$ROOT/scripts/services/minio.sh"
start_service stt "$ROOT/scripts/services/stt.sh"
start_service tts "$ROOT/scripts/services/tts.sh"

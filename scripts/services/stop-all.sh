#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

signal_service() {
  local signal="$1"
  local pid="$2"
  local pgid

  pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  if [ -n "$pgid" ] && [ "$pgid" = "$pid" ]; then
    kill "-$signal" -- "-$pgid" 2>/dev/null || true
  else
    kill "-$signal" "$pid" 2>/dev/null || true
  fi
}

for pid_file in "$RUN_DIR"/*.pid; do
  [ -e "$pid_file" ] || continue

  name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" 2>/dev/null; then
    signal_service TERM "$pid"
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      signal_service KILL "$pid"
    fi
    echo "$name stopped"
  else
    echo "$name was not running"
  fi

  rm -f "$pid_file"
done

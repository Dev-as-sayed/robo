#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

DATA_DIR="${REDIS_DATA_DIR:-$LOCAL_DIR/redis}"
PORT="${REDIS_PORT:-6379}"

mkdir -p "$DATA_DIR"

if command -v redis-server >/dev/null 2>&1; then
  SERVER="redis-server"
elif command -v valkey-server >/dev/null 2>&1; then
  SERVER="valkey-server"
else
  echo "redis-server or valkey-server is required." >&2
  echo "Install Redis (apt install redis-server, brew install redis) or Valkey, then retry." >&2
  exit 1
fi

exec "$SERVER" \
  --bind 127.0.0.1 \
  --port "$PORT" \
  --dir "$DATA_DIR" \
  --appendonly yes \
  --save ""

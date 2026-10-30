#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/robo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/robo-${STAMP}.sql.gz"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required. Install the PostgreSQL client, then retry." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required, for example postgresql://robo:password@127.0.0.1:5432/robo" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077

pg_dump --no-owner --no-privileges --dbname="$DATABASE_URL" | gzip -9 > "$TARGET"

sha256sum "$TARGET" > "${TARGET}.sha256"
find "$BACKUP_DIR" -name 'robo-*.sql.gz*' -mtime "+${RETENTION_DAYS}" -delete

echo "Wrote $TARGET"
echo "Copy encrypted backups off-host and test a restore monthly."

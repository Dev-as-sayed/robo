#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/robo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/robo-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
umask 077

docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump --no-owner --no-privileges -U robo robo | gzip -9 > "$TARGET"

sha256sum "$TARGET" > "${TARGET}.sha256"
find "$BACKUP_DIR" -name 'robo-*.sql.gz*' -mtime "+${RETENTION_DAYS}" -delete

echo "Wrote $TARGET"
echo "Copy encrypted backups off-host and test a restore monthly."

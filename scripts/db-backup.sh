#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/runwalk-${TIMESTAMP}.dump"
PG_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//; s/\\?&/?/')"

mkdir -p "$BACKUP_DIR"

pg_dump "$PG_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$BACKUP_FILE"

find "$BACKUP_DIR" -type f -name "runwalk-*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -delete

printf '%s\n' "$BACKUP_FILE"

#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/root/workspace/run-walk-coach}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/run-walk-coach/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-runwalk}"
POSTGRES_DB="${POSTGRES_DB:-runwalk}"
MIN_BACKUP_BYTES="${MIN_BACKUP_BYTES:-1024}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/runwalk-${TIMESTAMP}.dump"
TMP_FILE="${BACKUP_FILE}.tmp"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT INT TERM

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

cd "$APP_DIR"

docker compose exec -T "$POSTGRES_SERVICE" \
  pg_dump \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=custom \
    --no-owner \
    --no-acl > "$TMP_FILE"

BACKUP_BYTES="$(wc -c < "$TMP_FILE" | tr -d ' ')"
if [ "$BACKUP_BYTES" -lt "$MIN_BACKUP_BYTES" ]; then
  printf 'Backup is too small: %s bytes\n' "$BACKUP_BYTES" >&2
  exit 1
fi

chmod 640 "$TMP_FILE"
mv "$TMP_FILE" "$BACKUP_FILE"
ln -sfn "$(basename "$BACKUP_FILE")" "${BACKUP_DIR}/latest.dump"

find "$BACKUP_DIR" -type f -name "runwalk-*.dump" -mtime +"$BACKUP_RETENTION_DAYS" -delete

printf '%s\n' "$BACKUP_FILE"

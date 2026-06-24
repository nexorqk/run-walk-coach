#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/root/workspace/run-walk-coach}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/run-walk-coach/postgres}"
RESTORE_DRILL_STATE="${RESTORE_DRILL_STATE:-/var/lib/run-walk-coach/restore-drill.last}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-runwalk}"
RESTORE_DRILL_DB_PREFIX="${RESTORE_DRILL_DB_PREFIX:-runwalk_restore_drill}"

LATEST_BACKUP="$(
  find "$BACKUP_DIR" -type f -name "runwalk-*.dump" -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | awk 'NR == 1 { $1=""; sub(/^ /, ""); print }'
)"

if [ "$LATEST_BACKUP" = "" ]; then
  printf 'No backup file found in %s\n' "$BACKUP_DIR" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DRILL_DB="${RESTORE_DRILL_DB_PREFIX}_${TIMESTAMP}_$$"

cleanup() {
  cd "$APP_DIR"
  docker compose exec -T "$POSTGRES_SERVICE" dropdb -U "$POSTGRES_USER" --if-exists "$DRILL_DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cd "$APP_DIR"
docker compose exec -T "$POSTGRES_SERVICE" createdb -U "$POSTGRES_USER" "$DRILL_DB"
docker compose exec -T "$POSTGRES_SERVICE" \
  pg_restore \
    -U "$POSTGRES_USER" \
    -d "$DRILL_DB" \
    --exit-on-error \
    --no-owner \
    --no-acl < "$LATEST_BACKUP"

USER_COUNT="$(
  docker compose exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$DRILL_DB" -Atc 'SELECT count(*) FROM "User";'
)"
SESSION_COUNT="$(
  docker compose exec -T "$POSTGRES_SERVICE" \
    psql -U "$POSTGRES_USER" -d "$DRILL_DB" -Atc 'SELECT count(*) FROM "WorkoutSession";'
)"

mkdir -p "$(dirname "$RESTORE_DRILL_STATE")"
printf 'timestamp=%s\nbackup=%s\nusers=%s\nsessions=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "$LATEST_BACKUP" \
  "$USER_COUNT" \
  "$SESSION_COUNT" > "$RESTORE_DRILL_STATE"

printf 'Restore drill OK: backup=%s users=%s sessions=%s\n' "$LATEST_BACKUP" "$USER_COUNT" "$SESSION_COUNT"

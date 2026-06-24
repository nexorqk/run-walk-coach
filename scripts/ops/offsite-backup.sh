#!/usr/bin/env sh
set -eu

BACKUP_FILE="${1:?backup file is required}"
OFFSITE_BACKUP_STATE="${OFFSITE_BACKUP_STATE:-/var/lib/run-walk-coach/offsite-backup.last}"
OFFSITE_BACKUP_REQUIRED="${OFFSITE_BACKUP_REQUIRED:-false}"

if [ ! -f "$BACKUP_FILE" ]; then
  printf 'Backup file does not exist: %s\n' "$BACKUP_FILE" >&2
  exit 1
fi

if [ "${OFFSITE_BACKUP_COMMAND:-}" != "" ]; then
  BACKUP_FILE="$BACKUP_FILE" sh -c "$OFFSITE_BACKUP_COMMAND"
elif [ "${OFFSITE_BACKUP_TARGET:-}" != "" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    if [ "$OFFSITE_BACKUP_REQUIRED" = "true" ]; then
      printf 'OFFSITE_BACKUP_TARGET is set but rclone is not installed\n' >&2
      exit 1
    fi

    printf 'Skipping offsite backup: rclone is not installed\n' >&2
    exit 0
  fi

  rclone copyto "$BACKUP_FILE" "${OFFSITE_BACKUP_TARGET%/}/$(basename "$BACKUP_FILE")"
else
  if [ "$OFFSITE_BACKUP_REQUIRED" = "true" ]; then
    printf 'Offsite backup is required but OFFSITE_BACKUP_TARGET or OFFSITE_BACKUP_COMMAND is not set\n' >&2
    exit 1
  fi

  printf 'Skipping offsite backup: target is not configured\n'
  exit 0
fi

mkdir -p "$(dirname "$OFFSITE_BACKUP_STATE")"
printf 'timestamp=%s\nbackup=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$BACKUP_FILE" > "$OFFSITE_BACKUP_STATE"
printf 'Offsite backup OK: %s\n' "$BACKUP_FILE"

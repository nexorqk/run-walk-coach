#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP:?BACKUP is required}"

PG_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//; s/\\?&/?/')"

pg_restore "$BACKUP" \
  --dbname="$PG_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl

#!/usr/bin/env sh
set -eu

KEY="${1:?alert key is required}"
SEVERITY="${2:?alert severity is required}"
TITLE="${3:?alert title is required}"
BODY="${4:-}"

ALERT_LOG="${ALERT_LOG:-/var/log/run-walk-coach/alerts.log}"
ALERT_STATE_DIR="${ALERT_STATE_DIR:-/var/lib/run-walk-coach/alerts}"
ALERT_THROTTLE_SECONDS="${ALERT_THROTTLE_SECONDS:-1800}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STATE_FILE="${ALERT_STATE_DIR}/${KEY}.last"

mkdir -p "$(dirname "$ALERT_LOG")" "$ALERT_STATE_DIR"

printf '[%s] [%s] %s\n%s\n\n' "$TIMESTAMP" "$SEVERITY" "$TITLE" "$BODY" >> "$ALERT_LOG"
logger -t run-walk-coach-alert "[$SEVERITY] $TITLE $BODY"

if [ -f "$STATE_FILE" ]; then
  LAST_SENT="$(cat "$STATE_FILE" 2>/dev/null || printf '0')"
else
  LAST_SENT="0"
fi

NOW="$(date +%s)"
if [ "${ALERT_WEBHOOK_URL:-}" = "" ]; then
  printf '%s\n' "$NOW" > "$STATE_FILE"
  exit 0
fi

if [ $((NOW - LAST_SENT)) -lt "$ALERT_THROTTLE_SECONDS" ]; then
  exit 0
fi

PAYLOAD="$(
  jq -n \
    --arg timestamp "$TIMESTAMP" \
    --arg service "run-walk-coach" \
    --arg severity "$SEVERITY" \
    --arg title "$TITLE" \
    --arg body "$BODY" \
    '{timestamp: $timestamp, service: $service, severity: $severity, title: $title, body: $body}'
)"

curl -fsS \
  -X POST \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "$ALERT_WEBHOOK_URL" >/dev/null

printf '%s\n' "$NOW" > "$STATE_FILE"

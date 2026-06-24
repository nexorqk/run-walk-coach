#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/root/workspace/run-walk-coach}"
API_READY_URL="${API_READY_URL:-https://run.storycraftbooks.com/api/health/ready}"
NGINX_ACCESS_LOG="${NGINX_ACCESS_LOG:-/var/log/nginx/access.log}"
API_5XX_LOG_LINES="${API_5XX_LOG_LINES:-5000}"
API_5XX_THRESHOLD="${API_5XX_THRESHOLD:-1}"
DISK_USAGE_WARN_PERCENT="${DISK_USAGE_WARN_PERCENT:-80}"
DISK_CHECK_PATHS="${DISK_CHECK_PATHS:-/ /var/backups/run-walk-coach}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/run-walk-coach/postgres}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
SEND_ALERT="${SEND_ALERT:-/usr/local/sbin/run-walk-coach-send-alert}"
LOG_COLLECTOR_UNIT="${LOG_COLLECTOR_UNIT:-run-walk-coach-logs.service}"
OFFSITE_BACKUP_REQUIRED="${OFFSITE_BACKUP_REQUIRED:-false}"
OFFSITE_BACKUP_STATE="${OFFSITE_BACKUP_STATE:-/var/lib/run-walk-coach/offsite-backup.last}"
OFFSITE_BACKUP_MAX_AGE_HOURS="${OFFSITE_BACKUP_MAX_AGE_HOURS:-26}"

ISSUES=""

append_issue() {
  if [ "$ISSUES" = "" ]; then
    ISSUES="$1"
  else
    ISSUES="${ISSUES}
$1"
  fi
}

if ! curl -fsS --max-time 10 "$API_READY_URL" | jq -e '.ok == true and .database == "ready"' >/dev/null; then
  append_issue "API readiness failed: ${API_READY_URL}"
fi

if [ -f "$NGINX_ACCESS_LOG" ]; then
  API_5XX_COUNT="$(
    tail -n "$API_5XX_LOG_LINES" "$NGINX_ACCESS_LOG" \
      | awk '$7 ~ /^\/api(\/|\?|$)/ && $9 ~ /^5/ { count++ } END { print count + 0 }'
  )"

  if [ "$API_5XX_COUNT" -ge "$API_5XX_THRESHOLD" ]; then
    append_issue "API 5xx count in last ${API_5XX_LOG_LINES} nginx lines is ${API_5XX_COUNT}, threshold ${API_5XX_THRESHOLD}"
  fi
else
  append_issue "Nginx access log not found: ${NGINX_ACCESS_LOG}"
fi

for path in $DISK_CHECK_PATHS; do
  if [ ! -e "$path" ]; then
    append_issue "Disk check path does not exist: ${path}"
    continue
  fi

  USAGE_PERCENT="$(df -P "$path" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  if [ "$USAGE_PERCENT" -ge "$DISK_USAGE_WARN_PERCENT" ]; then
    append_issue "Disk usage for ${path} is ${USAGE_PERCENT}%, threshold ${DISK_USAGE_WARN_PERCENT}%"
  fi
done

LATEST_BACKUP_LINE="$(
  find "$BACKUP_DIR" -type f -name "runwalk-*.dump" -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | head -n 1
)"

if [ "$LATEST_BACKUP_LINE" = "" ]; then
  append_issue "No backup found in ${BACKUP_DIR}"
else
  LATEST_BACKUP_EPOCH="${LATEST_BACKUP_LINE%% *}"
  NOW_EPOCH="$(date +%s)"
  BACKUP_AGE_SECONDS="$(awk -v now="$NOW_EPOCH" -v then="$LATEST_BACKUP_EPOCH" 'BEGIN { printf "%.0f", now - then }')"
  BACKUP_MAX_AGE_SECONDS=$((BACKUP_MAX_AGE_HOURS * 3600))

  if [ "$BACKUP_AGE_SECONDS" -gt "$BACKUP_MAX_AGE_SECONDS" ]; then
    append_issue "Latest backup age is $((BACKUP_AGE_SECONDS / 3600))h, threshold ${BACKUP_MAX_AGE_HOURS}h"
  fi
fi

if [ "$OFFSITE_BACKUP_REQUIRED" = "true" ]; then
  if [ ! -f "$OFFSITE_BACKUP_STATE" ]; then
    append_issue "Offsite backup is required but no success marker exists: ${OFFSITE_BACKUP_STATE}"
  else
    OFFSITE_BACKUP_EPOCH="$(stat -c %Y "$OFFSITE_BACKUP_STATE")"
    NOW_EPOCH="$(date +%s)"
    OFFSITE_BACKUP_AGE_SECONDS=$((NOW_EPOCH - OFFSITE_BACKUP_EPOCH))
    OFFSITE_BACKUP_MAX_AGE_SECONDS=$((OFFSITE_BACKUP_MAX_AGE_HOURS * 3600))

    if [ "$OFFSITE_BACKUP_AGE_SECONDS" -gt "$OFFSITE_BACKUP_MAX_AGE_SECONDS" ]; then
      append_issue "Latest offsite backup marker age is $((OFFSITE_BACKUP_AGE_SECONDS / 3600))h, threshold ${OFFSITE_BACKUP_MAX_AGE_HOURS}h"
    fi
  fi
fi

if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet "$LOG_COLLECTOR_UNIT"; then
    append_issue "Log collector is not active: ${LOG_COLLECTOR_UNIT}"
  fi
fi

cd "$APP_DIR"
if ! docker compose ps --status running api postgres >/dev/null; then
  append_issue "Expected Docker services are not running"
fi

if [ "$ISSUES" != "" ]; then
  "$SEND_ALERT" "production-check" "warning" "RunWalk production check failed" "$ISSUES" || true
  printf '%s\n' "$ISSUES" >&2
  exit 1
fi

printf 'RunWalk production check OK\n'

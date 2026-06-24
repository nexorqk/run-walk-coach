# RunWalk Coach Operations

## Required Production Environment

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://your-app.example.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.example.com/api/auth/google/callback
SESSION_COOKIE_NAME=rwc_session
RATE_LIMIT_MAX=240
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=8
AUTH_RATE_LIMIT_WINDOW_MS=900000
REQUIRE_ORIGIN_CHECK=true
```

`CORS_ORIGIN` is a comma-separated allowlist. Keep the frontend and API on the same site when possible so cookie auth stays simple.

## Deployment Order

1. Build the API image.
2. Run the migration job:

   ```bash
   pnpm --filter @run-walk-coach/api db:deploy
   ```

3. Start the API runtime:

   ```bash
   pnpm --filter @run-walk-coach/api start
   ```

4. Serve the web build from `apps/web/dist`.

The Docker Compose setup models this with a separate `migrate` service that must complete before `api` starts.

## Health Checks

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`
- Runtime metrics: `GET /api/metrics` in non-production environments only.

Use readiness for deploy rollouts because it checks database connectivity.

## Backups

Production backups use the Postgres Docker container tools, so the host does not need `pg_dump`.
Backups are written in `pg_dump` custom format to `/var/backups/run-walk-coach/postgres`.

```bash
systemctl status run-walk-coach-backup.timer
systemctl start run-walk-coach-backup.service
```

The timer runs daily at 03:45 with a randomized delay. The backup script keeps
`runwalk-*.dump` files for `BACKUP_RETENTION_DAYS` and updates `latest.dump`.

## Restore Drill

Restore drills run weekly into a temporary database and do not touch production data.

```bash
systemctl status run-walk-coach-restore-drill.timer
systemctl start run-walk-coach-restore-drill.service
cat /var/lib/run-walk-coach/restore-drill.last
```

The drill restores the latest backup, checks the restored `User` and `WorkoutSession`
tables, writes the last successful report, then drops the temporary database.

## Monitoring

RunWalk Coach uses systemd timers and journald for basic production monitoring:

```bash
systemctl status run-walk-coach-monitor.timer
systemctl status run-walk-coach-logs.service
journalctl -u run-walk-coach-monitor.service -n 100 --no-pager
journalctl -u run-walk-coach-logs.service -n 100 --no-pager
tail -n 100 /var/log/run-walk-coach/alerts.log
```

The monitor checks API readiness, API 5xx responses in nginx access logs, disk usage,
latest backup age, expected Docker services, and the log collector unit.

Minimum alerts:

- API readiness fails.
- API 5xx rate rises above baseline.
- Database connections fail.
- Backup job fails or latest backup age exceeds 24 hours.
- Disk usage on database volume exceeds 80%.

Alerts are always written to journald and `/var/log/run-walk-coach/alerts.log`. Set
`ALERT_WEBHOOK_URL` in `/etc/run-walk-coach/ops.env` to also deliver JSON alerts to
an external collector.

## Maintenance

Run cleanup at least daily:

```bash
DATABASE_URL=postgresql://... ANONYMOUS_USER_RETENTION_DAYS=7 pnpm --filter @run-walk-coach/api maintenance:cleanup
```

This deletes expired auth sessions and legacy abandoned anonymous users from older deployments.

## Privacy Operations

Users can delete browser progress in Settings. When signed in with Google, this also deletes the server profile and cascades related sessions, template overrides, and auth sessions.

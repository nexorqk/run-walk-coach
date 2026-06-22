# RunWalk Coach Operations

## Required Production Environment

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://your-app.example.com
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
- Runtime metrics: `GET /api/metrics`

Use readiness for deploy rollouts because it checks database connectivity.

## Backups

Backups use `pg_dump` custom format.

```bash
DATABASE_URL=postgresql://... BACKUP_DIR=backups BACKUP_RETENTION_DAYS=30 ./scripts/db-backup.sh
```

The script deletes `runwalk-*.dump` files older than `BACKUP_RETENTION_DAYS` inside `BACKUP_DIR`.

## Restore Drill

Run a restore drill before launch and after every material schema change.

1. Create a fresh database.
2. Restore the latest dump:

   ```bash
   DATABASE_URL=postgresql://... BACKUP=backups/runwalk-YYYYMMDDTHHMMSSZ.dump ./scripts/db-restore.sh
   ```

3. Run migrations:

   ```bash
   DATABASE_URL=postgresql://... pnpm --filter @run-walk-coach/api db:deploy
   ```

4. Start the API and verify:

   ```bash
   curl -fsS https://your-app.example.com/api/health/ready
   ```

5. Verify at least one profile, session, and recovery-code status from the restored app.

## Monitoring

Collect API logs from stdout/stderr. Every unhandled API error includes a request id in the response and logs.

Minimum alerts:

- API readiness fails.
- API 5xx rate rises above baseline.
- Database connections fail.
- Backup job fails or latest backup age exceeds 24 hours.
- Disk usage on database volume exceeds 80%.

## Maintenance

Run cleanup at least daily:

```bash
DATABASE_URL=postgresql://... ANONYMOUS_USER_RETENTION_DAYS=7 pnpm --filter @run-walk-coach/api maintenance:cleanup
```

This deletes expired auth sessions and anonymous users that never saved sessions, never created
template overrides, and do not have recovery-code metadata.

## Privacy Operations

Users can delete server and local progress in Settings. This deletes the anonymous profile and cascades related sessions, template overrides, auth sessions, and recovery code metadata.

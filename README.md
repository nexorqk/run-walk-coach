# RunWalk Coach

Personal run-walk coaching PWA. It includes a React/Vite frontend, Fastify API, Prisma/PostgreSQL backend, shared TypeScript/Zod contracts, offline-first session storage with IndexedDB, anonymous cookie auth, recovery codes, and production hardening for basic deployment.

The core product remains intentionally narrow: run-walk training and personal workout logging. The main user flow is Today -> Timer -> Report -> Save locally -> Sync to API -> History -> Next recommendation.

## Stack

- pnpm workspaces
- React, Vite, TypeScript, React Router, Zustand, Dexie, Zod
- Fastify, Prisma, PostgreSQL
- PWA manifest and service worker
- Anonymous `httpOnly` session cookies with recovery codes
- Docker Compose for local Postgres/API and migration job

## Local Setup

The Makefile wraps the usual project commands:

```bash
make setup
make start
```

Manual setup is also available:

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
```

If local port `5432` is already taken, run Postgres on another port and update `apps/api/.env`:

```bash
POSTGRES_PORT=5433 docker compose up -d postgres
```

Default local database URL:

```env
DATABASE_URL=postgresql://runwalk:runwalk@localhost:5432/runwalk?schema=public
```

## URLs

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health
- API liveness: http://localhost:4000/api/health/live
- API readiness: http://localhost:4000/api/health/ready
- API metrics: http://localhost:4000/api/metrics
- API prefix: `/api`

Vite proxies `/api` to `http://localhost:4000` in local development. For same-domain deployment, keep `VITE_API_BASE_URL=/api`.

## Useful Commands

```bash
make help
make start
make check
make build
make test
make db-migrate
make db-seed
make db-backup
make maintenance-cleanup
```

Equivalent pnpm commands:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:seed
```

## Current Capabilities

- Daily workout recommendation on `/today`
- Full-screen run/walk timer
- Session report with difficulty, breathing, pain, heart-rate fields, and notes
- Offline-first save to IndexedDB
- Retry sync from app startup and History
- Idempotent server sync with `clientSessionId`
- History and weekly analytics
- Editable workout timing in Settings: warmup, run, walk, cooldown
- Anonymous server profile created automatically
- Recovery code create, download, rotate, revoke, and restore
- Delete server and local progress from Settings
- JSON export endpoint
- Privacy page at `/privacy.html`

## Auth And Recovery

The API creates an anonymous `User` on first use and stores a session token in an `httpOnly` cookie. Users do not need email or password.

Recovery codes can be created in Settings. The raw code is shown to the user; the server stores only a hash. Anyone with the recovery code can restore the anonymous profile on another browser or device, so users should keep it private. Recovery codes can be revoked or rotated.

## MVP Flow

1. Open `/today`.
2. Start the recommended workout.
3. Use the full-screen timer with pause/resume and finish controls.
4. Fill the session report.
5. The app saves the report to IndexedDB first.
6. It then tries to sync with the backend.
7. Pending sessions are retried on app startup and from the history screen.

## Progression Rules

The backend suggests the next template from recent sessions:

- Pain reported: repeat or regress.
- Difficulty `>= 8`: repeat.
- Breathing `VERY_HARD`: repeat.
- Max HR `>= 170`: repeat.
- Two successful sessions in a row at the current level: progress.
- Otherwise: repeat.

A successful session has no pain, difficulty `<= 6`, breathing `EASY`, `MEDIUM`, or `HARD`, and max HR missing or `< 160`.

## Production Notes

Production runtime requires:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://your-app.example.com
SESSION_COOKIE_NAME=rwc_session
REQUIRE_ORIGIN_CHECK=true
```

Security and deployment hardening included:

- strict CORS allowlist
- Origin/Referer checks for unsafe cookie-auth requests
- Fastify Helmet headers
- global and auth-specific rate limits
- readiness endpoint with database check
- separate Docker migration service
- backup/restore scripts
- expired session and abandoned anonymous-user cleanup
- basic Vitest coverage for shared contracts and security helper behavior

See [docs/operations.md](docs/operations.md) for deployment order, backup/restore drill, health checks, maintenance, and monitoring notes.

## Notes

- Heart rate is manual in v1.
- No GPS, Bluetooth HR, social features, payments, or AI features are included.
- The app stores pending sessions locally in IndexedDB so workouts can be saved offline.

# RunWalk Coach

Personal run-walk coaching PWA. It includes a React/Vite frontend, Fastify API, Prisma/PostgreSQL backend, shared TypeScript/Zod contracts, offline-first session storage with IndexedDB, Google OAuth server sync, and production hardening for basic deployment.

The core product remains intentionally narrow: run-walk training and personal workout logging. The main user flow is Today -> Timer -> Report -> Save in browser -> optional Google sync -> History -> Next recommendation.

## Stack

- pnpm workspaces
- React, Vite, TypeScript, React Router, Zustand, Dexie, Zod
- Fastify, Prisma, PostgreSQL
- PWA manifest and service worker
- Google OAuth with `httpOnly` session cookies for server sync
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

Docker publishes the local Postgres and API ports on `127.0.0.1` only. Public traffic should go through nginx on `80/443`.

Default local database URL:

```env
DATABASE_URL=postgresql://runwalk:runwalk@localhost:5432/runwalk?schema=public
```

## URLs

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/health
- API liveness: http://localhost:4000/api/health/live
- API readiness: http://localhost:4000/api/health/ready
- API metrics, local only: http://localhost:4000/api/metrics
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

- Daily workout recommendation on `/today` with personalized adaptation
- Adaptive workout engine: granular run/walk/repeats adjustments after each session
- Editable workout timing on Today page (warmup, run, walk, cooldown)
- Full-screen run/walk timer
- Session report with difficulty, breathing, pain, heart-rate fields, and notes
- Offline-first save to IndexedDB
- Browser-only progress until Google login is connected
- Retry sync from app startup and History after Google login
- Idempotent server sync with `clientSessionId`
- History and weekly analytics
- Collapsible Coach screen with pulse zones, pacing cue, and running guidance
- Google login for saving progress on the server
- Delete server and local progress from Settings
- JSON export endpoint
- Privacy page at `/data-privacy`

## Auth And Storage

Without Google login, profile settings, workout timing, and workout reports are stored in the browser. This local progress lasts until the user clears browser storage/cookies or deletes progress in Settings.

Google OAuth is the only server-sync path. After Google login, the API stores a secure `httpOnly` session cookie and local sessions are retried for server sync.

## MVP Flow

1. Open `/today`.
2. Start the recommended workout.
3. Use the full-screen timer with pause/resume and finish controls.
4. Fill the session report.
5. The app saves the report to IndexedDB first.
6. If Google login is connected, it then tries to sync with the backend.
7. Local sessions are retried after Google login and from the history screen.

## Progression Rules

The backend uses an **adaptive workout engine** that makes granular timing adjustments based on session feedback. After each workout, it analyzes difficulty, pain, breathing, heart rate, and completion to adjust the next workout.

**Adjustment rules:**

| Condition | Adjustment |
|-----------|------------|
| Easy session (difficulty ≤4, EASY breathing) | run +15s |
| Controlled session (difficulty 5-6, EASY/MEDIUM) | run +15s |
| High difficulty (≥8) | run −15s |
| Very hard breathing | walk +10s |
| High heart rate (≥170) | walk +10s |
| Very high heart rate (≥180) | walk +10s, run −15s |
| Elevated heart rate (160-169) | walk +10s |
| Incomplete workout | repeats −1 |
| Incomplete + hard (≥7) | repeats −1, run −15s |
| Pain | regress level |
| Two successful sessions in a row | progress level |

The response includes personalized reasons with actual session data (e.g. "difficulty was 6/10, no pain, so run +15s") and a list of specific adaptations applied.

Clamp limits: runSec 15–1800, walkSec 0–300, repeats 1–50.

A successful session has no pain, difficulty `<= 6`, breathing `EASY`, `MEDIUM`, or `HARD`, max HR missing or `< 160`, and is completed.

## Production Notes

Production runtime requires:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://your-app.example.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-app.example.com/api/auth/google/callback
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
- expired session cleanup
- basic Vitest coverage for shared contracts and security helper behavior

See [docs/operations.md](docs/operations.md) for deployment order, backup/restore drill, health checks, maintenance, and monitoring notes.

## Notes

- Heart rate is manual in v1, with Coach guidance based on the easy HR range in Settings.
- No GPS, Bluetooth HR, social features, payments, or AI features are included.
- The app stores local sessions in IndexedDB so workouts can be saved offline and before Google login.
- The rule-based strength training engine direction is documented in [docs/rule-based-training-engine.md](docs/rule-based-training-engine.md).
- Selective frontend practices borrowed from `modern-stack` are documented in [docs/borrowed-modern-stack-practices.md](docs/borrowed-modern-stack-practices.md).

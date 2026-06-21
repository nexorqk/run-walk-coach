# RunWalk Coach

MVP personal run-walk PWA for mobile Safari. It includes a React/Vite frontend, Fastify API, Prisma/PostgreSQL backend, shared TypeScript/Zod types, offline-first session storage with IndexedDB, and a simple backend progression engine.

The product scope is intentionally narrow: run-walk training and slot-free personal workout logging. The first priority is the working vertical slice: Today -> Timer -> Report -> Save locally -> Sync to API -> History -> Next recommendation.

## Stack

- pnpm workspaces
- React, Vite, TypeScript, React Router, Zustand, Dexie, Zod
- Fastify, Prisma, PostgreSQL
- PWA manifest and service worker

## Local Setup

1. Install pnpm:

   ```bash
   corepack enable
   corepack prepare pnpm@9.15.4 --activate
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

   If local port `5432` is already taken, run `POSTGRES_PORT=5433 docker compose up -d postgres` and update `DATABASE_URL` to use port `5433`.

4. Configure the API environment:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

   Default local database URL:

   ```env
   DATABASE_URL=postgresql://runwalk:runwalk@localhost:5432/runwalk?schema=public
   ```

5. Create tables and seed default data:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

6. Start API and web app:

   ```bash
   pnpm dev
   ```

## URLs

- Frontend: http://localhost:5173
- Backend health: http://localhost:4000/api/health
- API prefix: `/api`

Vite proxies `/api` to `http://localhost:4000` in local development. For a same-domain deployment, keep `VITE_API_BASE_URL=/api`.

## Useful Scripts

```bash
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm build
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:seed
```

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

## Notes

- Auth is intentionally single-user for the MVP. The API uses `DEV_USER_EMAIL`.
- Heart rate is manual in v1.
- No GPS, Bluetooth HR, social features, payments, or AI features are included.

# AGENTS.md

RunWalk Coach — personal run-walk coaching PWA.

## Stack

- **Frontend**: React 19, Vite, TypeScript, React Router, Zustand, Dexie (IndexedDB), shadcn/ui (Radix), Tailwind CSS v4
- **Backend**: Fastify, Prisma, PostgreSQL
- **Shared**: TypeScript, Zod contracts in `packages/shared`
- **Infra**: pnpm workspaces, Docker Compose, systemd services, nginx

## Monorepo Structure

```txt
apps/web/          — React PWA frontend
apps/api/          — Fastify API server
packages/shared/   — Shared Zod schemas, types, defaults, timer logic
docs/              — Architecture docs
e2e/               — Playwright smoke tests
ops/systemd/       — Systemd service/timer units
```

## Commands

```bash
make setup              # First-time setup (pnpm install, docker up, migrate, seed)
make start              # Start dev servers (API + Web)
make check              # Typecheck + tests
make build              # Production build all packages
make up                 # Docker compose up --build
make down               # Docker compose down
make logs               # Docker compose logs -f
make health             # curl API readiness

pnpm dev                # Start both API + Web dev servers
pnpm dev:web            # Web only
pnpm dev:api            # API only
pnpm build              # Build all packages
pnpm lint               # Typecheck all packages
pnpm typecheck          # Typecheck all packages
pnpm test               # Vitest (all test files)
pnpm test:e2e           # Playwright smoke tests
pnpm db:migrate         # Run Prisma migrations
pnpm db:seed            # Seed database
```

Always run `pnpm lint` and `pnpm test` after changes.

## Frontend (`apps/web`)

### Key Files

```txt
src/main.tsx            — Entry point, theme/language init, service worker
src/App.tsx             — Router, layout shell, guards, onboarding gate
src/app.css             — Tailwind CSS v4 entry + @theme tokens
src/styles.css          — All component/page CSS (keep here, not in Tailwind)
src/pages/              — Route-level page components
src/components/         — Shared components (ReadinessCheck, WeeklyPlan, WorkoutSummary)
src/components/ui/      — shadcn/ui primitives (select, slider, add more here)
src/lib/utils.ts        — cn() utility (clsx + tailwind-merge)
src/store/app-store.ts  — Zustand global store
src/api/                — API client functions
src/db/                 — Dexie/IndexedDB local storage
src/sync/               — Offline-to-server sync logic
src/utils/              — Pure utilities (language, theme, readiness, etc.)
```

### Routing

- `/` — Landing page (always, even for returning users)
- `/onboarding` — First-run setup (Google login or local start)
- `/today` — Daily recommendation + readiness check + weekly plan
- `/workout/:templateId` — Full-screen timer (no shell chrome)
- `/coach` — Heart rate zones, pacing, guidance
- `/session-report` — Post-workout feedback form
- `/history` — Session history list
- `/analytics` — Weekly trends and stats
- `/settings` — Profile, timing, HR range, data management
- `/data-privacy` — Data export/import/delete

### Styling

**Tailwind CSS v4** is available for new components. Existing pages use plain CSS in `styles.css`.

- Tailwind entry: `src/app.css` (imports `tailwindcss`, maps tokens via `@theme`, then imports `styles.css`)
- All existing CSS variables (`--bg`, `--surface`, `--accent`, etc.) are mapped to Tailwind colors
- shadcn components use Tailwind utility classes with the mapped tokens

**When to use Tailwind**: New shadcn/ui components in `src/components/ui/`.
**When to use styles.css**: Existing page-level styles, complex layouts, custom CSS patterns.

Do NOT rewrite existing `styles.css` to Tailwind. Add new styles alongside.

### shadcn/ui Components

Installed: Select, Slider. Add more by creating files in `src/components/ui/` following [shadcn source patterns](https://ui.shadcn.com/docs/components).

Available Radix packages: `@radix-ui/react-select`, `@radix-ui/react-slider`, `@radix-ui/react-slot`.

To add a new shadcn component:
1. Install the Radix primitive: `pnpm --filter @run-walk-coach/web add @radix-ui/react-<name>`
2. Create `src/components/ui/<name>.tsx` following shadcn source
3. Use `cn()` from `../../lib/utils.js` for className merging
4. Use Tailwind tokens (e.g., `bg-surface`, `text-text`, `border-line`)

### Language

Bilingual EN/RU via `useLanguage()` hook in `src/utils/language.ts`.

```tsx
const { t, language, setLanguage } = useLanguage();
t({ en: "Hello", ru: "Привет" })
```

Every user-facing string must have both `en` and `ru` values. No exceptions.

### State Management

Zustand store at `src/store/app-store.ts`. Key state:
- `profile`, `templates`, `recommendation` — user data
- `serverSyncEnabled` — whether Google sync is active
- `workoutDraft` — current workout draft
- `loadInitialData()` — fetches profile/templates from API or falls back to local

### Offline-First

Sessions save to IndexedDB (Dexie) first. If Google login is connected, sync to server. `retryPendingSessions()` retries on app startup and from History.

## Backend (`apps/api`)

### Key Files

```txt
src/server.ts       — Fastify server creation
src/bootstrap.ts    — Plugin registration, route setup
src/routes.ts       — API route definitions
src/auth.ts         — Google OAuth + session cookie
src/env.ts          — Environment variable validation
src/progression.ts  — Run-walk progression rules
src/security.ts     — CORS, rate limiting, origin checks
src/prisma.ts       — Prisma client singleton
src/maintenance.ts  — Cleanup expired sessions
```

### Database

PostgreSQL via Prisma. Migrations in `apps/api/prisma/migrations/`.

```bash
pnpm db:migrate    # Create and apply migration
pnpm db:seed       # Seed default templates
```

### API Endpoints

Prefix: `/api`. Key endpoints:
- `GET /api/health/live` — liveness
- `GET /api/health/ready` — readiness (checks DB)
- `GET /api/profile` — user profile (requires auth)
- `GET /api/workout-templates` — all templates
- `GET /api/next-progression` — next workout recommendation
- `POST /api/sessions` — save session report
- `GET /api/sessions` — session history
- `POST /api/auth/google` — Google OAuth flow
- `GET /api/auth/providers` — available auth providers

## Shared (`packages/shared`)

Zod schemas and types shared between API and web.

```txt
src/schemas.ts          — Zod schemas (WorkoutTemplate, SessionReport, etc.)
src/defaults.ts         — Default workout templates, exercises, strength data
src/timer.ts            — Timer logic (phase calculation, repeat counting)
src/strength-progression.ts — Strength training progression engine
src/index.ts            — Re-exports
```

Build shared before running web or API: `pnpm --filter @run-walk-coach/shared build`.

## Auth & Storage

- **Without Google login**: profile, settings, workouts stored in browser (IndexedDB). Lost on cache clear.
- **With Google OAuth**: `httpOnly` session cookie. Server sync via idempotent `clientSessionId`.
- Google OAuth is the only server-sync path. No password auth.

## Deployment

**Domain**: `run.storycraftbooks.com`

**Static files**: nginx serves from `/var/www/run-walk-coach/`. Deploy with:
```bash
pnpm --filter @run-walk-coach/web build
rm -rf /var/www/run-walk-coach/assets /var/www/run-walk-coach/index.html
cp -r apps/web/dist/* /var/www/run-walk-coach/
```

**API**: Docker container on port 4000, proxied through nginx at `/api/`.

**Compose**: `docker compose up -d --build` (postgres + migrate + api).

**Systemd**: Backup, restore drill, monitoring, log collection via `ops/systemd/`.

**Full ops docs**: `docs/operations.md`

### Deploy After Every Feature

Always redeploy the web app after completing a feature or fix. The workflow is:
1. Run `pnpm lint` and `pnpm test`
2. Run the 3-line deploy commands above
3. Verify with `curl -sI https://run.storycraftbooks.com/ | head -5`

Do not batch multiple features into one deploy. Each feature gets its own deploy.

## Testing

- **Vitest**: Pure logic, shared schemas, security helpers, utils. Run: `pnpm test`
- **Playwright**: E2E smoke tests. Run: `pnpm test:e2e`
- Test files: `apps/web/test/`, `apps/api/test/`, `packages/shared/test/`, `e2e/`

## Coding Conventions

- TypeScript strict mode everywhere. No `any`.
- `.js` extensions in imports (ESM requirement).
- No component library beyond shadcn/ui + Radix. All other UI is custom CSS.
- Keep pages in `src/pages/`. Keep reusable UI in `src/components/`.
- shadcn primitives go in `src/components/ui/`.
- Pure utilities go in `src/utils/`.
- API client functions go in `src/api/`.
- Never commit secrets, `.env` files, or credentials.
- Run `pnpm lint` (typecheck) and `pnpm test` before considering work done.

## Rules

- Every new user-facing string must be bilingual (EN/RU).
- Do not rewrite existing `styles.css` to Tailwind. Add new styles alongside.
- Do not add external dependencies without checking if the need is already covered.
- Offline-first is non-negotiable. IndexedDB save must happen before server sync.
- Google OAuth is the only auth path. No password auth.
- The training engine is rule-based, not LLM-based. See `docs/rule-based-training-engine.md`.

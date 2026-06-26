# Borrowed Modern Stack Practices

This project should borrow selected frontend practices from the `modern-stack`
reference repository without migrating wholesale.

The goal is controlled adoption: improve UI structure, testability, localization,
and component consistency while keeping the current product architecture stable.

## Keep

These parts stay as the foundation of RunWalk Coach:

- `pnpm` workspace setup.
- React + Vite frontend.
- Fastify API.
- Prisma + PostgreSQL persistence.
- Shared TypeScript/Zod contracts.
- Dexie/IndexedDB offline-first session storage.
- Google OAuth and httpOnly cookie session sync.
- Docker Compose and production operations scripts.
- Current run-walk product flow.

Do not replace these with Bun, Vite+, Reatom, GitHub Pages-only deployment, or a
mock-only backend architecture.

## Borrow

Borrow these ideas selectively.

### Source-First Docs

Use docs that point to source files and state concrete rules. Avoid long narrative
docs that drift from implementation.

For new architecture docs, prefer:

```txt
Overview
Read Source First
Rules
Workflows
Edge Cases
```

### Feature-Oriented Frontend Structure

Keep the current pages working, but future larger features should move toward a
clearer split:

```txt
features/
  strength-training/
    api/
    model/
    ui/
    testing/

shared/
  api/
  components/
  model/
  test/

widgets/
  app-shell/
  data-page/
```

This should be introduced feature by feature. Do not reorganize the whole app in
one broad refactor.

First candidate: the strength-training flow.

### Storybook And MSW

Storybook and MSW are worth borrowing for complex UI states:

- loading
- empty
- error
- retry
- offline/pending sync
- synced
- mobile viewport
- long localized text

Use Storybook for feature-level UI behavior, not as a replacement for backend API
tests or Playwright smoke coverage.

MSW should mock browser-facing API contracts. It should not become the source of
truth for domain behavior; domain behavior stays in shared pure functions and API
tests.

### UI Component Layer

Borrow the idea of a small shared UI layer before introducing a full design system.

Good first components:

- `Button`
- `IconButton`
- `Field`
- `SelectField`
- `Metric`
- `Callout`
- `PageSection`
- `EmptyState`
- `LoadingState`

Rules:

- Wrap current CSS classes first instead of switching styling technology.
- Keep components boring and accessible.
- Prefer shared primitives for new strength-training screens.
- Avoid large rewrites of existing pages until the primitives prove useful.

### Component Recipes Later

Panda CSS recipes from `modern-stack` are useful as a design-system concept, but
they are not a short-term dependency target.

If this app needs a formal design system later, first create CSS-backed component
APIs. Only consider a styling-tool migration after component boundaries are stable.

### Localization Discipline

The current `t({ en, ru })` helper is acceptable for the MVP. Borrow the discipline
from `modern-stack`, not the whole Paraglide stack yet:

- keep text close to features while the app is small;
- avoid dynamic message keys;
- include long-text checks in UI tests;
- add every new user-facing string in both English and Russian.

Consider a real message catalog only when inline bilingual objects become noisy or
hard to audit.

### Test Style

Borrow the testing bar:

- Test user-visible behavior, not implementation details.
- Prefer accessible queries: role, label, heading, visible text.
- Cover loading/error/empty states for data-heavy screens.
- Use realistic fixtures.
- Avoid broad sleeps.

Keep current tests:

- Vitest for pure logic and shared contracts.
- Playwright smoke tests for the real app flow.

Add Storybook/MSW later for UI-state matrices.

## Do Not Borrow Yet

Avoid these until there is a specific reason:

- Reatom migration.
- Bun migration.
- Vite+ migration.
- Full Panda CSS migration.
- Ark UI rewrite.
- Storybook-only testing strategy.
- GitHub Pages-only deployment.
- Mock-first data model with no real backend.

These would create migration risk without directly advancing the training engine.

## Adoption Order

Use small vertical steps.

1. Document borrowed rules and boundaries.
2. Add a small CSS-backed shared UI component layer.
3. Use those components only in new strength-training screens.
4. Add Storybook + MSW for the first strength-training report UI states.
5. Add feature-local testing helpers for strength-training UI.
6. Evaluate whether message catalogs are needed after new bilingual screens exist.
7. Only then consider deeper tooling changes.

## First Practical Slice

For the strength-training MVP, apply borrowed patterns like this:

```txt
features/strength-training/
  api/
    strength-api.ts
  model/
    strength-report.ts
    strength-workout.ts
  ui/
    StrengthTodayPanel.tsx
    StrengthExerciseCard.tsx
    StrengthSetLogger.tsx
    StrengthFeedbackForm.tsx
  testing/
    strength-fixtures.ts

shared/components/
  Button.tsx
  Field.tsx
  Callout.tsx
  EmptyState.tsx
  LoadingState.tsx
```

This lets the new feature grow with better structure without forcing the existing
run-walk pages to move immediately.

## Decision Rule

Borrow practices when they reduce risk or make future feature work clearer.

Do not borrow tools just because they are newer.

The current app needs stability around real user data, offline sync, and training
history. Any imported pattern must respect that.

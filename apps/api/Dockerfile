FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @run-walk-coach/api... --frozen-lockfile

COPY packages/shared packages/shared
COPY apps/api apps/api
ENV DATABASE_URL="postgresql://runwalk:runwalk@localhost:5432/runwalk?schema=public"
RUN pnpm --filter @run-walk-coach/shared build
RUN pnpm --filter @run-walk-coach/api build

EXPOSE 4000
CMD ["pnpm", "--filter", "@run-walk-coach/api", "start"]

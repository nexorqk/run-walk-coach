SHELL := /bin/sh

PNPM ?= pnpm
COMPOSE ?= docker compose

API_ENV_PORT := $(shell sed -n 's/^DATABASE_URL=.*localhost:\([0-9][0-9]*\).*/\1/p' apps/api/.env 2>/dev/null | head -n 1)
POSTGRES_PORT ?= $(if $(API_ENV_PORT),$(API_ENV_PORT),5432)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install pnpm and project dependencies
	corepack enable
	corepack prepare pnpm@9.15.4 --activate
	$(PNPM) install

.PHONY: env
env: ## Create local env files from examples when missing
	@if [ ! -f apps/api/.env ]; then cp apps/api/.env.example apps/api/.env; echo "Created apps/api/.env"; fi
	@if [ ! -f apps/web/.env ]; then cp apps/web/.env.example apps/web/.env; echo "Created apps/web/.env"; fi

.PHONY: setup
setup: install env db-up db-wait db-migrate db-seed ## Install deps, start Postgres, migrate, and seed

.PHONY: start
start: env db-up db-wait dev ## Start Postgres, API, and web app

.PHONY: run
run: start ## Alias for start

.PHONY: dev
dev: env ## Run API and web dev servers
	$(PNPM) dev

.PHONY: dev-web
dev-web: env ## Run only the web dev server
	$(PNPM) dev:web

.PHONY: dev-api
dev-api: env ## Run only the API dev server
	$(PNPM) dev:api

.PHONY: build
build: ## Build all workspaces
	$(PNPM) build

.PHONY: lint
lint: ## Run TypeScript lint checks
	$(PNPM) lint

.PHONY: typecheck
typecheck: ## Run TypeScript type checks
	$(PNPM) typecheck

.PHONY: check
check: lint typecheck test ## Run all static checks and tests

.PHONY: test
test: ## Run automated tests
	$(PNPM) test

.PHONY: db-up
db-up: ## Start local PostgreSQL
	POSTGRES_PORT=$(POSTGRES_PORT) $(COMPOSE) up -d postgres

.PHONY: db-wait
db-wait: ## Wait until local PostgreSQL is ready
	@for i in $$(seq 1 30); do \
		if $(COMPOSE) exec -T postgres pg_isready -U runwalk -d runwalk >/dev/null 2>&1; then \
			echo "Postgres is ready"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "Postgres did not become ready"; \
	exit 1

.PHONY: db-down
db-down: ## Stop local PostgreSQL
	$(COMPOSE) stop postgres

.PHONY: db-logs
db-logs: ## Follow PostgreSQL logs
	$(COMPOSE) logs -f postgres

.PHONY: db-migrate
db-migrate: env ## Run Prisma development migrations
	$(PNPM) db:migrate

.PHONY: db-deploy
db-deploy: env ## Deploy Prisma migrations
	$(PNPM) --filter @run-walk-coach/api db:deploy

.PHONY: db-seed
db-seed: env ## Seed the database
	$(PNPM) db:seed

.PHONY: db-studio
db-studio: env ## Open Prisma Studio
	$(PNPM) --filter @run-walk-coach/api exec prisma studio --schema prisma/schema.prisma

.PHONY: db-backup
db-backup: env ## Create a database backup dump
	set -a; . apps/api/.env; set +a; ./scripts/db-backup.sh

.PHONY: maintenance-cleanup
maintenance-cleanup: env ## Delete expired sessions and abandoned anonymous users
	$(PNPM) --filter @run-walk-coach/api maintenance:cleanup

.PHONY: db-restore
db-restore: env ## Restore a database backup dump: make db-restore BACKUP=path
	@test -n "$(BACKUP)" || (echo "BACKUP is required"; exit 1)
	set -a; . apps/api/.env; set +a; BACKUP="$(BACKUP)" ./scripts/db-restore.sh

.PHONY: prisma-generate
prisma-generate: env ## Generate Prisma client
	$(PNPM) --filter @run-walk-coach/api prisma:generate

.PHONY: docker-up
docker-up: ## Build and start Docker services
	$(COMPOSE) up --build -d

.PHONY: docker-down
docker-down: ## Stop Docker services
	$(COMPOSE) down

.PHONY: docker-logs
docker-logs: ## Follow Docker service logs
	$(COMPOSE) logs -f

.PHONY: health
health: ## Check API health endpoint
	curl -fsS http://localhost:4000/api/health

.PHONY: clean
clean: ## Remove generated build output
	rm -rf apps/api/dist apps/web/dist packages/shared/dist

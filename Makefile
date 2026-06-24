SHELL := /bin/sh

PNPM ?= pnpm
COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help
help:
	@printf "Usage: make <target>\n\n"
	@printf "Targets:\n"
	@printf "  check         Run typecheck and tests\n"
	@printf "  up            Build and start Docker services\n"
	@printf "  down          Stop Docker services\n"
	@printf "  logs          Follow Docker logs\n"
	@printf "  health        Check local API readiness\n"
	@printf "  clean         Remove build output\n"

.PHONY: check
check:
	$(PNPM) typecheck
	$(PNPM) test

.PHONY: up
up:
	$(COMPOSE) up -d --build

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: health
health:
	curl -fsS http://localhost:4000/api/health/ready

.PHONY: clean
clean:
	rm -rf apps/api/dist apps/web/dist packages/shared/dist

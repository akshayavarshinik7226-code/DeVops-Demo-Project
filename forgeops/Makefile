# Shortcuts for local development. Run `make help` to list them.
.PHONY: help up seed down logs ps test lint fmt web-dev api-dev worker-dev smoke clean

help:  ## show this list
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-12s %s\n",$$1,$$2}'

up:  ## build and start the whole stack with Docker (http://localhost:8080)
	@test -f .env || cp .env.example .env
	docker compose up -d --build
	docker compose run --rm seed

seed:  ## load the 441 fictional employees (skips if already loaded)
	docker compose run --rm seed

down:  ## stop the stack (data is kept in the pgdata volume)
	docker compose down

logs:  ## follow api and worker logs
	docker compose logs -f api worker

ps:  ## show containers and health
	docker compose ps

test:  ## run the API tests
	cd api && python -m pytest -q

lint:  ## ruff lint + format check, shellcheck
	ruff check . && ruff format --check .
	shellcheck -x -S warning ops/scripts/*.sh

fmt:  ## auto-format Python
	ruff format . && ruff check --fix .

api-dev:  ## run the API without Docker (needs local PostgreSQL + Redis, see README)
	cd api && uvicorn app.main:app --reload --port 8000

worker-dev:  ## run the worker without Docker
	python worker/worker.py

web-dev:  ## run the web app with hot reload on http://localhost:5173
	cd web && npm install && npm run dev

smoke:  ## smoke-test a running stack: make smoke URL=http://localhost:8080
	ops/scripts/smoke.sh $(or $(URL),http://localhost:8080)

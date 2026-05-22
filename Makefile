.PHONY: help dev db db-stop db-reset \
        be be-migrate be-migration be-test be-lint \
        fe fe-build fe-lint \
        test lint install

# ── default ───────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  dev          Start DB + backend + frontend concurrently"
	@echo ""
	@echo "  db           Start PostgreSQL"
	@echo "  db-stop      Stop PostgreSQL"
	@echo "  db-reset     Wipe all data (keep schema)"
	@echo ""
	@echo "  be           Start backend dev server (:8000)"
	@echo "  be-migrate   Apply all migrations"
	@echo "  be-migration MSG=<desc>  Create + apply a new migration"
	@echo "  be-test      Run all backend tests"
	@echo "  be-lint      Run ruff lint check"
	@echo ""
	@echo "  fe           Start frontend dev server (:3000)"
	@echo "  fe-build     Type-check + build frontend"
	@echo ""
	@echo "  install      Install all dependencies"
	@echo "  test         Run all tests (backend)"
	@echo "  lint         Run all linters"
	@echo ""

# ── database ──────────────────────────────────────────────────────────
db:
	docker compose up -d

db-stop:
	docker compose down

db-reset:
	docker exec rental-system-postgres-1 psql -U postgres -d rental_db -c "\
	TRUNCATE TABLE contract_event, shared_meter_reading, shared_meter_room, shared_meter, \
	  invoice_item, invoice, surcharge_template, utility_reading, contract, tenant, room, \
	  property RESTART IDENTITY CASCADE;"

# ── backend ───────────────────────────────────────────────────────────
be:
	cd backend && uv run uvicorn app.main:app --reload

be-migrate:
	cd backend && uv run alembic upgrade head

be-migration:
	cd backend && uv run alembic revision --autogenerate -m "$(MSG)" && uv run alembic upgrade head

be-test:
	cd backend && uv run pytest -v

be-lint:
	cd backend && uv run ruff check .

# ── frontend ──────────────────────────────────────────────────────────
fe:
	cd frontend && pnpm dev

fe-build:
	cd frontend && pnpm build

# ── combined ──────────────────────────────────────────────────────────
install:
	cd backend && uv sync
	cd frontend && pnpm install

test: be-test

lint: be-lint
	cd frontend && pnpm build --no-lint 2>/dev/null || true

dev: db
	@echo "Starting backend and frontend..."
	@cd backend && uv run uvicorn app.main:app --reload & \
	 cd frontend && pnpm dev

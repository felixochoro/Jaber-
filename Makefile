.PHONY: up down build ingest logs test lint clean

# ── Local dev ────────────────────────────────────────────────────────────────
up:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# ── Data ingestion ────────────────────────────────────────────────────────────
# Usage: make ingest FILE=/path/to/workbook.xlsx
ingest:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make ingest FILE=/path/to/schools.xlsx"; exit 1; fi
	cp "$(FILE)" ./data/schools.xlsx
	docker compose --profile ingest run --rm etl python ingest.py --file /data/schools.xlsx

ingest-local:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make ingest-local FILE=/path/to/schools.xlsx"; exit 1; fi
	cd etl && pip install -r requirements.txt -q && \
		SYNC_DATABASE_URL=$(shell grep SYNC_DATABASE_URL .env | cut -d= -f2-) \
		python ingest.py --file "$(FILE)"

# ── Tests ─────────────────────────────────────────────────────────────────────
test-backend:
	docker compose exec backend pytest tests/ -v

test-frontend:
	docker compose exec frontend npm run test

test: test-backend test-frontend

# ── Linting ───────────────────────────────────────────────────────────────────
lint-backend:
	docker compose exec backend ruff check app/

lint-frontend:
	docker compose exec frontend npm run lint

lint: lint-backend lint-frontend

# ── DB ────────────────────────────────────────────────────────────────────────
db-shell:
	docker compose exec db psql -U postgres -d schoolconnect

db-reset:
	docker compose down -v && docker compose up -d db

# ── Misc ──────────────────────────────────────────────────────────────────────
clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .next -exec rm -rf {} +

setup: ## First-time setup
	cp -n .env.example .env || true
	mkdir -p data
	docker compose up -d db redis
	@echo "Waiting for DB..."
	sleep 5
	@echo "Ready! Run: make ingest FILE=/path/to/workbook.xlsx"

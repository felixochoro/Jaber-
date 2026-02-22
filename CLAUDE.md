# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: SchoolConnect Atlas

A production-grade, map-first web platform for Zambia school connectivity data.
**Stack**: Next.js 14 + TypeScript (frontend) · FastAPI + Python (backend) · PostgreSQL + PostGIS (database) · Redis (cache) · Docker Compose.

## Repository Structure

```
backend/        FastAPI API (Python)
etl/            Excel → PostGIS ingestion script
db/migrations/  SQL schema + indexes (run automatically by docker-compose)
frontend/       Next.js 14 App Router (TypeScript)
data/           Drop Excel workbook here (gitignored)
```

## Common Commands

### Local development (Docker)
```bash
docker compose up --build -d    # Start all services
docker compose logs -f          # Tail logs
docker compose down             # Stop
```

### Data ingestion
```bash
# Copy workbook, then:
make ingest FILE=/path/to/workbook.xlsx
# Or directly:
docker compose --profile ingest run --rm etl python ingest.py --file /data/schools.xlsx
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # Dev server on :8000
pytest tests/ -v                # Tests
ruff check app/                 # Linter
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev     # Dev server on :3000
npm run build   # Production build
npm run lint    # ESLint
```

### Database
```bash
make db-shell   # psql into the PostGIS container
```

## Key Architecture Decisions

- **PostGIS geometry**: All points are `GEOMETRY(Point, 4326)`. All spatial queries use PostGIS functions (`ST_DWithin`, `ST_MakeEnvelope`, `ST_Distance`).
- **Async SQLAlchemy**: Backend uses `async/await` throughout. Use `asyncpg` driver.
- **Hub matching**: School↔hub links are resolved by fuzzy-matching `HubName` from the schools sheet against hub `site_name` and `hub_site_code`. Match type is recorded (`exact` / `fuzzy` / `unmatched`).
- **Materialized views**: `mv_province_summary` and `mv_hub_demand` are refreshed after each ingestion run. Use `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- **Redis caching**: Cache keys prefixed with `sca:`. Default TTL 5 minutes for lists, 5 minutes for details. Invalidate on data changes.
- **No source data mutation**: Scenario computations return `scenario_*` derived fields; they never overwrite ingested cost columns.
- **Theme system**: CSS custom properties at `:root` driven by `frontend/theme/tokens.ts`. Drop Envato theme CSS into `globals.css` marked section.

## API Conventions

- All API routes: `/api/v1/...`
- Pagination: `?page=1&page_size=50` — response includes `{ data, total, page, page_size, pages }`
- Geo filters: `?bbox=minLon,minLat,maxLon,maxLat` or `?near=lat,lon&radius_km=X`
- Sorting: `?sort_by=<field>&sort_dir=asc|desc`
- Errors: `{ "detail": "message", "code": "optional_code" }`
- Rate limit: 60 req/min per IP (configurable via `RATE_LIMIT_PER_MINUTE`)

## Data Model Notes

- **Admin hierarchy**: Province → District → Constituency → Ward (in that order)
- **HubDist columns**: `hub_dist_km` from Excel; `hub_dist_m` from Excel; `distance_m_computed` in `school_hub_links` is the PostGIS geodesic computation (derived — labelled clearly)
- **Cost fields**: All cost columns from source Excel are stored verbatim. Scenario overrides are computed on request.
- **QA fields**: `coord_valid` is a generated column; `hub_dist_anomaly` is set by ETL QA pass.

## Notes for Claude

- Never mutate source cost columns — label derived fields clearly.
- When adding new API endpoints, follow the existing pattern in `backend/app/routers/`.
- When adding map layers, add them to both `AtlasMap.tsx` and `LayerToggles.tsx`.
- Run `ruff check app/` before committing backend changes.
- Run `npm run lint` before committing frontend changes.
- Spatial indexes are critical for performance — always use `ST_DWithin` with geography cast for radius queries.
- The `mv_province_summary` and `mv_hub_demand` views must be refreshed after any data changes.

## Session Start Hook

Remote Claude Code sessions automatically install dependencies via `.claude/hooks/session-start.sh`.

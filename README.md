# SchoolConnect Atlas

A production-grade, map-first web platform for exploring school connectivity,
telecom infrastructure, and cost data — built initially for Zambia but
architected to support any country by swapping the dataset.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│  Next.js 14 (TypeScript)  ←→  FastAPI (Python)              │
│  Mapbox GL JS                 SQLAlchemy + GeoAlchemy2       │
│  Recharts / SWR               PostgreSQL + PostGIS           │
│  Zustand (global state)       Redis (caching)                │
└─────────────────────────────────────────────────────────────┘
```

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | Next.js 14 App Router + TypeScript      |
| Maps       | Mapbox GL JS + react-map-gl             |
| Charts     | Recharts                                |
| State      | Zustand                                 |
| Backend    | FastAPI + uvicorn                       |
| ORM        | SQLAlchemy 2 (async) + GeoAlchemy2      |
| Database   | PostgreSQL 16 + PostGIS 3.4             |
| Cache      | Redis 7                                 |
| ETL        | Python + pandas + rapidfuzz             |
| Container  | Docker + Docker Compose                 |

---

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Your Excel workbook (see "Data Ingestion" below)
- A Mapbox public token (free tier works): https://account.mapbox.com

### 1. Clone & configure

```bash
git clone <repo>
cd schoolconnect-atlas
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, NEXT_PUBLIC_MAPBOX_TOKEN, API_KEYS
```

### 2. Start services

```bash
docker compose up --build -d
# Services: db (5432), redis (6379), backend (8000), frontend (3000)
```

### 3. Ingest the Excel workbook

```bash
# Copy your Excel file to ./data/
cp /path/to/ZAMBIA_SCHOOL_TOWER_Costing*.xlsx ./data/schools.xlsx

# Run ingestion (runs inside the etl container)
docker compose --profile ingest run --rm etl python ingest.py --file /data/schools.xlsx
```

Or with make:
```bash
make ingest FILE=/path/to/workbook.xlsx
```

### 4. Open the app

| URL                             | Description              |
|---------------------------------|--------------------------|
| http://localhost:3000           | Landing page             |
| http://localhost:3000/map       | Map atlas                |
| http://localhost:3000/dashboards| Analytics dashboard      |
| http://localhost:3000/admin/data-quality | Data QA page  |
| http://localhost:8000/api/docs  | Swagger / OpenAPI docs   |

---

## How Ingestion Works

The ETL script (`etl/ingest.py`) reads three sheets from the Excel workbook:

```
ZAMBIAN_SCHOOLS_CONNECTIVITY  → schools table  (~16k rows)
Hub Site Summary               → hubs table     (~3.6k rows)
Mid Mile                       → mid_mile_nodes table (~251 rows)
```

**Processing pipeline:**
1. Load hubs first (schools reference them).
2. Build a lookup dict: `{normalised_name → hub_id}`.
3. For each school, resolve `HubName` → `hub_id` using:
   - Exact match (case-insensitive)
   - Fuzzy match (token-sort ratio ≥ 80, via rapidfuzz)
   - Unmatched → flagged in `hub_match_type = 'unmatched'`
4. Insert schools with resolved `hub_id`.
5. Generate `school_hub_links` with PostGIS LineString geometry.
6. Generate `hub_midmile_links`.
7. QA pass: flag schools where computed geodesic distance differs from
   source `HubDist` by > 20% → `hub_dist_anomaly = TRUE`.
8. Refresh materialized views (`mv_province_summary`, `mv_hub_demand`).
9. Write an audit record to `ingestion_log`.

**Re-running is safe** — uses `ON CONFLICT ... DO UPDATE`.

---

## How to Replace the Dataset (Another Country)

1. Prepare a workbook with the same three sheet structure:
   - `ZAMBIAN_SCHOOLS_CONNECTIVITY` (or update `SCHOOLS_SHEET` in `etl/ingest.py`)
   - `Hub Site Summary`
   - `Mid Mile`

2. Map your column names in `etl/ingest.py` → `SCHOOLS_COLS`, `HUBS_COLS`, `MIDMILE_COLS`.

3. Update the map center in `frontend/src/components/map/AtlasMap.tsx`:
   ```ts
   const ZAMBIA_CENTER: [number, number] = [27.85, -13.1]; // ← change this
   ```

4. Re-run ingestion with `--reset` to clear old data:
   ```bash
   docker compose --profile ingest run --rm etl \
     python ingest.py --file /data/new_country.xlsx --reset
   ```

---

## API Reference

Full Swagger docs at `http://localhost:8000/api/docs`

### Core Endpoints

```
GET /api/v1/schools
    ?q=&facility_type=&province=&district=&ward=&constituency=
    ?hub_dist_km_lte=&total_cost_lte=&population_gte=
    ?bbox=minLon,minLat,maxLon,maxLat
    ?near=lat,lon&radius_km=
    ?page=&page_size=&sort_by=&sort_dir=

GET /api/v1/schools/{facility_code}
POST /api/v1/schools/compare   body: ["CODE1","CODE2",...]

GET /api/v1/hubs
    ?q=&site_owner=&province=&district=&capacity_gbps_gte=&bbox=
GET /api/v1/hubs/{hub_site_code}

GET /api/v1/mid-mile
GET /api/v1/analytics/summary
GET /api/v1/analytics/gaps          ?hub_dist_km_gt=&province=
GET /api/v1/analytics/hubs/demand
GET /api/v1/analytics/district      ?province=
GET /api/v1/analytics/cost-distribution ?group_by=province|facility_type|transmission

GET /api/v1/export/schools.csv      (all filter params supported)
GET /api/v1/export/hubs.csv

GET /api/v1/meta                    (enum values for dropdowns)
GET /health
```

### Authentication
Privileged endpoints accept `X-API-Key: <key>` header.
Set keys in `.env` → `API_KEYS=key1,key2`.

---

## UI Pages & Flows

### Landing (`/`)
- Key stats (total schools, hubs, coverage %, median cost)
- Quick search bar → flies to `/map?q=...`
- Province summary table with links into map

### Map Atlas (`/map`)
- **Left panel**: filter controls (province, district, type, distance, cost, transmission)
  + live school list + CSV export
- **Main**: Mapbox GL map with:
  - School points (colored by facility type)
  - Hub points (colored by site owner)
  - School→hub LineString links
  - Mid-mile node points
  - Cluster mode (toggle)
  - Heatmap mode (total cost / hub distance / population)
  - Layer toggles (top-right card)
- **Right panel**: slides in on click — school detail card with hub info,
  cost breakdown, connectivity recommendation; hub detail with linked schools

### School Detail (`/schools/[facility_code]`)
- Full metadata, admin hierarchy, coordinates
- Hub proximity badge + linked hub card
- Connectivity recommendation panel (cheapest option + rationale)
- Full cost breakdown (all cost fields from source)
- Links to hub detail + map

### Hub Detail (`/hubs/[hub_site_code]`)
- Hub info, owner, capacity, links
- Table of linked schools (ordered by distance)
- Mid-mile nodes list

### Analytics Dashboard (`/dashboards`)
- Platform stats cards
- Province bar chart (schools + with-hub)
- Facility type pie chart
- Cost distribution chart (group by province / type / transmission)
- Province summary table
- Hub demand ranking table

### Data Quality (`/admin/data-quality`)
- QA summary cards (invalid coords, unmatched hubs, beyond 10km)
- Configurable distance threshold gap analysis
- Issue-tagged school table with export

---

## Intelligence Features

### Connectivity Recommendation
`GET /api/v1/schools/{code}` returns `connectivity_recommendation`:
- If source `Transmission` field is set → surface it + explain
- Otherwise, compare fiber/microwave/satellite costs
- Flag if hub distance makes a cheaper option impractical
- Plain-language explanation displayed in UI

### Scenario Switcher
`POST /api/v1/analytics/scenario` (extend as needed):
- Override `cost_per_meter` → recomputes fiber cost against hub distance
- Set `satellite_opex_years` / `power_opex_years` → aggregates OPEX
- Returns `scenario_*` fields — **never overwrites source values**

### QA Flags
Automatically computed during ingestion:
- `coord_valid` — lat/lon within valid range
- `hub_dist_anomaly` — computed geodesic distance differs from source > 20%

---

## Theme System (Envato Adapter)

All visual tokens live in `frontend/theme/tokens.ts`:
- Color palette (brand, surface, text, border)
- Typography, border-radius, spacing, shadows
- Mapbox map style URL

To integrate an Envato theme:
1. Fill in `envatoThemePlaceholder` in `theme/tokens.ts`
2. Drop Envato CSS into the marked section of `src/app/globals.css`
3. The Tailwind classes auto-pick up the updated CSS variables

---

## Development

```bash
# Backend only (hot reload)
cd backend && uvicorn app.main:app --reload

# Frontend only
cd frontend && npm run dev

# ETL dry-run (inspect file, no DB writes)
cd etl && python ingest.py --file /path/to/workbook.xlsx --dry-run

# DB shell
make db-shell

# Run backend tests
make test-backend
```

---

## Project Structure

```
├── backend/              FastAPI backend
│   ├── app/
│   │   ├── main.py       App factory, middleware, routes
│   │   ├── config.py     Settings (pydantic-settings)
│   │   ├── database.py   Async SQLAlchemy engine
│   │   ├── models/       ORM models
│   │   ├── schemas/      Pydantic schemas
│   │   ├── routers/      API routers (schools, hubs, analytics, export)
│   │   ├── services/     Cache, recommendation engine
│   │   └── middleware/   Auth (API key)
│   └── Dockerfile
├── etl/
│   └── ingest.py         Excel → PostgreSQL ingestion script
├── db/
│   └── migrations/       SQL migration files (run by PostGIS image)
│       ├── 001_initial.sql
│       └── 002_indexes.sql
├── frontend/             Next.js 14 frontend
│   ├── theme/            Design tokens + Envato adapter
│   ├── src/
│   │   ├── app/          Next.js App Router pages
│   │   ├── components/   Map, layout, cards, analytics
│   │   ├── lib/          API client, Zustand store, utils
│   │   └── types/        TypeScript types
│   └── Dockerfile
├── data/                 Put your Excel file here (gitignored)
├── docker-compose.yml
├── .env.example
├── Makefile
└── README.md
```

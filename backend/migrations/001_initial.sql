-- ============================================================
-- SchoolConnect Atlas — Initial Schema
-- PostgreSQL + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy matching
CREATE EXTENSION IF NOT EXISTS unaccent;  -- accent-insensitive search

-- ── Hubs (telecom tower / aggregation sites) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS hubs (
    id                  SERIAL PRIMARY KEY,
    hub_site_code       TEXT UNIQUE,          -- from "Hub Site Code"
    site_name           TEXT NOT NULL,
    site_owner          TEXT,
    fiber_links         INTEGER,
    microwave_links     INTEGER,
    total_links         INTEGER,
    latitude            DOUBLE PRECISION,
    longitude           DOUBLE PRECISION,
    geom                GEOMETRY(Point, 4326),
    district            TEXT,
    province            TEXT,
    aggregate_capacity_mbps DOUBLE PRECISION,
    aggregate_capacity_gbps DOUBLE PRECISION,
    -- QA
    coord_valid         BOOLEAN GENERATED ALWAYS AS (
                            latitude IS NOT NULL AND longitude IS NOT NULL
                            AND latitude BETWEEN -90 AND 90
                            AND longitude BETWEEN -180 AND 180
                        ) STORED,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Mid-mile nodes (Zesco substations / backhaul anchors) ────────────────────
CREATE TABLE IF NOT EXISTS mid_mile_nodes (
    id                          SERIAL PRIMARY KEY,
    zesco_substation_id         TEXT,
    location                    TEXT,
    district                    TEXT,
    province                    TEXT,
    latitude                    DOUBLE PRECISION,  -- from POINT_Y
    longitude                   DOUBLE PRECISION,  -- from POINT_X
    geom                        GEOMETRY(Point, 4326),
    hub_name                    TEXT,              -- text reference to hub
    hub_id                      INTEGER REFERENCES hubs(id) ON DELETE SET NULL,
    los_distance_m              DOUBLE PRECISION,
    routing_distance_m          DOUBLE PRECISION,
    total_distance_m            DOUBLE PRECISION,
    avg_cost_per_meter          DOUBLE PRECISION,
    total_fiber_deployment_cost DOUBLE PRECISION,
    active_dwdm_equipment_cost  DOUBLE PRECISION,
    ip_aggregator_router_cost   DOUBLE PRECISION,
    total_active_equipment_cost DOUBLE PRECISION,
    avg_microwave_links_to_hub  DOUBLE PRECISION,
    unit_cost_microwave_1g      DOUBLE PRECISION,
    total_microwave_cost        DOUBLE PRECISION,
    access_router_cost          DOUBLE PRECISION,
    lease_fibercomm_per_month   DOUBLE PRECISION,
    power_upgrade_per_hub       DOUBLE PRECISION,
    total_cost                  DOUBLE PRECISION,
    coord_valid                 BOOLEAN GENERATED ALWAYS AS (
                                    latitude IS NOT NULL AND longitude IS NOT NULL
                                    AND latitude BETWEEN -90 AND 90
                                    AND longitude BETWEEN -180 AND 180
                                ) STORED,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Schools ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
    id                      SERIAL PRIMARY KEY,
    facility_code           TEXT UNIQUE NOT NULL,
    name                    TEXT NOT NULL,
    facility_type           TEXT,
    province                TEXT,
    district                TEXT,
    constituency            TEXT,
    ward                    TEXT,
    latitude                DOUBLE PRECISION,
    longitude               DOUBLE PRECISION,
    geom                    GEOMETRY(Point, 4326),
    -- Nearest hub (as recorded in source data)
    hub_name                TEXT,
    hub_dist_km             DOUBLE PRECISION,
    hub_dist_m              DOUBLE PRECISION,
    -- Resolved hub FK (best-effort matched)
    hub_id                  INTEGER REFERENCES hubs(id) ON DELETE SET NULL,
    hub_match_type          TEXT,  -- 'exact', 'fuzzy', 'unmatched'
    -- Demand
    population              INTEGER,
    households              INTEGER,
    -- Connectivity / cost fields (raw from source)
    transmission            TEXT,
    fiber_cost              DOUBLE PRECISION,
    microwave_cost          DOUBLE PRECISION,
    satellite_hardware_cost DOUBLE PRECISION,
    satellite_opex_cost     DOUBLE PRECISION,
    lan_cost                DOUBLE PRECISION,
    power_cost              DOUBLE PRECISION,
    power_opex              DOUBLE PRECISION,
    zamtel_internet_lease   DOUBLE PRECISION,
    managed_service_maint   DOUBLE PRECISION,
    total_cost              DOUBLE PRECISION,
    -- QA flags
    coord_valid             BOOLEAN GENERATED ALWAYS AS (
                                latitude IS NOT NULL AND longitude IS NOT NULL
                                AND latitude BETWEEN -90 AND 90
                                AND longitude BETWEEN -180 AND 180
                            ) STORED,
    hub_dist_anomaly        BOOLEAN DEFAULT FALSE,  -- set by ETL QA pass
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── School ↔ Hub links ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_hub_links (
    id                  SERIAL PRIMARY KEY,
    school_id           INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    hub_id              INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    line_geom           GEOMETRY(LineString, 4326),
    distance_m_source   DOUBLE PRECISION,  -- from source file
    distance_m_computed DOUBLE PRECISION,  -- geodesic computation (derived)
    match_type          TEXT,
    UNIQUE (school_id, hub_id)
);

-- ── Hub ↔ Mid-mile links ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hub_midmile_links (
    id                  SERIAL PRIMARY KEY,
    hub_id              INTEGER NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
    midmile_id          INTEGER NOT NULL REFERENCES mid_mile_nodes(id) ON DELETE CASCADE,
    line_geom           GEOMETRY(LineString, 4326),
    los_distance_m      DOUBLE PRECISION,
    routing_distance_m  DOUBLE PRECISION,
    total_distance_m    DOUBLE PRECISION,
    total_cost          DOUBLE PRECISION,
    UNIQUE (hub_id, midmile_id)
);

-- ── Scenario cost overrides (for "scenario switcher" feature) ────────────────
CREATE TABLE IF NOT EXISTS scenario_configs (
    id                          SERIAL PRIMARY KEY,
    name                        TEXT NOT NULL,
    description                 TEXT,
    cost_per_meter_override     DOUBLE PRECISION,
    satellite_opex_years        INTEGER DEFAULT 5,
    power_opex_years            INTEGER DEFAULT 5,
    active                      BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Ingestion audit log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_log (
    id              SERIAL PRIMARY KEY,
    run_at          TIMESTAMPTZ DEFAULT NOW(),
    source_file     TEXT,
    schools_loaded  INTEGER,
    hubs_loaded     INTEGER,
    midmile_loaded  INTEGER,
    links_created   INTEGER,
    unmatched_hubs  INTEGER,
    errors          JSONB,
    duration_s      DOUBLE PRECISION
);

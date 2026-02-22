-- ============================================================
-- SchoolConnect Atlas — Spatial & Performance Indexes
-- ============================================================

-- ── Spatial indexes (GIST) ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schools_geom      ON schools      USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hubs_geom         ON hubs         USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_midmile_geom      ON mid_mile_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_school_hub_line   ON school_hub_links USING GIST (line_geom);
CREATE INDEX IF NOT EXISTS idx_hub_midmile_line  ON hub_midmile_links USING GIST (line_geom);

-- ── B-tree indexes for filter fields ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_schools_province      ON schools (province);
CREATE INDEX IF NOT EXISTS idx_schools_district      ON schools (district);
CREATE INDEX IF NOT EXISTS idx_schools_constituency  ON schools (constituency);
CREATE INDEX IF NOT EXISTS idx_schools_ward          ON schools (ward);
CREATE INDEX IF NOT EXISTS idx_schools_type          ON schools (facility_type);
CREATE INDEX IF NOT EXISTS idx_schools_hub_id        ON schools (hub_id);
CREATE INDEX IF NOT EXISTS idx_schools_hub_name      ON schools (hub_name);
CREATE INDEX IF NOT EXISTS idx_schools_hub_dist_km   ON schools (hub_dist_km);
CREATE INDEX IF NOT EXISTS idx_schools_total_cost    ON schools (total_cost);
CREATE INDEX IF NOT EXISTS idx_schools_transmission  ON schools (transmission);
CREATE INDEX IF NOT EXISTS idx_schools_coord_valid   ON schools (coord_valid);

CREATE INDEX IF NOT EXISTS idx_hubs_province         ON hubs (province);
CREATE INDEX IF NOT EXISTS idx_hubs_district         ON hubs (district);
CREATE INDEX IF NOT EXISTS idx_hubs_site_owner       ON hubs (site_owner);
CREATE INDEX IF NOT EXISTS idx_hubs_coord_valid      ON hubs (coord_valid);

CREATE INDEX IF NOT EXISTS idx_midmile_province      ON mid_mile_nodes (province);
CREATE INDEX IF NOT EXISTS idx_midmile_district      ON mid_mile_nodes (district);
CREATE INDEX IF NOT EXISTS idx_midmile_hub_id        ON mid_mile_nodes (hub_id);

-- ── Full-text search ──────────────────────────────────────────────────────────
ALTER TABLE schools      ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR;
ALTER TABLE hubs         ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR;

-- Update FTS vectors for schools
UPDATE schools SET fts_vector =
    to_tsvector('english',
        coalesce(name, '') || ' ' ||
        coalesce(facility_code, '') || ' ' ||
        coalesce(district, '') || ' ' ||
        coalesce(province, '') || ' ' ||
        coalesce(ward, '') || ' ' ||
        coalesce(constituency, '')
    );

-- Update FTS vectors for hubs
UPDATE hubs SET fts_vector =
    to_tsvector('english',
        coalesce(site_name, '') || ' ' ||
        coalesce(hub_site_code, '') || ' ' ||
        coalesce(district, '') || ' ' ||
        coalesce(province, '')
    );

CREATE INDEX IF NOT EXISTS idx_schools_fts ON schools USING GIN (fts_vector);
CREATE INDEX IF NOT EXISTS idx_hubs_fts    ON hubs    USING GIN (fts_vector);

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm    ON schools USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hubs_name_trgm       ON hubs    USING GIN (site_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hubs_code_trgm       ON hubs    USING GIN (hub_site_code gin_trgm_ops);

-- ── Triggers: keep FTS up to date ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION schools_fts_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.fts_vector := to_tsvector('english',
        coalesce(NEW.name, '') || ' ' ||
        coalesce(NEW.facility_code, '') || ' ' ||
        coalesce(NEW.district, '') || ' ' ||
        coalesce(NEW.province, '') || ' ' ||
        coalesce(NEW.ward, '') || ' ' ||
        coalesce(NEW.constituency, '')
    );
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_schools_fts ON schools;
CREATE TRIGGER trig_schools_fts
    BEFORE INSERT OR UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION schools_fts_update();

CREATE OR REPLACE FUNCTION hubs_fts_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.fts_vector := to_tsvector('english',
        coalesce(NEW.site_name, '') || ' ' ||
        coalesce(NEW.hub_site_code, '') || ' ' ||
        coalesce(NEW.district, '') || ' ' ||
        coalesce(NEW.province, '')
    );
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_hubs_fts ON hubs;
CREATE TRIGGER trig_hubs_fts
    BEFORE INSERT OR UPDATE ON hubs
    FOR EACH ROW EXECUTE FUNCTION hubs_fts_update();

-- ── Materialized view: province-level summary (refreshed after ingest) ────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_province_summary AS
SELECT
    province,
    COUNT(*)                                        AS school_count,
    COUNT(*) FILTER (WHERE hub_id IS NOT NULL)      AS schools_with_hub,
    COUNT(*) FILTER (WHERE hub_dist_km <= 1)        AS within_1km,
    COUNT(*) FILTER (WHERE hub_dist_km <= 5)        AS within_5km,
    COUNT(*) FILTER (WHERE hub_dist_km <= 10)       AS within_10km,
    COUNT(*) FILTER (WHERE hub_dist_km > 10)        AS beyond_10km,
    COUNT(*) FILTER (WHERE NOT coord_valid)         AS invalid_coords,
    ROUND(AVG(hub_dist_km)::NUMERIC, 2)             AS avg_hub_dist_km,
    ROUND(AVG(total_cost)::NUMERIC, 2)              AS avg_total_cost,
    SUM(population)                                 AS total_population,
    SUM(households)                                 AS total_households,
    COUNT(DISTINCT district)                        AS district_count,
    COUNT(DISTINCT facility_type)                   AS facility_type_count
FROM schools
GROUP BY province
ORDER BY school_count DESC
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_province_summary ON mv_province_summary (province);

-- ── Materialized view: hub capacity vs demand ─────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hub_demand AS
SELECT
    h.id              AS hub_id,
    h.hub_site_code,
    h.site_name,
    h.province,
    h.district,
    h.aggregate_capacity_gbps,
    COUNT(s.id)       AS linked_schools,
    SUM(s.population) AS total_population,
    AVG(s.hub_dist_km)AS avg_dist_km
FROM hubs h
LEFT JOIN schools s ON s.hub_id = h.id
GROUP BY h.id, h.hub_site_code, h.site_name, h.province, h.district, h.aggregate_capacity_gbps
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_hub_demand ON mv_hub_demand (hub_id);

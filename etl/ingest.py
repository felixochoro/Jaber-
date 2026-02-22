#!/usr/bin/env python3
"""
SchoolConnect Atlas — Data Ingestion Script
Reads the Excel workbook and loads normalized data into PostgreSQL + PostGIS.

Usage:
    python ingest.py --file /path/to/workbook.xlsx [--reset] [--dry-run]
"""

import argparse
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2
import psycopg2.extras
from rapidfuzz import fuzz, process

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("ingest")


# ── Column maps (normalise Excel header variants) ─────────────────────────────
SCHOOLS_SHEET = "ZAMBIAN_SCHOOLS_CONNECTIVITY"
HUBS_SHEET    = "Hub Site Summary"
MIDMILE_SHEET = "Mid Mile"

SCHOOLS_COLS = {
    "Facility Name":                    "name",
    "Facility Type":                    "facility_type",
    "Province":                         "province",
    "District":                         "district",
    "Constituency":                     "constituency",
    "Ward":                             "ward",
    "Latitude":                         "latitude",
    "Longitude":                        "longitude",
    "Facility_CODE":                    "facility_code",
    "HubName":                          "hub_name",
    "HubDist (Km)":                     "hub_dist_km",
    "HubDist (m)":                      "hub_dist_m",
    "Household":                        "households",
    "Population":                       "population",
    "Transmission":                     "transmission",
    "Fiber Cost ($)":                   "fiber_cost",
    "Microwave Cost ($)":               "microwave_cost",
    "Satellite Hardware Cost ($)":      "satellite_hardware_cost",
    "Satellite OPEX Cost ($)":          "satellite_opex_cost",
    "LAN Cost ($)":                     "lan_cost",
    "Power Cost ($)":                   "power_cost",
    "Power OPEX ($)":                   "power_opex",
    "Zamtel Internet Lease 20Mbps ($)": "zamtel_internet_lease",
    "Managed Service Maintenance ($)":  "managed_service_maint",
    "Total ($)":                        "total_cost",
}

HUBS_COLS = {
    "Hub Site Code":            "hub_site_code",
    "Site Name":                "site_name",
    "Site Owner":               "site_owner",
    "Fiber Links":              "fiber_links",
    "Microwave Links":          "microwave_links",
    "Total links":              "total_links",
    "Latitude":                 "latitude",
    "Longitude":                "longitude",
    "District":                 "district",
    "Province":                 "province",
    "Aggregate Capacity (Mbps)":"aggregate_capacity_mbps",
    "Aggregate Capacity (Gbps)":"aggregate_capacity_gbps",
}

MIDMILE_COLS = {
    "Zesco Substation ID":                  "zesco_substation_id",
    "LOCATION":                             "location",
    "DISTRICT":                             "district",
    "Province":                             "province",
    "POINT_Y":                              "latitude",
    "POINT_X":                              "longitude",
    "HubName":                              "hub_name",
    "LOS Distance (m)":                     "los_distance_m",
    "Routing Distance (m)":                 "routing_distance_m",
    "Total Distance(m)":                    "total_distance_m",
    "Average Cost per meter ($)":           "avg_cost_per_meter",
    "Total Fiber Deployment Cost":          "total_fiber_deployment_cost",
    "Active DWDM Equipment Cost ($)":       "active_dwdm_equipment_cost",
    "IP Aggregator Router Cost ($)":        "ip_aggregator_router_cost",
    "Total Active Equipment Cost":          "total_active_equipment_cost",
    "Average Number of Microwave links to Hub": "avg_microwave_links_to_hub",
    "Unit Cost of Microwave 1G Link ($)":   "unit_cost_microwave_1g",
    "Total Microwave Cost ($)":             "total_microwave_cost",
    "Access Router ($)":                    "access_router_cost",
    "1G Lease Fibercomm per Month ($)":     "lease_fibercomm_per_month",
    "Power Upgrade per Hub ($)":            "power_upgrade_per_hub",
    "Total Cost":                           "total_cost",
}


@dataclass
class IngestStats:
    schools_loaded:  int = 0
    hubs_loaded:     int = 0
    midmile_loaded:  int = 0
    links_created:   int = 0
    unmatched_hubs:  int = 0
    errors:          list = field(default_factory=list)
    start_time:      float = field(default_factory=time.time)

    def duration(self) -> float:
        return round(time.time() - self.start_time, 2)


def clean_str(val) -> Optional[str]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return str(val).strip() or None


def clean_float(val) -> Optional[float]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def clean_int(val) -> Optional[int]:
    f = clean_float(val)
    return int(f) if f is not None else None


def is_valid_coord(lat, lon) -> bool:
    if lat is None or lon is None:
        return False
    return -90 <= lat <= 90 and -180 <= lon <= 180


def normalise_columns(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Rename known columns; strip whitespace from all headers."""
    df.columns = [c.strip() for c in df.columns]
    rename = {k: v for k, v in col_map.items() if k in df.columns}
    return df.rename(columns=rename)


def fuzzy_match_hub(hub_name: str, hub_lookup: dict, threshold: int = 80):
    """
    Returns (hub_id, match_type) or (None, 'unmatched').
    hub_lookup: {normalised_name: hub_id}
    """
    if not hub_name:
        return None, "unmatched"

    norm = hub_name.strip().lower()

    # 1. Exact match
    if norm in hub_lookup:
        return hub_lookup[norm], "exact"

    # 2. Fuzzy match
    candidates = list(hub_lookup.keys())
    result = process.extractOne(norm, candidates, scorer=fuzz.token_sort_ratio)
    if result and result[1] >= threshold:
        return hub_lookup[result[0]], "fuzzy"

    return None, "unmatched"


def load_excel(file_path: str) -> dict[str, pd.DataFrame]:
    """Load all three sheets from the workbook."""
    log.info(f"Loading workbook: {file_path}")
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {file_path}")

    xl = pd.ExcelFile(file_path)
    sheets = {}
    for sheet in [SCHOOLS_SHEET, HUBS_SHEET, MIDMILE_SHEET]:
        matching = [s for s in xl.sheet_names if sheet.lower() in s.lower()]
        if not matching:
            log.warning(f"Sheet not found: {sheet}")
            continue
        df = pd.read_excel(file_path, sheet_name=matching[0], dtype=str)
        df = df.where(pd.notnull(df), None)
        sheets[sheet] = df
        log.info(f"  Sheet '{matching[0]}': {len(df)} rows, {len(df.columns)} columns")
    return sheets


def upsert_hubs(cur, df: pd.DataFrame, stats: IngestStats) -> dict:
    """
    Insert hubs. Returns lookup dict: {normalised_name: hub_id, code: hub_id}.
    """
    df = normalise_columns(df, HUBS_COLS)
    lookup: dict[str, int] = {}

    sql = """
        INSERT INTO hubs (hub_site_code, site_name, site_owner,
                          fiber_links, microwave_links, total_links,
                          latitude, longitude, geom,
                          district, province,
                          aggregate_capacity_mbps, aggregate_capacity_gbps)
        VALUES (%s,%s,%s, %s,%s,%s, %s,%s,
                ST_SetSRID(ST_MakePoint(%s,%s),4326),
                %s,%s, %s,%s)
        ON CONFLICT (hub_site_code) DO UPDATE SET
            site_name               = EXCLUDED.site_name,
            site_owner              = EXCLUDED.site_owner,
            fiber_links             = EXCLUDED.fiber_links,
            microwave_links         = EXCLUDED.microwave_links,
            total_links             = EXCLUDED.total_links,
            latitude                = EXCLUDED.latitude,
            longitude               = EXCLUDED.longitude,
            geom                    = EXCLUDED.geom,
            district                = EXCLUDED.district,
            province                = EXCLUDED.province,
            aggregate_capacity_mbps = EXCLUDED.aggregate_capacity_mbps,
            aggregate_capacity_gbps = EXCLUDED.aggregate_capacity_gbps,
            updated_at              = NOW()
        RETURNING id, hub_site_code, site_name
    """

    batch = []
    for _, row in df.iterrows():
        code = clean_str(row.get("hub_site_code")) or f"UNKNOWN-{_}"
        name = clean_str(row.get("site_name")) or code
        lat  = clean_float(row.get("latitude"))
        lon  = clean_float(row.get("longitude"))

        # geom only valid if coords valid
        if not is_valid_coord(lat, lon):
            lat = lon = None

        batch.append((
            code,
            name,
            clean_str(row.get("site_owner")),
            clean_int(row.get("fiber_links")),
            clean_int(row.get("microwave_links")),
            clean_int(row.get("total_links")),
            lat, lon,
            lon, lat,  # ST_MakePoint(lon, lat)
            clean_str(row.get("district")),
            clean_str(row.get("province")),
            clean_float(row.get("aggregate_capacity_mbps")),
            clean_float(row.get("aggregate_capacity_gbps")),
        ))

    psycopg2.extras.execute_batch(cur, sql, batch, page_size=500)

    # Build lookup
    cur.execute("SELECT id, hub_site_code, site_name FROM hubs")
    for row in cur.fetchall():
        hub_id, code, name = row
        if code:
            lookup[code.strip().lower()] = hub_id
        if name:
            lookup[name.strip().lower()] = hub_id

    stats.hubs_loaded = len(df)
    log.info(f"Hubs upserted: {stats.hubs_loaded}")
    return lookup


def upsert_mid_mile(cur, df: pd.DataFrame, hub_lookup: dict, stats: IngestStats):
    df = normalise_columns(df, MIDMILE_COLS)

    sql = """
        INSERT INTO mid_mile_nodes (
            zesco_substation_id, location, district, province,
            latitude, longitude, geom,
            hub_name, hub_id,
            los_distance_m, routing_distance_m, total_distance_m,
            avg_cost_per_meter, total_fiber_deployment_cost,
            active_dwdm_equipment_cost, ip_aggregator_router_cost,
            total_active_equipment_cost, avg_microwave_links_to_hub,
            unit_cost_microwave_1g, total_microwave_cost,
            access_router_cost, lease_fibercomm_per_month,
            power_upgrade_per_hub, total_cost
        ) VALUES (
            %s,%s,%s,%s, %s,%s,
            ST_SetSRID(ST_MakePoint(%s,%s),4326),
            %s,%s,
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        ON CONFLICT DO NOTHING
    """

    batch = []
    hub_midmile_pairs = []  # (hub_id, midmile_id)

    for _, row in df.iterrows():
        lat = clean_float(row.get("latitude"))
        lon = clean_float(row.get("longitude"))
        if not is_valid_coord(lat, lon):
            lat = lon = None

        hub_name = clean_str(row.get("hub_name"))
        hub_id, _ = fuzzy_match_hub(hub_name, hub_lookup)

        batch.append((
            clean_str(row.get("zesco_substation_id")),
            clean_str(row.get("location")),
            clean_str(row.get("district")),
            clean_str(row.get("province")),
            lat, lon,
            lon, lat,
            hub_name, hub_id,
            clean_float(row.get("los_distance_m")),
            clean_float(row.get("routing_distance_m")),
            clean_float(row.get("total_distance_m")),
            clean_float(row.get("avg_cost_per_meter")),
            clean_float(row.get("total_fiber_deployment_cost")),
            clean_float(row.get("active_dwdm_equipment_cost")),
            clean_float(row.get("ip_aggregator_router_cost")),
            clean_float(row.get("total_active_equipment_cost")),
            clean_float(row.get("avg_microwave_links_to_hub")),
            clean_float(row.get("unit_cost_microwave_1g")),
            clean_float(row.get("total_microwave_cost")),
            clean_float(row.get("access_router_cost")),
            clean_float(row.get("lease_fibercomm_per_month")),
            clean_float(row.get("power_upgrade_per_hub")),
            clean_float(row.get("total_cost")),
        ))

    psycopg2.extras.execute_batch(cur, sql, batch, page_size=200)
    stats.midmile_loaded = len(df)
    log.info(f"Mid-mile nodes upserted: {stats.midmile_loaded}")


def upsert_schools(cur, df: pd.DataFrame, hub_lookup: dict, stats: IngestStats):
    df = normalise_columns(df, SCHOOLS_COLS)

    sql_school = """
        INSERT INTO schools (
            facility_code, name, facility_type,
            province, district, constituency, ward,
            latitude, longitude, geom,
            hub_name, hub_dist_km, hub_dist_m, hub_id, hub_match_type,
            population, households,
            transmission,
            fiber_cost, microwave_cost, satellite_hardware_cost, satellite_opex_cost,
            lan_cost, power_cost, power_opex,
            zamtel_internet_lease, managed_service_maint, total_cost
        ) VALUES (
            %s,%s,%s, %s,%s,%s,%s,
            %s,%s, ST_SetSRID(ST_MakePoint(%s,%s),4326),
            %s,%s,%s,%s,%s,
            %s,%s,
            %s,
            %s,%s,%s,%s, %s,%s,%s, %s,%s,%s
        )
        ON CONFLICT (facility_code) DO UPDATE SET
            name                    = EXCLUDED.name,
            facility_type           = EXCLUDED.facility_type,
            province                = EXCLUDED.province,
            district                = EXCLUDED.district,
            constituency            = EXCLUDED.constituency,
            ward                    = EXCLUDED.ward,
            latitude                = EXCLUDED.latitude,
            longitude               = EXCLUDED.longitude,
            geom                    = EXCLUDED.geom,
            hub_name                = EXCLUDED.hub_name,
            hub_dist_km             = EXCLUDED.hub_dist_km,
            hub_dist_m              = EXCLUDED.hub_dist_m,
            hub_id                  = EXCLUDED.hub_id,
            hub_match_type          = EXCLUDED.hub_match_type,
            population              = EXCLUDED.population,
            households              = EXCLUDED.households,
            transmission            = EXCLUDED.transmission,
            fiber_cost              = EXCLUDED.fiber_cost,
            microwave_cost          = EXCLUDED.microwave_cost,
            satellite_hardware_cost = EXCLUDED.satellite_hardware_cost,
            satellite_opex_cost     = EXCLUDED.satellite_opex_cost,
            lan_cost                = EXCLUDED.lan_cost,
            power_cost              = EXCLUDED.power_cost,
            power_opex              = EXCLUDED.power_opex,
            zamtel_internet_lease   = EXCLUDED.zamtel_internet_lease,
            managed_service_maint   = EXCLUDED.managed_service_maint,
            total_cost              = EXCLUDED.total_cost,
            updated_at              = NOW()
        RETURNING id, facility_code, hub_id, latitude, longitude, hub_dist_km
    """

    batch = []
    school_meta = []  # (facility_code, hub_id, lat, lon, hub_dist_km)

    for _, row in df.iterrows():
        code = clean_str(row.get("facility_code"))
        if not code:
            code = f"AUTO-{_}"

        lat = clean_float(row.get("latitude"))
        lon = clean_float(row.get("longitude"))
        if not is_valid_coord(lat, lon):
            lat = lon = None

        hub_name = clean_str(row.get("hub_name"))
        hub_id, match_type = fuzzy_match_hub(hub_name, hub_lookup)
        if match_type == "unmatched":
            stats.unmatched_hubs += 1

        batch.append((
            code,
            clean_str(row.get("name")) or code,
            clean_str(row.get("facility_type")),
            clean_str(row.get("province")),
            clean_str(row.get("district")),
            clean_str(row.get("constituency")),
            clean_str(row.get("ward")),
            lat, lon,
            lon, lat,  # ST_MakePoint(lon, lat)
            hub_name,
            clean_float(row.get("hub_dist_km")),
            clean_float(row.get("hub_dist_m")),
            hub_id,
            match_type,
            clean_int(row.get("population")),
            clean_int(row.get("households")),
            clean_str(row.get("transmission")),
            clean_float(row.get("fiber_cost")),
            clean_float(row.get("microwave_cost")),
            clean_float(row.get("satellite_hardware_cost")),
            clean_float(row.get("satellite_opex_cost")),
            clean_float(row.get("lan_cost")),
            clean_float(row.get("power_cost")),
            clean_float(row.get("power_opex")),
            clean_float(row.get("zamtel_internet_lease")),
            clean_float(row.get("managed_service_maint")),
            clean_float(row.get("total_cost")),
        ))

    # Execute in batches of 500
    returned = []
    for i in range(0, len(batch), 500):
        chunk = batch[i : i + 500]
        cur.executemany(sql_school, chunk)
        # Collect returned rows
        try:
            returned.extend(cur.fetchall())
        except Exception:
            pass
        log.info(f"  Schools: {min(i+500, len(batch))}/{len(batch)}")

    stats.schools_loaded = len(df)
    log.info(f"Schools upserted: {stats.schools_loaded}")
    return returned


def create_school_hub_links(cur, stats: IngestStats):
    """
    Create school_hub_links from schools that have a resolved hub_id.
    The line_geom is computed here using PostGIS.
    distance_m_computed is the geodesic distance (ST_Distance on geography).
    """
    sql = """
        INSERT INTO school_hub_links (school_id, hub_id, line_geom,
                                      distance_m_source, distance_m_computed, match_type)
        SELECT
            s.id,
            s.hub_id,
            ST_MakeLine(s.geom, h.geom)                                        AS line_geom,
            s.hub_dist_m                                                        AS distance_m_source,
            ST_Distance(s.geom::geography, h.geom::geography)                  AS distance_m_computed,
            s.hub_match_type
        FROM schools s
        JOIN hubs h ON h.id = s.hub_id
        WHERE s.geom IS NOT NULL AND h.geom IS NOT NULL
        ON CONFLICT (school_id, hub_id) DO UPDATE SET
            line_geom           = EXCLUDED.line_geom,
            distance_m_computed = EXCLUDED.distance_m_computed,
            match_type          = EXCLUDED.match_type
    """
    cur.execute(sql)
    stats.links_created = cur.rowcount
    log.info(f"School-hub links created: {stats.links_created}")


def create_hub_midmile_links(cur):
    sql = """
        INSERT INTO hub_midmile_links (hub_id, midmile_id, line_geom,
                                       los_distance_m, routing_distance_m,
                                       total_distance_m, total_cost)
        SELECT
            m.hub_id,
            m.id,
            ST_MakeLine(h.geom, m.geom),
            m.los_distance_m,
            m.routing_distance_m,
            m.total_distance_m,
            m.total_cost
        FROM mid_mile_nodes m
        JOIN hubs h ON h.id = m.hub_id
        WHERE m.geom IS NOT NULL AND h.geom IS NOT NULL
        ON CONFLICT (hub_id, midmile_id) DO NOTHING
    """
    cur.execute(sql)
    log.info(f"Hub-midmile links created: {cur.rowcount}")


def qa_hub_distance_anomalies(cur):
    """
    Flag schools where computed distance differs from source by > 20%.
    This is a QA/data-quality check — does not alter source values.
    """
    sql = """
        UPDATE schools s
        SET hub_dist_anomaly = TRUE
        FROM school_hub_links l
        WHERE l.school_id = s.id
          AND s.hub_dist_m IS NOT NULL
          AND l.distance_m_computed IS NOT NULL
          AND ABS(s.hub_dist_m - l.distance_m_computed) / NULLIF(s.hub_dist_m, 0) > 0.20
    """
    cur.execute(sql)
    log.info(f"Hub-distance anomaly flags set: {cur.rowcount}")


def refresh_materialized_views(cur):
    for view in ("mv_province_summary", "mv_hub_demand"):
        cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
        log.info(f"Refreshed {view}")


def log_run(cur, file_path: str, stats: IngestStats):
    cur.execute(
        """
        INSERT INTO ingestion_log
            (source_file, schools_loaded, hubs_loaded, midmile_loaded,
             links_created, unmatched_hubs, errors, duration_s)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            str(file_path),
            stats.schools_loaded,
            stats.hubs_loaded,
            stats.midmile_loaded,
            stats.links_created,
            stats.unmatched_hubs,
            json.dumps(stats.errors),
            stats.duration(),
        ),
    )


def run(file_path: str, db_url: str, reset: bool = False, dry_run: bool = False):
    stats = IngestStats()

    # ── Load Excel ────────────────────────────────────────────────────────────
    sheets = load_excel(file_path)

    if dry_run:
        log.info("Dry-run mode — no database writes.")
        for name, df in sheets.items():
            log.info(f"  {name}: {len(df)} rows")
        return

    # ── Connect to DB ─────────────────────────────────────────────────────────
    log.info(f"Connecting to database...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        if reset:
            log.warning("RESET flag set — truncating all tables!")
            cur.execute("""
                TRUNCATE hub_midmile_links, school_hub_links,
                         mid_mile_nodes, schools, hubs RESTART IDENTITY CASCADE
            """)
            conn.commit()

        # ── Hubs first (schools reference them) ───────────────────────────────
        if HUBS_SHEET in sheets:
            hub_lookup = upsert_hubs(cur, sheets[HUBS_SHEET], stats)
            conn.commit()
        else:
            log.error("Hub sheet missing — cannot resolve school↔hub links")
            hub_lookup = {}

        # ── Mid-mile nodes ────────────────────────────────────────────────────
        if MIDMILE_SHEET in sheets:
            upsert_mid_mile(cur, sheets[MIDMILE_SHEET], hub_lookup, stats)
            conn.commit()

        # ── Schools ───────────────────────────────────────────────────────────
        if SCHOOLS_SHEET in sheets:
            upsert_schools(cur, sheets[SCHOOLS_SHEET], hub_lookup, stats)
            conn.commit()

        # ── Links ─────────────────────────────────────────────────────────────
        create_school_hub_links(cur, stats)
        create_hub_midmile_links(cur)
        conn.commit()

        # ── QA pass ───────────────────────────────────────────────────────────
        qa_hub_distance_anomalies(cur)
        conn.commit()

        # ── Materialized views ────────────────────────────────────────────────
        try:
            refresh_materialized_views(cur)
            conn.commit()
        except Exception as e:
            log.warning(f"Could not refresh materialized views: {e}")
            conn.rollback()

        # ── Audit log ─────────────────────────────────────────────────────────
        log_run(cur, file_path, stats)
        conn.commit()

        log.info("=" * 60)
        log.info(f"Ingestion complete in {stats.duration()}s")
        log.info(f"  Schools:         {stats.schools_loaded}")
        log.info(f"  Hubs:            {stats.hubs_loaded}")
        log.info(f"  Mid-mile nodes:  {stats.midmile_loaded}")
        log.info(f"  Links created:   {stats.links_created}")
        log.info(f"  Unmatched hubs:  {stats.unmatched_hubs}")
        log.info("=" * 60)

    except Exception as e:
        conn.rollback()
        log.error(f"Ingestion failed: {e}", exc_info=True)
        stats.errors.append(str(e))
        raise
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="SchoolConnect Atlas — Data Ingestion")
    parser.add_argument("--file",    required=True,  help="Path to Excel workbook")
    parser.add_argument("--db-url",  default=None,   help="PostgreSQL connection URL (overrides env)")
    parser.add_argument("--reset",   action="store_true", help="Truncate tables before loading")
    parser.add_argument("--dry-run", action="store_true", help="Inspect file without DB writes")
    args = parser.parse_args()

    db_url = args.db_url or os.environ.get(
        "SYNC_DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/schoolconnect",
    )

    run(args.file, db_url, reset=args.reset, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

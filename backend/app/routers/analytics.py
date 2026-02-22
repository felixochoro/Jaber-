from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional

from app.database import get_db
from app.services.cache import cache_get, cache_set, make_key

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary", summary="Platform-wide analytics summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    cache_key = make_key("analytics", "summary")
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # Totals
    totals = dict((await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM schools)            AS total_schools,
            (SELECT COUNT(*) FROM hubs)               AS total_hubs,
            (SELECT COUNT(*) FROM mid_mile_nodes)     AS total_mid_mile_nodes,
            (SELECT COUNT(*) FROM schools WHERE coord_valid)         AS schools_valid_coords,
            (SELECT COUNT(*) FROM schools WHERE hub_id IS NOT NULL)  AS schools_with_hub,
            (SELECT COUNT(*) FROM schools WHERE hub_match_type='unmatched') AS schools_unmatched_hub,
            (SELECT COUNT(*) FROM schools WHERE hub_dist_km > 10)   AS schools_beyond_10km
    """))).mappings().first())

    # Province summaries from materialized view
    prov_rows = await db.execute(text("SELECT * FROM mv_province_summary ORDER BY school_count DESC"))
    province_summaries = [dict(r._mapping) for r in prov_rows.fetchall()]

    # Cost percentiles
    perc_row = (await db.execute(text("""
        SELECT
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_cost) AS p25,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_cost) AS p50,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_cost) AS p75,
            PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_cost) AS p90,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_cost) AS p99
        FROM schools WHERE total_cost IS NOT NULL
    """))).mappings().first()
    cost_percentiles = dict(perc_row) if perc_row else None

    # Facility type counts
    type_rows = await db.execute(text("""
        SELECT facility_type, COUNT(*) AS cnt
        FROM schools GROUP BY facility_type ORDER BY cnt DESC
    """))
    facility_type_counts = {r[0] or "Unknown": r[1] for r in type_rows.fetchall()}

    # Transmission counts
    tx_rows = await db.execute(text("""
        SELECT transmission, COUNT(*) AS cnt
        FROM schools GROUP BY transmission ORDER BY cnt DESC
    """))
    transmission_counts = {r[0] or "Unknown": r[1] for r in tx_rows.fetchall()}

    result = {
        **totals,
        "schools_with_valid_coords": totals.get("schools_valid_coords"),
        "province_summaries": province_summaries,
        "cost_percentiles": cost_percentiles,
        "facility_type_counts": facility_type_counts,
        "transmission_counts": transmission_counts,
    }
    await cache_set(cache_key, result, ttl=600)
    return result


@router.get("/gaps", summary="Schools with connectivity gaps")
async def get_gaps(
    hub_dist_km_gt: float = Query(10.0, description="Flag schools beyond this distance from hub"),
    total_cost_gt:  Optional[float] = Query(None),
    province:       Optional[str]   = Query(None),
    page:           int = Query(1, ge=1),
    page_size:      int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    params: dict = {"dist": hub_dist_km_gt}

    conditions.append("(s.hub_dist_km > :dist OR s.hub_match_type = 'unmatched' OR NOT s.coord_valid)")

    if total_cost_gt:
        conditions.append("s.total_cost > :cost_gt")
        params["cost_gt"] = total_cost_gt

    if province:
        conditions.append("s.province ILIKE :province")
        params["province"] = f"%{province}%"

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    total = (await db.execute(text(f"SELECT COUNT(*) FROM schools s WHERE {where}"), params)).scalar()
    params["limit"] = page_size
    params["offset"] = offset

    rows = await db.execute(text(f"""
        SELECT s.id, s.facility_code, s.name, s.province, s.district,
               s.hub_dist_km, s.total_cost, s.hub_match_type, s.coord_valid,
               CASE
                   WHEN NOT s.coord_valid THEN 'invalid_coord'
                   WHEN s.hub_match_type = 'unmatched' THEN 'unmatched_hub'
                   WHEN s.hub_dist_km > :dist THEN 'beyond_threshold_km'
                   ELSE 'ok'
               END AS issue
        FROM schools s
        WHERE {where}
        ORDER BY s.hub_dist_km DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params)
    gaps = [dict(r._mapping) for r in rows.fetchall()]

    import math
    return {"data": gaps, "total": total, "page": page, "page_size": page_size,
            "pages": math.ceil(total / page_size) if total else 0,
            "threshold_km": hub_dist_km_gt}


@router.get("/hubs/demand", summary="Hub capacity vs school demand ranking")
async def hub_demand(
    province: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1=1"]
    params: dict = {}
    if province:
        conditions.append("v.province ILIKE :province")
        params["province"] = f"%{province}%"

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size
    total = (await db.execute(text(f"SELECT COUNT(*) FROM mv_hub_demand v WHERE {where}"), params)).scalar()
    params["limit"] = page_size
    params["offset"] = offset

    rows = await db.execute(text(f"""
        SELECT * FROM mv_hub_demand v
        WHERE {where}
        ORDER BY linked_schools DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params)
    data = [dict(r._mapping) for r in rows.fetchall()]
    import math
    return {"data": data, "total": total, "page": page, "page_size": page_size,
            "pages": math.ceil(total / page_size) if total else 0}


@router.get("/district", summary="District-level breakdown")
async def district_breakdown(
    province: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {}
    extra = ""
    if province:
        extra = "WHERE province ILIKE :province"
        params["province"] = f"%{province}%"

    rows = await db.execute(text(f"""
        SELECT province, district,
               COUNT(*) AS school_count,
               AVG(hub_dist_km)::NUMERIC(8,2) AS avg_hub_dist_km,
               AVG(total_cost)::NUMERIC(12,2) AS avg_total_cost,
               SUM(population) AS total_population,
               COUNT(*) FILTER (WHERE hub_dist_km > 10) AS beyond_10km,
               COUNT(*) FILTER (WHERE NOT coord_valid) AS invalid_coords
        FROM schools
        {extra}
        GROUP BY province, district
        ORDER BY province, district
    """), params)
    return {"data": [dict(r._mapping) for r in rows.fetchall()]}


@router.get("/cost-distribution", summary="Cost distribution by province or type")
async def cost_distribution(
    group_by: str = Query("province", description="province|facility_type|transmission"),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"province", "facility_type", "transmission"}
    col = group_by if group_by in allowed else "province"

    rows = await db.execute(text(f"""
        SELECT {col} AS label,
               COUNT(*) AS count,
               MIN(total_cost) AS min_cost,
               AVG(total_cost)::NUMERIC(12,2) AS avg_cost,
               MAX(total_cost) AS max_cost,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_cost) AS median_cost
        FROM schools
        WHERE total_cost IS NOT NULL
        GROUP BY {col}
        ORDER BY avg_cost DESC NULLS LAST
    """))
    return {"data": [dict(r._mapping) for r in rows.fetchall()], "grouped_by": col}

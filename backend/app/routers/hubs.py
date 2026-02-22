from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
import math

from app.database import get_db
from app.services.cache import cache_get, cache_set, make_key

router = APIRouter(prefix="/api/v1/hubs", tags=["hubs"])


@router.get("", summary="List and filter hubs")
async def list_hubs(
    q:                     Optional[str]   = Query(None),
    site_owner:            Optional[str]   = Query(None),
    province:              Optional[str]   = Query(None),
    district:              Optional[str]   = Query(None),
    capacity_gbps_gte:     Optional[float] = Query(None),
    coord_valid:           Optional[bool]  = Query(None),
    bbox:                  Optional[str]   = Query(None),
    page:                  int             = Query(1, ge=1),
    page_size:             int             = Query(50, ge=1, le=500),
    sort_by:               str             = Query("site_name"),
    sort_dir:              str             = Query("asc"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = make_key("hubs", "list", str(locals()))
    cached = await cache_get(cache_key)
    if cached:
        return cached

    conditions = ["1=1"]
    params: dict = {}

    if q:
        conditions.append("h.fts_vector @@ plainto_tsquery('english', :q)")
        params["q"] = q

    if site_owner:
        conditions.append("h.site_owner ILIKE :site_owner")
        params["site_owner"] = f"%{site_owner}%"

    if province:
        conditions.append("h.province ILIKE :province")
        params["province"] = f"%{province}%"

    if district:
        conditions.append("h.district ILIKE :district")
        params["district"] = f"%{district}%"

    if capacity_gbps_gte is not None:
        conditions.append("h.aggregate_capacity_gbps >= :cap_gte")
        params["cap_gte"] = capacity_gbps_gte

    if coord_valid is not None:
        conditions.append("h.coord_valid = :coord_valid")
        params["coord_valid"] = coord_valid

    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
            conditions.append("h.geom && ST_MakeEnvelope(:min_lon,:min_lat,:max_lon,:max_lat,4326)")
            params.update(min_lon=min_lon, min_lat=min_lat, max_lon=max_lon, max_lat=max_lat)
        except ValueError:
            raise HTTPException(400, "Invalid bbox format")

    where = " AND ".join(conditions)
    allowed_sorts = {"site_name", "hub_site_code", "aggregate_capacity_gbps", "province", "district"}
    sort_col = sort_by if sort_by in allowed_sorts else "site_name"
    order = f"h.{sort_col} {'DESC' if sort_dir == 'desc' else 'ASC'} NULLS LAST"
    offset = (page - 1) * page_size

    total_row = await db.execute(text(f"SELECT COUNT(*) FROM hubs h WHERE {where}"), params)
    total = total_row.scalar()

    params["limit"] = page_size
    params["offset"] = offset
    rows = await db.execute(text(f"""
        SELECT h.id, h.hub_site_code, h.site_name, h.site_owner,
               h.latitude, h.longitude, h.province, h.district,
               h.aggregate_capacity_gbps, h.total_links,
               h.fiber_links, h.microwave_links, h.coord_valid,
               COUNT(s.id) AS linked_school_count
        FROM hubs h
        LEFT JOIN schools s ON s.hub_id = h.id
        WHERE {where}
        GROUP BY h.id
        ORDER BY {order}
        LIMIT :limit OFFSET :offset
    """), params)
    hubs = [dict(r._mapping) for r in rows.fetchall()]

    result = {
        "data": hubs,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }
    await cache_set(cache_key, result, ttl=120)
    return result


@router.get("/{hub_site_code}", summary="Hub detail with nearby schools")
async def get_hub(
    hub_site_code: str,
    nearby_limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    cache_key = make_key("hub", hub_site_code)
    cached = await cache_get(cache_key)
    if cached:
        return cached

    hub_sql = text("""
        SELECT h.*,
               COUNT(s.id) AS linked_school_count,
               SUM(s.population) AS total_linked_population
        FROM hubs h
        LEFT JOIN schools s ON s.hub_id = h.id
        WHERE h.hub_site_code = :code
        GROUP BY h.id
    """)
    row = await db.execute(hub_sql, {"code": hub_site_code})
    hub = row.mappings().first()
    if not hub:
        raise HTTPException(404, f"Hub '{hub_site_code}' not found")
    hub = dict(hub)

    # Nearby schools ordered by distance
    schools_sql = text("""
        SELECT s.facility_code, s.name, s.facility_type,
               s.hub_dist_km, s.total_cost, s.transmission,
               s.latitude, s.longitude
        FROM schools s
        WHERE s.hub_id = :hub_id
        ORDER BY s.hub_dist_km ASC NULLS LAST
        LIMIT :limit
    """)
    srows = await db.execute(schools_sql, {"hub_id": hub["id"], "limit": nearby_limit})
    hub["nearby_schools"] = [dict(r._mapping) for r in srows.fetchall()]

    # Mid-mile nodes
    mm_sql = text("""
        SELECT m.id, m.location, m.district, m.latitude, m.longitude,
               m.total_distance_m, m.total_cost
        FROM mid_mile_nodes m
        WHERE m.hub_id = :hub_id
        LIMIT 20
    """)
    mmrows = await db.execute(mm_sql, {"hub_id": hub["id"]})
    hub["mid_mile_nodes"] = [dict(r._mapping) for r in mmrows.fetchall()]

    await cache_set(cache_key, hub, ttl=300)
    return hub

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
import math

from app.database import get_db
from app.services.cache import cache_get, cache_set, make_key

router = APIRouter(prefix="/api/v1/mid-mile", tags=["mid-mile"])


@router.get("", summary="List mid-mile nodes")
async def list_mid_mile(
    province:  Optional[str] = Query(None),
    district:  Optional[str] = Query(None),
    hub_name:  Optional[str] = Query(None),
    bbox:      Optional[str] = Query(None),
    page:      int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    cache_key = make_key("midmile", "list", str(locals()))
    cached = await cache_get(cache_key)
    if cached:
        return cached

    conditions = ["1=1"]
    params: dict = {}

    if province:
        conditions.append("m.province ILIKE :province")
        params["province"] = f"%{province}%"
    if district:
        conditions.append("m.district ILIKE :district")
        params["district"] = f"%{district}%"
    if hub_name:
        conditions.append("m.hub_name ILIKE :hub_name")
        params["hub_name"] = f"%{hub_name}%"
    if bbox:
        min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
        conditions.append("m.geom && ST_MakeEnvelope(:min_lon,:min_lat,:max_lon,:max_lat,4326)")
        params.update(min_lon=min_lon, min_lat=min_lat, max_lon=max_lon, max_lat=max_lat)

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    total = (await db.execute(text(f"SELECT COUNT(*) FROM mid_mile_nodes m WHERE {where}"), params)).scalar()
    params["limit"] = page_size
    params["offset"] = offset
    rows = await db.execute(text(f"""
        SELECT m.id, m.zesco_substation_id, m.location, m.district, m.province,
               m.latitude, m.longitude, m.hub_name, m.hub_id,
               m.los_distance_m, m.routing_distance_m, m.total_distance_m,
               m.total_cost, m.coord_valid
        FROM mid_mile_nodes m WHERE {where}
        ORDER BY m.id ASC
        LIMIT :limit OFFSET :offset
    """), params)
    nodes = [dict(r._mapping) for r in rows.fetchall()]
    result = {"data": nodes, "total": total, "page": page, "page_size": page_size,
              "pages": math.ceil(total / page_size) if total else 0}
    await cache_set(cache_key, result, ttl=120)
    return result

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from typing import Optional, List
import math

from app.database import get_db
from app.schemas.schools import SchoolBrief, SchoolDetail, SchoolList, CostBreakdown
from app.schemas.hubs import HubBrief
from app.services.cache import cache_get, cache_set, make_key
from app.services.recommendation import recommend_connectivity

router = APIRouter(prefix="/api/v1/schools", tags=["schools"])


@router.get("", response_model=SchoolList, summary="List and filter schools")
async def list_schools(
    # Text search
    q: Optional[str] = Query(None, description="Search by name, code, district"),
    # Categorical filters
    facility_type:  Optional[str] = Query(None),
    province:       Optional[str] = Query(None),
    district:       Optional[str] = Query(None),
    ward:           Optional[str] = Query(None),
    constituency:   Optional[str] = Query(None),
    transmission:   Optional[str] = Query(None),
    hub_match_type: Optional[str] = Query(None, description="exact|fuzzy|unmatched"),
    # Numeric filters
    hub_dist_km_lte:    Optional[float] = Query(None),
    hub_dist_km_gte:    Optional[float] = Query(None),
    total_cost_lte:     Optional[float] = Query(None),
    population_gte:     Optional[int]   = Query(None),
    # Geo filters
    bbox: Optional[str] = Query(None, description="minLon,minLat,maxLon,maxLat"),
    near: Optional[str] = Query(None, description="lat,lon"),
    radius_km: Optional[float] = Query(None, description="Radius for near filter"),
    # QA filters
    coord_valid:     Optional[bool] = Query(None),
    hub_dist_anomaly: Optional[bool] = Query(None),
    # Pagination
    page:      int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by:   str = Query("name", description="name|hub_dist_km|total_cost|population"),
    sort_dir:  str = Query("asc", description="asc|desc"),
    db: AsyncSession = Depends(get_db),
):
    cache_key = make_key("schools", "list", str(locals()))
    cached = await cache_get(cache_key)
    if cached:
        return cached

    # Build WHERE clauses
    conditions = ["1=1"]
    params: dict = {}

    if q:
        conditions.append("s.fts_vector @@ plainto_tsquery('english', :q)")
        params["q"] = q

    if facility_type:
        conditions.append("s.facility_type ILIKE :facility_type")
        params["facility_type"] = f"%{facility_type}%"

    if province:
        conditions.append("s.province ILIKE :province")
        params["province"] = f"%{province}%"

    if district:
        conditions.append("s.district ILIKE :district")
        params["district"] = f"%{district}%"

    if ward:
        conditions.append("s.ward ILIKE :ward")
        params["ward"] = f"%{ward}%"

    if constituency:
        conditions.append("s.constituency ILIKE :constituency")
        params["constituency"] = f"%{constituency}%"

    if transmission:
        conditions.append("s.transmission ILIKE :transmission")
        params["transmission"] = f"%{transmission}%"

    if hub_match_type:
        conditions.append("s.hub_match_type = :hub_match_type")
        params["hub_match_type"] = hub_match_type

    if hub_dist_km_lte is not None:
        conditions.append("s.hub_dist_km <= :hub_dist_km_lte")
        params["hub_dist_km_lte"] = hub_dist_km_lte

    if hub_dist_km_gte is not None:
        conditions.append("s.hub_dist_km >= :hub_dist_km_gte")
        params["hub_dist_km_gte"] = hub_dist_km_gte

    if total_cost_lte is not None:
        conditions.append("s.total_cost <= :total_cost_lte")
        params["total_cost_lte"] = total_cost_lte

    if population_gte is not None:
        conditions.append("s.population >= :population_gte")
        params["population_gte"] = population_gte

    if coord_valid is not None:
        conditions.append("s.coord_valid = :coord_valid")
        params["coord_valid"] = coord_valid

    if hub_dist_anomaly is not None:
        conditions.append("s.hub_dist_anomaly = :hub_dist_anomaly")
        params["hub_dist_anomaly"] = hub_dist_anomaly

    if bbox:
        try:
            min_lon, min_lat, max_lon, max_lat = [float(x) for x in bbox.split(",")]
            conditions.append(
                "s.geom && ST_MakeEnvelope(:min_lon,:min_lat,:max_lon,:max_lat,4326)"
            )
            params.update(min_lon=min_lon, min_lat=min_lat, max_lon=max_lon, max_lat=max_lat)
        except ValueError:
            raise HTTPException(400, "Invalid bbox format. Use: minLon,minLat,maxLon,maxLat")

    if near:
        try:
            nlat, nlon = [float(x) for x in near.split(",")]
            r_km = radius_km or 10.0
            conditions.append(
                "ST_DWithin(s.geom::geography, ST_SetSRID(ST_MakePoint(:nlon,:nlat),4326)::geography, :r_m)"
            )
            params.update(nlat=nlat, nlon=nlon, r_m=r_km * 1000)
        except ValueError:
            raise HTTPException(400, "Invalid near format. Use: lat,lon")

    where_clause = " AND ".join(conditions)

    # Validate sort field
    allowed_sorts = {"name", "hub_dist_km", "total_cost", "population", "facility_code"}
    sort_col = sort_by if sort_by in allowed_sorts else "name"
    order = f"s.{sort_col} {'DESC' if sort_dir == 'desc' else 'ASC'} NULLS LAST"

    offset = (page - 1) * page_size

    count_sql = text(f"SELECT COUNT(*) FROM schools s WHERE {where_clause}")
    data_sql = text(f"""
        SELECT s.id, s.facility_code, s.name, s.facility_type,
               s.province, s.district, s.constituency, s.ward,
               s.latitude, s.longitude,
               s.hub_name, s.hub_dist_km, s.hub_id, s.hub_match_type,
               s.population, s.households, s.transmission, s.total_cost,
               s.coord_valid, s.hub_dist_anomaly
        FROM schools s
        WHERE {where_clause}
        ORDER BY {order}
        LIMIT :limit OFFSET :offset
    """)

    total_row = await db.execute(count_sql, params)
    total = total_row.scalar()

    params["limit"] = page_size
    params["offset"] = offset
    rows = await db.execute(data_sql, params)
    schools = [dict(r._mapping) for r in rows.fetchall()]

    result = {
        "data": schools,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }
    await cache_set(cache_key, result, ttl=120)
    return result


@router.get("/{facility_code}", response_model=SchoolDetail, summary="School detail")
async def get_school(facility_code: str, db: AsyncSession = Depends(get_db)):
    cache_key = make_key("school", facility_code)
    cached = await cache_get(cache_key)
    if cached:
        return cached

    sql = text("""
        SELECT
            s.*,
            h.hub_site_code, h.site_name AS hub_site_name, h.site_owner AS hub_site_owner,
            h.latitude AS hub_lat, h.longitude AS hub_lon,
            h.aggregate_capacity_gbps, h.fiber_links, h.microwave_links,
            l.distance_m_computed AS link_distance_computed_m
        FROM schools s
        LEFT JOIN hubs h ON h.id = s.hub_id
        LEFT JOIN school_hub_links l ON l.school_id = s.id AND l.hub_id = s.hub_id
        WHERE s.facility_code = :code
    """)
    row = await db.execute(sql, {"code": facility_code})
    rec = row.mappings().first()
    if not rec:
        raise HTTPException(404, f"School '{facility_code}' not found")

    rec = dict(rec)

    # Build nested cost breakdown
    cost_breakdown = {
        "fiber_cost":               rec.get("fiber_cost"),
        "microwave_cost":           rec.get("microwave_cost"),
        "satellite_hardware_cost":  rec.get("satellite_hardware_cost"),
        "satellite_opex_cost":      rec.get("satellite_opex_cost"),
        "lan_cost":                 rec.get("lan_cost"),
        "power_cost":               rec.get("power_cost"),
        "power_opex":               rec.get("power_opex"),
        "zamtel_internet_lease":    rec.get("zamtel_internet_lease"),
        "managed_service_maint":    rec.get("managed_service_maint"),
        "total_cost":               rec.get("total_cost"),
        "transmission":             rec.get("transmission"),
    }

    hub_info = None
    if rec.get("hub_id"):
        hub_info = {
            "id":                       rec.get("hub_id"),
            "hub_site_code":            rec.get("hub_site_code"),
            "site_name":                rec.get("hub_site_name"),
            "site_owner":               rec.get("hub_site_owner"),
            "latitude":                 rec.get("hub_lat"),
            "longitude":                rec.get("hub_lon"),
            "aggregate_capacity_gbps":  rec.get("aggregate_capacity_gbps"),
            "fiber_links":              rec.get("fiber_links"),
            "microwave_links":          rec.get("microwave_links"),
        }

    recommendation = recommend_connectivity(
        hub_dist_km=rec.get("hub_dist_km"),
        fiber_cost=rec.get("fiber_cost"),
        microwave_cost=rec.get("microwave_cost"),
        satellite_hardware_cost=rec.get("satellite_hardware_cost"),
        satellite_opex_cost=rec.get("satellite_opex_cost"),
        transmission=rec.get("transmission"),
    )

    result = {**rec, "cost_breakdown": cost_breakdown, "hub": hub_info,
              "connectivity_recommendation": recommendation}
    await cache_set(cache_key, result, ttl=300)
    return result


@router.post("/compare", summary="Compare up to 5 schools side-by-side")
async def compare_schools(
    facility_codes: List[str],
    db: AsyncSession = Depends(get_db),
):
    if len(facility_codes) > 5:
        raise HTTPException(400, "Maximum 5 schools for comparison")

    sql = text("""
        SELECT s.facility_code, s.name, s.facility_type, s.province, s.district,
               s.hub_dist_km, s.transmission, s.fiber_cost, s.microwave_cost,
               s.satellite_hardware_cost, s.satellite_opex_cost,
               s.lan_cost, s.power_cost, s.power_opex,
               s.zamtel_internet_lease, s.managed_service_maint, s.total_cost,
               s.population, s.households,
               h.site_name AS hub_name_resolved
        FROM schools s
        LEFT JOIN hubs h ON h.id = s.hub_id
        WHERE s.facility_code = ANY(:codes)
    """)
    rows = await db.execute(sql, {"codes": facility_codes})
    schools = [dict(r._mapping) for r in rows.fetchall()]

    if not schools:
        raise HTTPException(404, "No schools found for given codes")

    return {"schools": schools, "count": len(schools)}

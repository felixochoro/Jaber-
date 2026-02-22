import csv
import io
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional

from app.database import get_db

router = APIRouter(prefix="/api/v1/export", tags=["export"])

SCHOOL_EXPORT_COLS = [
    "facility_code", "name", "facility_type", "province", "district",
    "constituency", "ward", "latitude", "longitude",
    "hub_name", "hub_dist_km", "hub_match_type",
    "population", "households", "transmission",
    "fiber_cost", "microwave_cost", "satellite_hardware_cost", "satellite_opex_cost",
    "lan_cost", "power_cost", "power_opex", "zamtel_internet_lease",
    "managed_service_maint", "total_cost",
    "coord_valid", "hub_dist_anomaly",
]


@router.get("/schools.csv", summary="Export filtered schools as CSV")
async def export_schools_csv(
    q:              Optional[str]   = Query(None),
    facility_type:  Optional[str]   = Query(None),
    province:       Optional[str]   = Query(None),
    district:       Optional[str]   = Query(None),
    hub_dist_km_lte: Optional[float] = Query(None),
    total_cost_lte:  Optional[float] = Query(None),
    hub_match_type:  Optional[str]   = Query(None),
    limit:           int             = Query(10000, le=50000),
    db: AsyncSession = Depends(get_db),
):
    conditions = ["1=1"]
    params: dict = {}

    if q:
        conditions.append("fts_vector @@ plainto_tsquery('english', :q)")
        params["q"] = q
    if facility_type:
        conditions.append("facility_type ILIKE :ft")
        params["ft"] = f"%{facility_type}%"
    if province:
        conditions.append("province ILIKE :prov")
        params["prov"] = f"%{province}%"
    if district:
        conditions.append("district ILIKE :dist")
        params["dist"] = f"%{district}%"
    if hub_dist_km_lte is not None:
        conditions.append("hub_dist_km <= :hd")
        params["hd"] = hub_dist_km_lte
    if total_cost_lte is not None:
        conditions.append("total_cost <= :tc")
        params["tc"] = total_cost_lte
    if hub_match_type:
        conditions.append("hub_match_type = :hmt")
        params["hmt"] = hub_match_type

    where = " AND ".join(conditions)
    params["limit"] = limit

    cols = ", ".join(SCHOOL_EXPORT_COLS)
    rows = await db.execute(text(f"""
        SELECT {cols} FROM schools WHERE {where}
        ORDER BY province, district, name
        LIMIT :limit
    """), params)
    records = rows.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(SCHOOL_EXPORT_COLS)
    for rec in records:
        writer.writerow(list(rec))

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="schools_export.csv"'},
    )


@router.get("/hubs.csv", summary="Export hubs as CSV")
async def export_hubs_csv(
    province: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    params: dict = {}
    extra = ""
    if province:
        extra = "WHERE province ILIKE :prov"
        params["prov"] = f"%{province}%"

    rows = await db.execute(text(f"""
        SELECT hub_site_code, site_name, site_owner,
               fiber_links, microwave_links, total_links,
               latitude, longitude, district, province,
               aggregate_capacity_mbps, aggregate_capacity_gbps
        FROM hubs {extra}
        ORDER BY province, site_name
    """), params)
    records = rows.fetchall()
    cols = ["hub_site_code", "site_name", "site_owner", "fiber_links", "microwave_links",
            "total_links", "latitude", "longitude", "district", "province",
            "aggregate_capacity_mbps", "aggregate_capacity_gbps"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(cols)
    for rec in records:
        writer.writerow(list(rec))

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="hubs_export.csv"'},
    )

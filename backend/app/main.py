"""
SchoolConnect Atlas — FastAPI Backend
"""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.routers import (
    schools_router, hubs_router, midmile_router,
    analytics_router, export_router,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger("schoolconnect")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info(f"SchoolConnect Atlas API starting (env={settings.environment})")
    yield
    log.info("API shutting down")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SchoolConnect Atlas API",
    description="""
## SchoolConnect Atlas

Production-grade GIS API for Zambia school connectivity data.

### Features
- School search with full-text + spatial queries
- Hub site data with capacity metrics
- Mid-mile / backhaul planning nodes
- Connectivity cost analytics and recommendations
- CSV export for any filtered view

### Authentication
Privileged endpoints require `X-API-Key` header.
    """,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Response-Time-Ms"] = str(duration)
    if settings.environment != "production":
        log.debug(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")
    return response


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(schools_router)
app.include_router(hubs_router)
app.include_router(midmile_router)
app.include_router(analytics_router)
app.include_router(export_router)


@app.get("/health", tags=["ops"], summary="Health check")
async def health():
    return {"status": "ok", "version": settings.app_version, "env": settings.environment}


@app.get("/api/v1/meta", tags=["meta"], summary="Enumerable filter values")
async def get_meta():
    """Returns distinct values for dropdowns (provinces, types, owners, etc.)."""
    from app.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as db:
        provinces = [r[0] for r in (await db.execute(
            text("SELECT DISTINCT province FROM schools WHERE province IS NOT NULL ORDER BY province")
        )).fetchall()]
        districts = [r[0] for r in (await db.execute(
            text("SELECT DISTINCT district FROM schools WHERE district IS NOT NULL ORDER BY district")
        )).fetchall()]
        types = [r[0] for r in (await db.execute(
            text("SELECT DISTINCT facility_type FROM schools WHERE facility_type IS NOT NULL ORDER BY facility_type")
        )).fetchall()]
        transmissions = [r[0] for r in (await db.execute(
            text("SELECT DISTINCT transmission FROM schools WHERE transmission IS NOT NULL ORDER BY transmission")
        )).fetchall()]
        owners = [r[0] for r in (await db.execute(
            text("SELECT DISTINCT site_owner FROM hubs WHERE site_owner IS NOT NULL ORDER BY site_owner")
        )).fetchall()]

    return {
        "provinces": provinces,
        "districts": districts,
        "facility_types": types,
        "transmissions": transmissions,
        "hub_site_owners": owners,
    }

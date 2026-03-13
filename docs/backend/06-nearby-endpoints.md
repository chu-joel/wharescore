# Backend — Nearby Endpoints (Phase 2E)

**Creates:** 10 GeoJSON FeatureCollection endpoints for map overlays
**Prerequisites:** `02-project-setup.md` complete. All spatial tables loaded with GIST indexes.
**Pattern:** All endpoints follow the same CTE + bbox pre-filter + ST_DWithin pattern.

---

## Files to Create

```
backend/app/
├── routers/
│   └── nearby.py           # 10 GET /nearby/{address_id}/* endpoints
└── services/
    └── geo_utils.py         # GeoJSON conversion helpers
```

---

## Step 1: GeoJSON Utilities

```python
# backend/app/services/geo_utils.py
import json


def to_geojson_feature(row: dict) -> dict:
    """Convert a DB row with lng/lat into a GeoJSON Point Feature.
    Moves lng/lat into geometry, everything else into properties."""
    props = {k: v for k, v in row.items() if k not in ("lat", "lng", "geom")}
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [row["lng"], row["lat"]]},
        "properties": props,
    }


def to_geojson_polygon_feature(row: dict) -> dict:
    """Convert a DB row with geom_geojson string into a GeoJSON Polygon Feature.
    Used for building outlines."""
    props = {k: v for k, v in row.items() if k != "geom_geojson"}
    return {
        "type": "Feature",
        "geometry": json.loads(row["geom_geojson"]),
        "properties": props,
    }
```

---

## Step 2: Nearby Router

All endpoints share a common pattern:
1. CTE to get address point geometry
2. `&& ST_Expand()` for fast GIST bounding-box pre-filter (**critical** for large tables)
3. `ST_DWithin()` for precise distance filtering
4. Return GeoJSON FeatureCollection

**Degree-to-metre conversion for `ST_Expand`:** `0.001 ≈ 100m`, `0.005 ≈ 500m`, `0.01 ≈ 1km`, `0.05 ≈ 5km`

```python
# backend/app/routers/nearby.py
from fastapi import APIRouter, HTTPException, Query, Request

from ..db import pool
from ..deps import limiter
from ..services.geo_utils import to_geojson_feature, to_geojson_polygon_feature

router = APIRouter()


# --- Helper ---

async def _get_addr_geom(conn, address_id: int):
    """Verify address exists. Used by endpoints that need manual geom handling."""
    cur = await conn.execute(
        "SELECT geom FROM addresses WHERE address_id = %s", [address_id]
    )
    row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Address not found")
    return row["geom"]


# --- Schools ---

@router.get("/nearby/{address_id}/schools")
@limiter.limit("40/minute")
async def nearby_schools(
    request: Request,
    address_id: int,
    radius: int = Query(1500, le=5000),
):
    """Schools within radius. Includes EQI, roll, and in-zone status."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT s.school_name, s.school_type, s.eqi, s.total_roll,
                   round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(s.geom) AS lng, ST_Y(s.geom) AS lat,
                   EXISTS(
                     SELECT 1 FROM school_zones sz
                     WHERE sz.school_name = s.school_name
                       AND ST_Contains(sz.geom, addr.geom)
                   ) AS in_zone
            FROM schools s, addr
            WHERE s.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(s.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 20
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Crashes ---

@router.get("/nearby/{address_id}/crashes")
@limiter.limit("40/minute")
async def nearby_crashes(
    request: Request,
    address_id: int,
    radius: int = Query(300, le=1000),
):
    """Serious/fatal crashes within radius, last 5 years.
    bbox pre-filter critical — crashes table has 904K rows."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT c.crash_severity, c.crash_year,
                   c.number_of_fatalities, c.number_of_serious_injuries,
                   c.number_of_minor_injuries,
                   round(ST_Distance(c.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(c.geom) AS lng, ST_Y(c.geom) AS lat
            FROM crashes c, addr
            WHERE c.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(c.geom::geography, addr.geom::geography, %s)
              AND c.crash_severity IN ('Fatal Crash', 'Serious Crash')
              AND c.crash_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 5
            ORDER BY c.crash_year DESC, distance_m
            LIMIT 50
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Transit Stops ---

@router.get("/nearby/{address_id}/transit")
@limiter.limit("40/minute")
async def nearby_transit(
    request: Request,
    address_id: int,
    radius: int = Query(400, le=2000),
):
    """Transit stops (bus, train) within radius."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT ts.stop_name, ts.stop_code, ts.location_type,
                   round(ST_Distance(ts.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(ts.geom) AS lng, ST_Y(ts.geom) AS lat
            FROM transit_stops ts, addr
            WHERE ts.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(ts.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 20
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Heritage Sites ---

@router.get("/nearby/{address_id}/heritage")
@limiter.limit("40/minute")
async def nearby_heritage(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
):
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT hs.list_name, hs.list_entry_type, hs.list_number,
                   round(ST_Distance(hs.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(hs.geom) AS lng, ST_Y(hs.geom) AS lat
            FROM heritage_sites hs, addr
            WHERE hs.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(hs.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 30
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Resource Consents ---

@router.get("/nearby/{address_id}/consents")
@limiter.limit("40/minute")
async def nearby_consents(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
):
    """Granted resource consents within radius, last 2 years."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT rc.consent_type, rc.status, rc.activity_description,
                   rc.decision_date,
                   round(ST_Distance(rc.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(rc.geom) AS lng, ST_Y(rc.geom) AS lat
            FROM resource_consents rc, addr
            WHERE rc.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(rc.geom::geography, addr.geom::geography, %s)
              AND rc.status = 'Granted'
              AND rc.decision_date >= CURRENT_DATE - interval '2 years'
            ORDER BY rc.decision_date DESC, distance_m
            LIMIT 30
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Earthquakes ---

@router.get("/nearby/{address_id}/earthquakes")
@limiter.limit("40/minute")
async def nearby_earthquakes(
    request: Request,
    address_id: int,
    radius: int = Query(30000, le=50000),
):
    """M4+ earthquakes within radius, last 10 years.
    Large radius (30km default) — no bbox pre-filter needed (only 20K rows)."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT e.magnitude, e.depth_km, e.event_time, e.event_location_name,
                   round(ST_Distance(e.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(e.geom) AS lng, ST_Y(e.geom) AS lat
            FROM earthquakes e, addr
            WHERE e.magnitude >= 4
              AND e.event_time >= CURRENT_DATE - interval '10 years'
              AND ST_DWithin(e.geom::geography, addr.geom::geography, %s)
            ORDER BY e.event_time DESC
            LIMIT 50
            """,
            [address_id, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Infrastructure Projects ---

@router.get("/nearby/{address_id}/infrastructure")
@limiter.limit("40/minute")
async def nearby_infrastructure(
    request: Request,
    address_id: int,
    radius: int = Query(5000, le=10000),
):
    """Infrastructure projects within radius. Only geocoded projects."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT ip.project_name, ip.sector, ip.status, ip.estimated_cost,
                   ip.city, ip.suburb,
                   round(ST_Distance(ip.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(ip.geom) AS lng, ST_Y(ip.geom) AS lat
            FROM infrastructure_projects ip, addr
            WHERE ip.geom IS NOT NULL
              AND ip.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(ip.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 30
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Building Outlines ---

@router.get("/nearby/{address_id}/buildings")
@limiter.limit("40/minute")
async def nearby_buildings(
    request: Request,
    address_id: int,
    radius: int = Query(50, le=200),
):
    """Building footprints as GeoJSON polygons (not points).
    bbox pre-filter CRITICAL — building_outlines has 3.2M rows."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT b.use_type,
                   round(ST_Area(b.geom::geography)::numeric, 1) AS area_m2,
                   round(ST_Distance(b.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_AsGeoJSON(b.geom) AS geom_geojson
            FROM building_outlines b, addr
            WHERE b.geom && ST_Expand(addr.geom, 0.001)
              AND ST_DWithin(b.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 20
            """,
            [address_id, radius],
        )
        features = [to_geojson_polygon_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- OSM Amenities ---

@router.get("/nearby/{address_id}/amenities")
@limiter.limit("40/minute")
async def nearby_amenities(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
    category: str | None = None,
):
    """OSM amenities (restaurants, shops, healthcare, etc.). Optional category filter."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT oa.name, oa.category, oa.subcategory, oa.brand,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(oa.geom) AS lng, ST_Y(oa.geom) AS lat
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, %s)
              AND (%s IS NULL OR oa.category = %s)
            ORDER BY distance_m
            LIMIT 50
            """,
            [address_id, radius, radius, category, category],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Conservation Land ---

@router.get("/nearby/{address_id}/conservation")
@limiter.limit("40/minute")
async def nearby_conservation(
    request: Request,
    address_id: int,
    radius: int = Query(2000, le=10000),
):
    """DOC conservation land (reserves, national parks) within radius."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT cl.name, cl.land_type,
                   round(ST_Distance(cl.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   round((ST_Area(cl.geom::geography) / 10000)::numeric, 1) AS area_ha,
                   ST_X(ST_Centroid(cl.geom)) AS lng, ST_Y(ST_Centroid(cl.geom)) AS lat
            FROM conservation_land cl, addr
            WHERE ST_DWithin(cl.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 20
            """,
            [address_id, radius],
        )
        features = [to_geojson_feature(r) for r in await cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}
```

---

## Register in main.py

```python
from .routers import nearby
app.include_router(nearby.router, prefix="/api/v1")
```

---

## Verification

```bash
# Schools near Cuba St (address_id 1753062):
curl "http://localhost:8000/api/v1/nearby/1753062/schools" | python -m json.tool
# Expected: ~10 schools with distance_m, eqi, in_zone fields

# Transit stops:
curl "http://localhost:8000/api/v1/nearby/1753062/transit"
# Expected: ~17 stops within 400m

# Amenities with category filter:
curl "http://localhost:8000/api/v1/nearby/1753062/amenities?category=amenity"

# Building outlines (polygon geometry):
curl "http://localhost:8000/api/v1/nearby/1753062/buildings?radius=100"
# Expected: GeoJSON with Polygon geometries, area_m2

# Non-existent address:
curl "http://localhost:8000/api/v1/nearby/999999999/schools"
# Expected: {"type":"FeatureCollection","features":[]}  (CTE returns no addr)
```

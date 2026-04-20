from __future__ import annotations
from typing import Optional, Dict, List, Any

# backend/app/routers/nearby.py
from fastapi import APIRouter, HTTPException, Query, Request

from .. import db
from ..deps import limiter
from ..services.geo_utils import to_geojson_feature, to_geojson_polygon_feature

router = APIRouter()

# --- Amenity classification ---
# Maps OSM subcategory → (sentiment, display_label)
# sentiment: "good" = family/lifestyle positive, "caution" = may concern some buyers, "info" = neutral/informative

AMENITY_CLASSES: Dict[str, tuple] = {
    # Good. family, health, culture, recreation
    "library": ("good", "Library"),
    "playground": ("good", "Playground"),
    "community_centre": ("good", "Community Centre"),
    "childcare": ("good", "Childcare"),
    "kindergarten": ("good", "Kindergarten"),
    "doctors": ("good", "Medical Centre"),
    "clinic": ("good", "Medical Clinic"),
    "hospital": ("good", "Hospital"),
    "pharmacy": ("good", "Pharmacy"),
    "dentist": ("good", "Dentist"),
    "veterinary": ("good", "Vet Clinic"),
    "arts_centre": ("good", "Arts Centre"),
    "theatre": ("good", "Theatre"),
    "museum": ("good", "Museum"),
    "gallery": ("good", "Gallery"),
    "cinema": ("good", "Cinema"),
    "swimming_pool": ("good", "Swimming Pool"),
    "fitness_centre": ("good", "Gym / Fitness"),
    "sports_centre": ("good", "Sports Centre"),
    "park": ("good", "Park"),
    "garden": ("good", "Garden"),
    "nature_reserve": ("good", "Nature Reserve"),
    "dog_park": ("good", "Dog Park"),
    "picnic_table": ("good", "Picnic Area"),
    "viewpoint": ("good", "Viewpoint"),
    "post_office": ("good", "Post Office"),
    "bank": ("good", "Bank"),
    "atm": ("good", "ATM"),
    "marketplace": ("good", "Market"),
    "college": ("good", "College"),
    "coworking_space": ("good", "Co-working Space"),
    "supermarket": ("good", "Supermarket"),
    "bakery": ("good", "Bakery"),
    "greengrocer": ("good", "Greengrocer"),

    # Caution. noise, alcohol, adult, industrial
    "bar": ("caution", "Bar"),
    "pub": ("caution", "Pub"),
    "nightclub": ("caution", "Nightclub"),
    "stripclub": ("caution", "Strip Club"),
    "brothel": ("caution", "Brothel"),
    "casino": ("caution", "Casino"),
    "bookmaker": ("caution", "Betting Shop"),
    "adult_gaming_centre": ("caution", "Gaming Venue"),
    "fuel": ("caution", "Petrol Station"),
    "car_wash": ("caution", "Car Wash"),
    "loading_dock": ("caution", "Loading Dock"),
    "waste_disposal": ("caution", "Waste Facility"),
    "recycling": ("caution", "Recycling Depot"),
    "prison": ("caution", "Prison"),
    "smoking_area": ("caution", "Smoking Area"),
    "fast_food": ("caution", "Fast Food"),

    # Info. neutral, just useful to know
    "place_of_worship": ("info", "Place of Worship"),
    "social_facility": ("info", "Social Services"),
    "shelter": ("info", "Shelter"),
    "nursing_home": ("info", "Rest Home"),
    "retirement_home": ("info", "Retirement Home"),
    "events_venue": ("info", "Events Venue"),
    "conference_centre": ("info", "Conference Centre"),
    "restaurant": ("info", "Restaurant"),
    "cafe": ("info", "Cafe"),
    "hotel": ("info", "Hotel"),
    "hostel": ("info", "Hostel"),
    "motel": ("info", "Motel"),
    "parking": ("info", "Parking"),
    "toilets": ("info", "Public Toilets"),
    "drinking_water": ("info", "Drinking Fountain"),
    "ferry_terminal": ("info", "Ferry Terminal"),
    "taxi": ("info", "Taxi Stand"),
    "car_sharing": ("info", "Car Share"),
    "car_rental": ("info", "Car Rental"),
    "bicycle_rental": ("info", "Bike Share"),
    "charging_station": ("info", "EV Charging"),
}


# --- Schools ---

@router.get("/nearby/{address_id}/schools")
@limiter.limit("40/minute")
async def nearby_schools(
    request: Request,
    address_id: int,
    radius: int = Query(1500, le=5000),
):
    """Schools within radius. Includes EQI, roll, and in-zone status."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT s.org_name AS school_name, s.org_type AS school_type,
                   s.eqi_index AS eqi, s.total_roll,
                   round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(s.geom) AS lng, ST_Y(s.geom) AS lat,
                   EXISTS(
                     SELECT 1 FROM school_zones sz
                     WHERE sz.school_name = s.org_name
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
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    bbox pre-filter critical. crashes table has 904K rows."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT c.crash_severity, c.crash_year,
                   c.fatal_count, c.serious_injury_count, c.minor_injury_count,
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
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    async with db.pool.connection() as conn:
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
        features = [to_geojson_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Heritage Sites ---

@router.get("/nearby/{address_id}/heritage")
@limiter.limit("40/minute")
async def nearby_heritage(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
):
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT hs.name AS list_name, hs.list_entry_type, hs.list_number,
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
        features = [to_geojson_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Resource Consents ---

@router.get("/nearby/{address_id}/consents")
@limiter.limit("40/minute")
async def nearby_consents(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
):
    """Granted resource consents within radius.
    Note: commencement_date is stored as raw text from ArcGIS (epoch ms for GWRC,
    text for ECan) so we can't filter by it server-side. We return recent-looking
    consents sorted by distance. Status match uses ILIKE to tolerate casing variants
    ("Granted", "granted", "GRANTED"). mirrors the report SQL in migration 0022."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT rc.consent_type, rc.status, rc.purpose_desc AS activity_description,
                   rc.commencement_date,
                   round(ST_Distance(rc.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(rc.geom) AS lng, ST_Y(rc.geom) AS lat
            FROM resource_consents rc, addr
            WHERE rc.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(rc.geom::geography, addr.geom::geography, %s)
              AND rc.status ILIKE '%%granted%%'
            ORDER BY distance_m
            LIMIT 30
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    Large radius (30km default). no bbox pre-filter needed (only 20K rows)."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT e.magnitude, e.depth_km, e.event_time, e.location_name,
                   round(ST_Distance(e.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(e.geom) AS lng, ST_Y(e.geom) AS lat
            FROM earthquakes e, addr
            WHERE e.magnitude >= 4
              AND e.event_time >= CURRENT_DATE - interval '10 years'
              AND e.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(e.geom::geography, addr.geom::geography, %s)
            ORDER BY e.event_time DESC
            LIMIT 50
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT ip.project_name, ip.sector, ip.project_status AS status,
                   ip.value_range AS estimated_cost, ip.city, ip.suburb,
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
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    bbox pre-filter CRITICAL. building_outlines has 3.2M rows."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT b.use AS use_type,
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
        features = [to_geojson_polygon_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- OSM Amenities ---

@router.get("/nearby/{address_id}/supermarkets")
@limiter.limit("40/minute")
async def nearby_supermarkets(
    request: Request,
    address_id: int,
    radius: int = Query(10000, le=10000),
):
    """5 closest supermarkets/grocery stores within radius (default 10km)."""
    async with db.pool.connection() as conn:
        query = """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT oa.name, oa.category, oa.subcategory, oa.brand,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(oa.geom) AS lng, ST_Y(oa.geom) AS lat
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, %s)
              AND oa.subcategory IN ('supermarket', 'greengrocer', 'convenience', 'grocery', 'wholesale', 'general')
            ORDER BY distance_m LIMIT 5
        """
        cur = await conn.execute(query, [address_id, radius, radius])
        features = [to_geojson_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


@router.get("/nearby/{address_id}/amenities")
@limiter.limit("40/minute")
async def nearby_amenities(
    request: Request,
    address_id: int,
    radius: int = Query(500, le=2000),
    category: Optional[str] = Query(None, max_length=50, pattern=r"^[a-z_]+$"),
):
    """OSM amenities (restaurants, shops, healthcare, etc.). Optional category filter."""
    async with db.pool.connection() as conn:
        base_query = """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT oa.name, oa.category, oa.subcategory, oa.brand,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(oa.geom) AS lng, ST_Y(oa.geom) AS lat
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, %s)
        """
        params = [address_id, radius, radius]
        if category:
            base_query += " AND oa.category = %s"
            params.append(category)
        base_query += " ORDER BY distance_m LIMIT 50"
        cur = await conn.execute(base_query, params)
        features = [to_geojson_feature(r) for r in cur.fetchall()]
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
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT cl.name, cl.land_type, cl.area_ha,
                   round(ST_Distance(cl.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                   ST_X(ST_Centroid(cl.geom)) AS lng, ST_Y(ST_Centroid(cl.geom)) AS lat
            FROM conservation_land cl, addr
            WHERE cl.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(cl.geom::geography, addr.geom::geography, %s)
            ORDER BY distance_m
            LIMIT 20
            """,
            [address_id, radius, radius],
        )
        features = [to_geojson_feature(r) for r in cur.fetchall()]
    return {"type": "FeatureCollection", "features": features}


# --- Categorised Nearby Amenities ---

@router.get("/nearby/{address_id}/highlights")
@limiter.limit("40/minute")
async def nearby_highlights(
    request: Request,
    address_id: int,
    radius: int = Query(1500, le=3000),
):
    """Nearby amenities classified as good / caution / info.
    Returns deduplicated list grouped by sentiment, closest first."""
    target_subcats = tuple(AMENITY_CLASSES.keys())
    # Build IN clause with positional placeholders
    placeholders = ",".join(["%s"] * len(target_subcats))

    async with db.pool.connection() as conn:
        cur = await conn.execute(
            f"""
            WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
            SELECT DISTINCT ON (oa.subcategory)
                   oa.name, oa.subcategory,
                   round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m
            FROM osm_amenities oa, addr
            WHERE oa.geom && ST_Expand(addr.geom, %s * 0.00001)
              AND ST_DWithin(oa.geom::geography, addr.geom::geography, %s)
              AND oa.subcategory IN ({placeholders})
            ORDER BY oa.subcategory, ST_Distance(oa.geom, addr.geom)
            """,
            [address_id, radius, radius, *target_subcats],
        )
        rows = cur.fetchall()

    good: List[Dict[str, Any]] = []
    caution: List[Dict[str, Any]] = []
    info: List[Dict[str, Any]] = []

    for r in rows:
        subcat = r["subcategory"]
        if subcat not in AMENITY_CLASSES:
            continue
        sentiment, label = AMENITY_CLASSES[subcat]
        item = {
            "name": r["name"] or label,
            "label": label,
            "subcategory": subcat,
            "distance_m": float(r["distance_m"]),
        }
        if sentiment == "good":
            good.append(item)
        elif sentiment == "caution":
            caution.append(item)
        else:
            info.append(item)

    good.sort(key=lambda x: x["distance_m"])
    caution.sort(key=lambda x: x["distance_m"])
    info.sort(key=lambda x: x["distance_m"])

    return {"good": good, "caution": caution, "info": info}

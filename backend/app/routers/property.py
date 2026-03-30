from __future__ import annotations

# backend/app/routers/property.py
import asyncio
import hashlib
import logging

import orjson

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse

from .. import db
from ..deps import limiter
from ..redis import cache_get, cache_set, cache_del
from ..services.auth import _extract_bearer, verify_jwt
from ..services.event_writer import track_event, log_error
from slowapi.util import get_remote_address


def _verified_user_or_ip(request: Request) -> str:
    """Rate-limit key: verified user_id for authenticated requests, IP for anonymous."""
    token = _extract_bearer(request)
    if token:
        try:
            payload = verify_jwt(token)
            uid = payload.get("sub")
            if uid:
                return f"user:{uid}"
        except Exception:
            pass
    return get_remote_address(request)
from ..services.credit_check import require_paid_user, CreditInfo
from ..services.ai_summary import generate_pdf_insights, generate_property_summary
from ..services.property_detection import detect_property_type
from ..services.report_html import build_insights, build_lifestyle_fit, build_recommendations
from ..services.report_html import render as render_report_html
from ..services.risk_score import enrich_with_scores
from ..services.pdf_jobs import (
    create_job, get_job_status, get_job_html,
    set_job_generating, set_job_completed, set_job_failed,
)
from ..config import settings

router = APIRouter()


async def _fix_unit_cv(report: dict, address_id: int) -> None:
    """Fix CV using live council rates API for all supported cities.
    Falls back to WCC rates cache for Wellington unit lookups."""
    full_address = (report.get("address") or {}).get("full_address", "")
    city = (report.get("address") or {}).get("city", "")
    city_lower = city.lower()

    try:
        rates_data = None
        if "wellington" in city_lower:
            # Wellington: try WCC rates cache first (fast, for units)
            async with db.pool.connection() as conn_cv:
                cur_cv = await conn_cv.execute(
                    "SELECT unit_value, address_number, road_name, road_type_name FROM addresses WHERE address_id = %s",
                    [address_id],
                )
                addr_row = cur_cv.fetchone()
                if addr_row and addr_row.get("unit_value"):
                    uv = addr_row["unit_value"]
                    street = f"{addr_row.get('address_number', '')} {addr_row.get('road_name', '')}"
                    if addr_row.get("road_type_name"):
                        street += f" {addr_row['road_type_name']}"
                    street = street.strip()
                    if street:
                        cur_cv = await conn_cv.execute(
                            "SELECT capital_value, land_value, improvements_value FROM wcc_rates_cache "
                            "WHERE capital_value > 0 AND (address ILIKE %s OR address ILIKE %s OR address ILIKE %s) LIMIT 1",
                            [f"Unit {uv} {street}%", f"Apt {uv} {street}%", f"Flat {uv} {street}%"],
                        )
                        rates = cur_cv.fetchone()
                        if rates and report.get("property"):
                            report["property"]["capital_value"] = rates["capital_value"]
                            report["property"]["land_value"] = rates["land_value"] or 0
                            report["property"]["improvements_value"] = rates["improvements_value"] or 0
                            report["property"]["cv_is_per_unit"] = True
        elif "auckland" in city_lower:
            from ..services.auckland_rates import fetch_auckland_rates
            async with db.pool.connection() as c:
                rates_data = await fetch_auckland_rates(full_address, c)
        elif city_lower == "lower hutt":
            from ..services.hcc_rates import fetch_hcc_rates
            rates_data = await fetch_hcc_rates(full_address)
        elif "upper hutt" in city_lower:
            from ..services.uhcc_rates import fetch_uhcc_rates
            rates_data = await fetch_uhcc_rates(full_address)
        elif city_lower == "porirua":
            from ..services.pcc_rates import fetch_pcc_rates
            rates_data = await fetch_pcc_rates(full_address)
        elif "kapiti" in city_lower or city_lower in ("paraparaumu", "waikanae", "otaki"):
            from ..services.kcdc_rates import fetch_kcdc_rates
            rates_data = await fetch_kcdc_rates(full_address)
        elif "hamilton" in city_lower:
            from ..services.hamilton_rates import fetch_hamilton_rates
            rates_data = await fetch_hamilton_rates(full_address)
        elif "dunedin" in city_lower:
            from ..services.dcc_rates import fetch_dcc_rates
            rates_data = await fetch_dcc_rates(full_address)
        elif "christchurch" in city_lower:
            from ..services.ccc_rates import fetch_ccc_rates
            async with db.pool.connection() as c:
                rates_data = await fetch_ccc_rates(full_address, c)
        elif city_lower == "new plymouth":
            from ..services.taranaki_rates import fetch_taranaki_rates
            rates_data = await fetch_taranaki_rates(full_address)
        elif city_lower in ("richmond", "motueka", "takaka", "mapua"):
            from ..services.tasman_rates import fetch_tasman_rates
            rates_data = await fetch_tasman_rates(full_address)
        elif "tauranga" in city_lower or city_lower == "mount maunganui":
            from ..services.tcc_rates import fetch_tcc_rates
            rates_data = await fetch_tcc_rates(full_address)
        elif "palmerston" in city_lower:
            from ..services.pncc_rates import fetch_pncc_rates
            rates_data = await fetch_pncc_rates(full_address)
        elif "whangarei" in city_lower or "whangārei" in city_lower:
            from ..services.wdc_rates import fetch_wdc_rates
            rates_data = await fetch_wdc_rates(full_address)
        elif "queenstown" in city_lower or city_lower in ("wanaka", "arrowtown", "frankton"):
            from ..services.qldc_rates import fetch_qldc_rates
            rates_data = await fetch_qldc_rates(full_address)
        elif "invercargill" in city_lower:
            from ..services.icc_rates import fetch_icc_rates
            rates_data = await fetch_icc_rates(full_address)
        elif "hastings" in city_lower or city_lower in ("havelock north", "flaxmere"):
            from ..services.hastings_rates import fetch_hastings_rates
            rates_data = await fetch_hastings_rates(full_address)
        elif "gisborne" in city_lower:
            from ..services.gdc_rates import fetch_gdc_rates
            rates_data = await fetch_gdc_rates(full_address)
        elif "nelson" in city_lower:
            from ..services.ncc_rates import fetch_ncc_rates
            rates_data = await fetch_ncc_rates(full_address)
        elif "rotorua" in city_lower:
            from ..services.rlc_rates import fetch_rlc_rates
            rates_data = await fetch_rlc_rates(full_address)
        elif "timaru" in city_lower or city_lower in ("temuka", "geraldine"):
            from ..services.timaru_rates import fetch_timaru_rates
            rates_data = await fetch_timaru_rates(full_address)
        elif "blenheim" in city_lower or "marlborough" in city_lower or city_lower in ("picton", "renwick"):
            from ..services.mdc_rates import fetch_mdc_rates
            rates_data = await fetch_mdc_rates(full_address)
        elif "whanganui" in city_lower or "wanganui" in city_lower:
            from ..services.wdc_whanganui_rates import fetch_whanganui_rates
            rates_data = await fetch_whanganui_rates(full_address)
        elif "horowhenua" in city_lower or city_lower in ("levin", "foxton"):
            from ..services.hdc_rates import fetch_hdc_rates
            rates_data = await fetch_hdc_rates(full_address)

        # Apply CV from rates API (generic handler)
        if rates_data and rates_data.get("current_valuation"):
            cv_data = rates_data["current_valuation"]
            live_cv = cv_data.get("capital_value")
            if live_cv and report.get("property"):
                report["property"]["capital_value"] = live_cv
                report["property"]["land_value"] = cv_data.get("land_value") or 0
                report["property"]["improvements_value"] = cv_data.get("improvements_value") or 0
                report["property"]["cv_is_per_unit"] = True
    except Exception:
        pass  # non-critical — fall back to SQL report CV
    report["_cv_from_rates"] = True


async def _overlay_transit_data(report: dict, address_id: int) -> None:
    """Overlay transit data from all sources (metlink, AT, regional).

    The SQL report function only queries metlink_stops (Wellington).
    This function checks if transit data is missing and fills it from
    at_stops (Auckland) or transit_stops (regional cities)."""
    try:
        liveability = report.get("liveability") or {}
        # Skip if already has travel times (Wellington/metlink worked)
        if liveability.get("transit_travel_times"):
            return

        async with db.pool.connection() as conn_tt:
            cur = await conn_tt.execute(
                "SELECT get_transit_data(%s) AS data", [address_id]
            )
            row = cur.fetchone()
            if not row or not row["data"]:
                return

            transit = row["data"]

            # Only overlay if we actually found transit data
            if not transit.get("transit_travel_times") and not transit.get("bus_stops_800m"):
                return

            # Merge into liveability section
            for key in ("bus_stops_800m", "rail_stops_800m", "ferry_stops_800m",
                        "cable_car_stops_800m", "transit_travel_times",
                        "transit_travel_times_pm",
                        "peak_trips_per_hour", "nearest_stop_name"):
                val = transit.get(key)
                if val is not None and val != 0:
                    liveability[key] = val

            # Fix nearest_train — the base SQL only checks metlink (Wellington).
            # Look up the actual nearest rail station from AT or regional tables.
            if transit.get("rail_stops_800m", 0) > 0:
                try:
                    cur_rail = await conn_tt.execute("""
                        WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                        SELECT stop_name, round(ST_Distance(s.geom::geography, addr.geom::geography)::numeric) AS dist_m
                        FROM (
                            SELECT stop_name, geom FROM at_stops WHERE 2 = ANY(route_types)
                            UNION ALL
                            SELECT stop_name, geom FROM transit_stops WHERE location_type = 1
                            UNION ALL
                            SELECT stop_name, geom FROM metlink_stops WHERE route_type = 2
                        ) s, addr
                        WHERE ST_DWithin(s.geom::geography, addr.geom::geography, 50000)
                        ORDER BY s.geom <-> addr.geom LIMIT 1
                    """, [address_id])
                    rail_row = cur_rail.fetchone()
                    if rail_row:
                        liveability["nearest_train_name"] = rail_row["stop_name"]
                        liveability["nearest_train_distance_m"] = int(rail_row["dist_m"])
                except Exception:
                    pass  # non-critical
    except Exception as e:
        logger.debug(f"Transit overlay failed for {address_id}: {e}")


async def _overlay_terrain_data(report: dict, address_id: int) -> None:
    """Add terrain (elevation, slope, aspect) and walking isochrone data to the report.

    Calls Valhalla for hill-aware walking isochrone + multi-point elevation sampling.
    Falls back gracefully if Valhalla is unavailable — terrain section simply won't appear."""
    try:
        from ..services.walking_isochrone import (
            get_terrain_at_property,
            count_stops_in_isochrone,
            classify_landslide_risk_from_slope,
        )

        async with db.pool.connection() as conn:
            # Fetch terrain + isochrone sequentially (share same connection)
            terrain = await get_terrain_at_property(conn, address_id)
            isochrone = await count_stops_in_isochrone(conn, address_id, minutes=10)

            # Waterway proximity — nearest river/stream/drain within 500m
            try:
                cur = await conn.execute("""
                    WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                    SELECT w.name, w.feat_type,
                           round(ST_Distance(w.geom::geography, addr.geom::geography)::numeric) AS distance_m
                    FROM nz_waterways w, addr
                    WHERE ST_DWithin(w.geom::geography, addr.geom::geography, 500)
                    ORDER BY ST_Distance(w.geom::geography, addr.geom::geography)
                    LIMIT 3
                """, [address_id])
                waterway_rows = cur.fetchall()
                if waterway_rows:
                    nearest = waterway_rows[0]
                    terrain["nearest_waterway_m"] = int(nearest["distance_m"])
                    terrain["nearest_waterway_name"] = nearest["name"]
                    terrain["nearest_waterway_type"] = nearest["feat_type"]
                    terrain["waterways_within_500m"] = len(waterway_rows)
                else:
                    terrain["nearest_waterway_m"] = None
                    terrain["nearest_waterway_name"] = None
                    terrain["nearest_waterway_type"] = None
                    terrain["waterways_within_500m"] = 0
            except Exception:
                # Table may not exist yet if waterways haven't been loaded
                terrain["nearest_waterway_m"] = None
                terrain["nearest_waterway_name"] = None
                terrain["nearest_waterway_type"] = None
                terrain["waterways_within_500m"] = 0

        # Add landslide risk classification from slope
        if terrain.get("slope_degrees") is not None:
            terrain["landslide_risk"] = classify_landslide_risk_from_slope(
                terrain["slope_degrees"]
            )

        report["terrain"] = terrain
        report["walking_reach"] = {
            "minutes": 10,
            "method": isochrone.get("isochrone_method", "none"),
            "total_stops": isochrone.get("transit_stops_walk_10min", 0),
            "bus_stops": isochrone.get("bus_stops_walk_10min", 0),
            "rail_stops": isochrone.get("rail_stops_walk_10min", 0),
            "ferry_stops": isochrone.get("ferry_stops_walk_10min", 0),
        }

        # Also update liveability section with walking reach data for backwards compat
        live = report.get("liveability") or {}
        live["walking_reach_10min"] = isochrone.get("transit_stops_walk_10min", 0)
        live["walking_reach_method"] = isochrone.get("isochrone_method", "none")
    except Exception as e:
        logger.warning(f"Terrain overlay failed for {address_id}: {e}")


async def _overlay_event_history(report: dict, address_id: int) -> None:
    """Surface historical weather events and earthquake activity near the property.

    Queries weather_events (5yr, 50km) and earthquakes (10yr, 30km) already in the
    database and adds a summary to the on-screen report so users see what has
    happened in this area — even on the free tier."""
    try:
        async with db.pool.connection() as conn:
            # Weather events — critical/warning within 50km, last 5 years
            cur = await conn.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT we.event_type, we.severity, we.title,
                       we.precipitation_mm, we.wind_gust_kmh, we.event_date,
                       round(ST_Distance(we.geom::geography, addr.geom::geography)::numeric / 1000, 1) AS dist_km
                FROM weather_events we, addr
                WHERE ST_DWithin(we.geom::geography, addr.geom::geography, 50000)
                  AND we.event_date >= (CURRENT_DATE - interval '5 years')
                  AND we.severity IN ('critical', 'warning')
                ORDER BY we.event_date DESC
                LIMIT 50
            """, [address_id])
            weather_rows = cur.fetchall()

            # Earthquakes — M4+ within 30km, last 10 years
            cur = await conn.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT eq.magnitude, eq.depth_km, eq.event_time, eq.location_name,
                       round(ST_Distance(eq.geom::geography, addr.geom::geography)::numeric / 1000, 1) AS dist_km
                FROM earthquakes eq, addr
                WHERE ST_DWithin(eq.geom::geography, addr.geom::geography, 30000)
                  AND eq.magnitude >= 4.0
                  AND eq.event_time >= (CURRENT_DATE - interval '10 years')
                ORDER BY eq.magnitude DESC
                LIMIT 50
            """, [address_id])
            quake_rows = cur.fetchall()

        # Summarise weather events
        heavy_rain = [r for r in weather_rows if r["event_type"] == "heavy_rain"]
        extreme_wind = [r for r in weather_rows if r["event_type"] == "extreme_wind"]
        worst_rain = max((float(r["precipitation_mm"]) for r in weather_rows if r["precipitation_mm"]), default=None)
        worst_wind = max((float(r["wind_gust_kmh"]) for r in weather_rows if r["wind_gust_kmh"]), default=None)

        # Top 5 most notable events (mix of weather + quakes)
        top_events = []
        for r in sorted(weather_rows, key=lambda x: x["precipitation_mm"] or 0, reverse=True)[:3]:
            top_events.append({
                "type": r["event_type"],
                "date": r["event_date"].isoformat() if hasattr(r["event_date"], "isoformat") else str(r["event_date"]),
                "title": r["title"],
                "severity": r["severity"],
                "detail": f"{r['precipitation_mm']:.0f}mm rain" if r["precipitation_mm"] else f"{r['wind_gust_kmh']:.0f}km/h wind" if r["wind_gust_kmh"] else None,
                "distance_km": float(r["dist_km"]) if r["dist_km"] else None,
            })
        for r in quake_rows[:2]:
            top_events.append({
                "type": "earthquake",
                "date": r["event_time"].isoformat() if hasattr(r["event_time"], "isoformat") else str(r["event_time"]),
                "title": f"M{r['magnitude']:.1f} earthquake" + (f" — {r['location_name']}" if r["location_name"] else ""),
                "severity": "critical" if r["magnitude"] >= 5.0 else "warning",
                "detail": f"M{r['magnitude']:.1f}, {r['depth_km']:.0f}km deep" if r["depth_km"] else f"M{r['magnitude']:.1f}",
                "distance_km": float(r["dist_km"]) if r["dist_km"] else None,
            })

        report["event_history"] = {
            "extreme_weather_5yr": len(weather_rows),
            "heavy_rain_events": len(heavy_rain),
            "extreme_wind_events": len(extreme_wind),
            "worst_rain_mm": worst_rain,
            "worst_wind_kmh": worst_wind,
            "earthquakes_30km_10yr": len(quake_rows),
            "largest_quake_magnitude": float(quake_rows[0]["magnitude"]) if quake_rows else None,
            "top_events": top_events[:5],
        }
    except Exception as e:
        logger.warning(f"Event history overlay failed for {address_id}: {e}")


@router.get("/property/{address_id}/report")
@limiter.limit("20/minute", key_func=_verified_user_or_ip)
@limiter.limit("5/minute", key_func=get_remote_address)
async def get_report(request: Request, address_id: int, fast: bool = Query(False)):
    """Full property report with risk scores.
    Calls get_property_report() PL/pgSQL function, enriches with Python scoring.
    AI summary is NOT included — fetch separately from /ai-summary.
    Cached 24h in Redis.

    ?fast=true skips Valhalla terrain/isochrone overlay (saves ~5-15s on cold cache).
    The full report (without ?fast) should be fetched in the background to enrich terrain data."""

    logger.info(f"get_report called for address_id={address_id}, db.pool={db.pool}")

    # 1. Check Redis cache
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
        dirty = False
        # Re-enrich if scores are missing (stale cache from before scoring was added)
        if not (report.get("scores") or {}).get("composite"):
            report = enrich_with_scores(report)
            dirty = True
        # _cv_from_rates check removed — CV is now fetched lazily via /rates endpoint
        if dirty:
            await cache_set(cache_key, orjson.dumps(report), ex=86400)
        return report

    # 2. Call PL/pgSQL function — single DB round-trip
    import time as _time
    _t0 = _time.monotonic()
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT get_property_report(%s) AS report", [address_id]
        )
        row = cur.fetchone()
    _t_sql = _time.monotonic() - _t0
    print(f"[PERF] SQL get_property_report: {_t_sql:.2f}s for {address_id}")

    if not row or not row["report"]:
        raise HTTPException(404, "Address not found")

    # 3. Compute risk scores + run detection + fetch area profile concurrently
    _t1 = _time.monotonic()
    report = enrich_with_scores(row["report"])
    print(f"[PERF] enrich_with_scores: {_time.monotonic() - _t1:.2f}s")

    sa2_code = (report.get("address") or {}).get("sa2_code")

    async def _get_detection():
        _td = _time.monotonic()
        async with db.pool.connection() as conn_det:
            result = await detect_property_type(conn_det, address_id)
        print(f"[PERF]   detect_property_type: {_time.monotonic() - _td:.2f}s")
        return result

    async def _get_area_profile():
        _ta = _time.monotonic()
        if not sa2_code:
            print(f"[PERF]   area_profile: skipped (no sa2)")
            return None
        async with db.pool.connection() as conn2:
            cur2 = await conn2.execute(
                "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
            )
            pr = cur2.fetchone()
        print(f"[PERF]   area_profile: {_time.monotonic() - _ta:.2f}s")
        return pr["profile"] if pr else None

    _t2 = _time.monotonic()
    detection, area_profile = await asyncio.gather(_get_detection(), _get_area_profile())
    print(f"[PERF] detection + area_profile: {_time.monotonic() - _t2:.2f}s")

    if detection:
        report["property_detection"] = detection
    report["area_profile"] = area_profile
    report["ai_summary"] = None  # fetched separately via /ai-summary

    # Run all overlays concurrently — each writes to distinct report keys so no conflicts.
    # CV is no longer fetched here — the frontend /rates endpoint handles it lazily.
    # fast=True skips Valhalla terrain calls (~5-15s) for a quick first render;
    # the frontend follows up with a full request to fill in terrain/walking_reach.
    overlays = [
        _overlay_transit_data(report, address_id),
        _overlay_event_history(report, address_id),
    ]
    if not fast:
        overlays.append(_overlay_terrain_data(report, address_id))

    _t3 = _time.monotonic()
    await asyncio.gather(*overlays)
    print(f"[PERF] overlays (fast={fast}): {_time.monotonic() - _t3:.2f}s")
    print(f"[PERF] TOTAL: {_time.monotonic() - _t0:.2f}s for {address_id} (fast={fast})")

    # Re-enrich scores now that terrain + event_history are available
    # (terrain-inferred flood/wind boosts and event-history boosts need these fields)
    report = enrich_with_scores(report)

    # Tag fast responses so the frontend knows terrain is pending
    if fast:
        report["_terrain_pending"] = True

    # 4. Cache 24h
    await cache_set(cache_key, orjson.dumps(report).decode(), ex=86400)

    track_event("report_view", properties={"address_id": address_id})
    return report


# --- Crime Trend ---

@router.get("/property/{address_id}/crime-trend")
@limiter.limit("30/minute")
async def get_crime_trend(request: Request, address_id: int):
    """Monthly crime victimisations for the property's area unit, last 3 years.
    Cached 24h by area_unit."""

    # 1. Get SA2 name for this address (used as area_unit lookup)
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT sa2.sa2_name
            FROM addresses a
            JOIN LATERAL (
                SELECT sa2_name FROM sa2_boundaries
                WHERE geom && a.geom AND ST_Within(a.geom, geom) LIMIT 1
            ) sa2 ON true
            WHERE a.address_id = %s
            """,
            [address_id],
        )
        row = cur.fetchone()
    if not row or not row.get("sa2_name"):
        return []

    area_unit = row["sa2_name"]

    # 2. Check cache
    cache_key = f"crime-trend:{area_unit}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 3. Query monthly crime counts
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT to_char(year_month, 'YYYY-MM') AS month,
                   SUM(victimisations)::int AS count
            FROM crime
            WHERE area_unit = %s
              AND year_month >= (CURRENT_DATE - INTERVAL '3 years')
            GROUP BY year_month
            ORDER BY year_month
            """,
            [area_unit],
        )
        rows = cur.fetchall()

    result = [{"month": r["month"], "count": r["count"]} for r in rows]

    # 4. Cache 24h
    await cache_set(cache_key, orjson.dumps(result).decode(), ex=86400)

    return result


# --- Earthquake Timeline ---

@router.get("/property/{address_id}/earthquake-timeline")
@limiter.limit("30/minute")
async def get_earthquake_timeline(request: Request, address_id: int):
    """Annual earthquake count + max magnitude within 50km, last 10 years.
    Cached 24h by lat/lng bucket."""

    # 1. Get property location
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT ST_Y(geom) AS lat, ST_X(geom) AS lng FROM addresses WHERE address_id = %s",
            [address_id],
        )
        row = cur.fetchone()
    if not row:
        return []

    lat, lng = row["lat"], row["lng"]
    # Bucket to 0.1 degree for caching
    lat_bucket = round(lat, 1)
    lng_bucket = round(lng, 1)

    cache_key = f"eq-timeline:{lat_bucket}:{lng_bucket}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 2. Query annual earthquake data within 50km
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT EXTRACT(YEAR FROM event_time)::int AS year,
                   COUNT(*)::int AS count,
                   ROUND(MAX(magnitude)::numeric, 1) AS max_mag
            FROM earthquakes
            WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 50000)
              AND event_time >= (CURRENT_DATE - INTERVAL '10 years')
            GROUP BY 1
            ORDER BY 1
            """,
            [lng, lat],
        )
        rows = cur.fetchall()

    result = [{"year": r["year"], "count": r["count"], "max_mag": float(r["max_mag"] or 0)} for r in rows]

    await cache_set(cache_key, orjson.dumps(result).decode(), ex=86400)

    return result


# --- Council Rates (live per-property lookup) ---

@router.get("/property/{address_id}/rates")
@limiter.limit("10/minute")
async def get_property_rates(request: Request, address_id: int):
    """Fetch live council rates/valuation for a property.
    Hits the council API, caches result, and updates council_valuations in DB.
    Returns null if no rates service exists for this city."""

    # 1. Redis cache (1h — shorter than report cache since rates can change)
    cache_key = f"rates:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 2. Get address info
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT full_address, town_city FROM addresses WHERE address_id = %s",
            [address_id],
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Address not found")

    full_address = row["full_address"] or ""
    city = (row["town_city"] or "").lower()

    # 3. Dispatch to city-specific rates service
    rates_data = None
    try:
        async def _fetch():
            if "wellington" in city:
                from ..services.rates import fetch_wcc_rates
                async with db.pool.connection() as c:
                    return await fetch_wcc_rates(full_address, c)
            elif "auckland" in city:
                from ..services.auckland_rates import fetch_auckland_rates
                async with db.pool.connection() as c:
                    return await fetch_auckland_rates(full_address, c)
            elif city == "lower hutt":
                from ..services.hcc_rates import fetch_hcc_rates
                return await fetch_hcc_rates(full_address)
            elif city == "porirua":
                from ..services.pcc_rates import fetch_pcc_rates
                return await fetch_pcc_rates(full_address)
            elif "kapiti" in city or city in ("paraparaumu", "waikanae", "otaki", "paekakariki", "raumati"):
                from ..services.kcdc_rates import fetch_kcdc_rates
                return await fetch_kcdc_rates(full_address)
            elif "horowhenua" in city or city in ("levin", "foxton", "shannon"):
                from ..services.hdc_rates import fetch_hdc_rates
                return await fetch_hdc_rates(full_address)
            elif "hamilton" in city:
                from ..services.hamilton_rates import fetch_hamilton_rates
                return await fetch_hamilton_rates(full_address)
            elif "dunedin" in city:
                from ..services.dcc_rates import fetch_dcc_rates
                return await fetch_dcc_rates(full_address)
            elif "christchurch" in city:
                from ..services.ccc_rates import fetch_ccc_rates
                async with db.pool.connection() as c:
                    return await fetch_ccc_rates(full_address, c)
            elif city == "new plymouth":
                from ..services.taranaki_rates import fetch_taranaki_rates
                return await fetch_taranaki_rates(full_address)
            elif city in ("richmond", "motueka", "takaka", "mapua", "brightwater", "wakefield"):
                from ..services.tasman_rates import fetch_tasman_rates
                return await fetch_tasman_rates(full_address)
            return None
        rates_data = await asyncio.wait_for(_fetch(), timeout=15.0)
    except asyncio.TimeoutError:
        logger.warning(f"Rates fetch timed out for {address_id}")
    except Exception as e:
        logger.warning(f"Rates fetch failed for {address_id}: {e}")

    if not rates_data:
        # Cache null result too (avoid hammering API)
        await cache_set(cache_key, b"null", ex=3600)
        return None

    # 4. Update council_valuations with fresh CV from live API
    cv_data = rates_data.get("current_valuation") or {}
    cv = cv_data.get("capital_value")
    lv = cv_data.get("land_value")
    iv = cv_data.get("improvements_value")
    if cv:
        try:
            async with db.pool.connection() as conn:
                # Update the council_valuations row that contains this address
                await conn.execute(
                    """
                    UPDATE council_valuations cv
                    SET capital_value = %s, land_value = %s, improvements_value = %s
                    FROM addresses a
                    WHERE a.address_id = %s
                      AND ST_Contains(cv.geom, a.geom)
                    """,
                    [cv, lv or 0, iv or 0, address_id],
                )
                # Also invalidate the report cache so next view picks up new CV
                await cache_del(f"report:{address_id}")
        except Exception as e:
            logger.warning(f"Failed to update council_valuations for {address_id}: {e}")

    # 5. Cache result
    await cache_set(cache_key, orjson.dumps(rates_data).decode(), ex=3600)
    return rates_data


# --- Area Activity Feed (live external APIs) ---

# Map TA / city names to MetService region slugs
_METSERVICE_REGION_MAP: dict[str, str] = {
    "auckland": "auckland",
    "hamilton": "waikato",
    "tauranga": "bay-of-plenty",
    "rotorua": "bay-of-plenty",
    "whakatane": "bay-of-plenty",
    "gisborne": "gisborne",
    "napier": "hawkes-bay",
    "hastings": "hawkes-bay",
    "new plymouth": "taranaki",
    "whanganui": "manawatu-whanganui",
    "palmerston north": "manawatu-whanganui",
    "wellington": "wellington",
    "lower hutt": "wellington",
    "upper hutt": "wellington",
    "porirua": "wellington",
    "nelson": "nelson",
    "blenheim": "marlborough",
    "greymouth": "west-coast",
    "christchurch": "canterbury",
    "timaru": "canterbury",
    "dunedin": "otago",
    "queenstown": "otago",
    "invercargill": "southland",
    "whangarei": "northland",
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in km between two WGS84 points."""
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _mmi_description(mmi: int) -> str:
    """Human-readable MMI shaking description."""
    descs = {
        1: "unnoticeable", 2: "weak", 3: "weak", 4: "light",
        5: "moderate", 6: "strong", 7: "severe", 8: "extreme",
    }
    return descs.get(mmi, "severe" if mmi >= 7 else "light")


def _quake_severity(mag: float, mmi: int) -> str:
    if mag >= 5.5 or mmi >= 6:
        return "critical"
    if mag >= 4.0 or mmi >= 4:
        return "warning"
    return "info"


@router.get("/property/{address_id}/area-feed")
@limiter.limit("20/minute")
async def get_area_feed(request: Request, address_id: int):
    """Live area activity feed from NZ government APIs.
    Fetches earthquakes, NEMA alerts, MetService warnings, and volcanic alerts.
    Cached 30 min in Redis."""

    import requests as req_lib
    from datetime import datetime, timezone, timedelta
    import xml.etree.ElementTree as ET

    # 1. Check Redis cache
    cache_key = f"area-feed:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        return orjson.loads(cached)

    # 2. Get property location and region info
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT ST_Y(geom) AS lat, ST_X(geom) AS lng,
                   town_city, territorial_authority
            FROM addresses WHERE address_id = %s
            """,
            [address_id],
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Address not found")

    prop_lat = row["lat"]
    prop_lng = row["lng"]
    city = (row["town_city"] or "").strip()
    ta = (row["territorial_authority"] or "").strip()
    city_lower = city.lower()
    ta_lower = ta.lower()

    # Resolve MetService region slug
    ms_region = _METSERVICE_REGION_MAP.get(city_lower)
    if not ms_region:
        # Try matching on TA keywords
        for key, slug in _METSERVICE_REGION_MAP.items():
            if key in ta_lower:
                ms_region = slug
                break

    now = datetime.now(timezone.utc)
    events: list[dict] = []

    # --- Source fetchers (each wrapped in try/except) ---

    def _fetch_geonet_quakes() -> list[dict]:
        """Fetch GeoNet felt earthquakes and filter by distance/time."""
        try:
            resp = req_lib.get(
                "https://api.geonet.org.nz/quake?MMI=3",
                headers={"Accept": "application/json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"GeoNet quake fetch failed: {e}")
            return []

        cutoff_30d = now - timedelta(days=30)
        cutoff_365d = now - timedelta(days=365)
        results = []

        for q in data.get("features", []):
            props = q.get("properties", {})
            coords = (q.get("geometry") or {}).get("coordinates", [])
            if len(coords) < 2:
                continue

            q_lng, q_lat = coords[0], coords[1]
            dist = _haversine_km(prop_lat, prop_lng, q_lat, q_lng)
            if dist > 100:
                continue

            mag = props.get("magnitude", 0)
            mmi = props.get("mmi", 0)
            time_str = props.get("time", "")

            # Parse time
            try:
                q_time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            except Exception:
                continue

            # Filter: M4+ in last 365 days, M3+ in last 30 days
            if mag >= 4.0 and q_time >= cutoff_365d:
                pass  # include
            elif mag >= 3.0 and q_time >= cutoff_30d:
                pass  # include
            else:
                continue

            dist_rounded = round(dist, 1)
            severity = _quake_severity(mag, mmi)
            results.append({
                "source": "geonet",
                "type": "earthquake",
                "severity": severity,
                "title": f"M{mag} earthquake — {dist_rounded}km from property",
                "description": (
                    f"Magnitude {mag}, depth {props.get('depth', '?')}km, "
                    f"MMI {mmi} ({_mmi_description(mmi)} shaking)"
                    + (f", near {props.get('locality', '')}" if props.get("locality") else "")
                ),
                "timestamp": q_time.isoformat(),
                "distance_km": dist_rounded,
                "magnitude": mag,
                "mmi": mmi,
                "active": False,
            })

        # Sort by time descending
        results.sort(key=lambda e: e["timestamp"], reverse=True)
        return results

    def _fetch_metservice_warnings() -> list[dict]:
        """Fetch MetService CAP/Atom weather warnings (watches, warnings, advisories).

        MetService publishes a CC-BY-4.0 CAP Atom feed at:
          https://alerts.metservice.com/cap/atom
        Each <entry> has a title, summary, and category. We filter by region relevance.
        """
        try:
            resp = req_lib.get(
                "https://alerts.metservice.com/cap/atom",
                timeout=10,
            )
            resp.raise_for_status()
            raw_xml = resp.text
        except Exception as e:
            logger.warning(f"MetService CAP fetch failed: {e}")
            return []

        results = []
        try:
            root = ET.fromstring(raw_xml)
            ns = {"atom": "http://www.w3.org/2005/Atom"}

            for entry in root.findall(".//atom:entry", ns):
                title_el = entry.find("atom:title", ns)
                summary_el = entry.find("atom:summary", ns)
                updated_el = entry.find("atom:updated", ns)

                title = title_el.text if title_el is not None else ""
                summary = summary_el.text if summary_el is not None else ""
                updated = updated_el.text if updated_el is not None else ""

                # Check if alert is relevant to this property's region/city
                text_blob = f"{title} {summary}".lower()
                is_relevant = False
                for term in [city_lower, ta_lower, ms_region.lower() if ms_region else ""]:
                    if term and term in text_blob:
                        is_relevant = True
                        break
                if "new zealand" in text_blob or "nationwide" in text_blob:
                    is_relevant = True
                if not is_relevant:
                    continue

                # Determine severity from title keywords
                severity = "info"
                title_upper = title.upper()
                if any(w in title_upper for w in ["EXTREME", "EMERGENCY", "EVACUAT", "RED"]):
                    severity = "critical"
                elif any(w in title_upper for w in ["WARNING", "SEVERE"]):
                    severity = "warning"

                try:
                    ts = datetime.fromisoformat(updated.replace("Z", "+00:00"))
                except Exception:
                    ts = now

                results.append({
                    "source": "metservice",
                    "type": "weather_warning",
                    "severity": severity,
                    "title": title.strip() if title else "Weather Alert",
                    "description": (summary.strip() if summary else "")[:500],
                    "timestamp": ts.isoformat(),
                    "distance_km": None,
                    "active": True,
                })
        except ET.ParseError as e:
            logger.warning(f"MetService CAP XML parse failed: {e}")

        return results

    def _fetch_volcanic_alerts() -> list[dict]:
        """Fetch GeoNet volcanic alert levels."""
        try:
            resp = req_lib.get(
                "https://api.geonet.org.nz/volcano/val",
                headers={"Accept": "application/json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning(f"GeoNet volcanic alert fetch failed: {e}")
            return []

        results = []
        for v in data.get("features", []):
            props = v.get("properties", {})
            coords = (v.get("geometry") or {}).get("coordinates", [])
            if len(coords) < 2:
                continue

            v_lng, v_lat = coords[0], coords[1]
            dist = _haversine_km(prop_lat, prop_lng, v_lat, v_lng)
            if dist > 100:
                continue

            level = props.get("level", 0)
            if level == 0:
                continue  # No alert

            name = props.get("volcanoTitle", props.get("volcanoID", "Unknown"))
            hazards = props.get("hazards", "")
            activity = props.get("activity", "")

            if level >= 3:
                severity = "critical"
            elif level >= 2:
                severity = "warning"
            else:
                severity = "info"

            level_names = {
                0: "No volcanic unrest",
                1: "Minor volcanic unrest",
                2: "Moderate to heightened volcanic unrest",
                3: "Minor volcanic eruption",
                4: "Moderate volcanic eruption",
                5: "Major volcanic eruption",
            }

            results.append({
                "source": "geonet",
                "type": "volcanic_alert",
                "severity": severity,
                "title": f"{name} — Alert Level {level}",
                "description": (
                    f"{level_names.get(level, 'Volcanic alert')}"
                    + (f". {activity}" if activity else "")
                    + (f". Hazards: {hazards}" if hazards else "")
                )[:500],
                "timestamp": now.isoformat(),
                "distance_km": round(dist, 1),
                "active": True,
            })

        return results

    # 3. Fetch historical significant quakes from DB (M5+ within 50km, last 10y)
    async def _fetch_historical_quakes() -> list[dict]:
        try:
            async with db.pool.connection() as conn_eq:
                cur = await conn_eq.execute(
                    """
                    SELECT event_time, magnitude, depth_km, location_name,
                           ST_Y(geom) AS lat, ST_X(geom) AS lng,
                           round(ST_Distance(geom::geography,
                                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) / 1000) AS dist_km
                    FROM earthquakes
                    WHERE magnitude >= 5.0
                      AND event_time >= (now() - interval '10 years')
                      AND ST_DWithin(geom::geography,
                          ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 100000)
                    ORDER BY magnitude DESC
                    LIMIT 20
                    """,
                    [prop_lng, prop_lat, prop_lng, prop_lat],
                )
                rows = cur.fetchall()
            results = []
            for r in rows:
                mag = float(r["magnitude"])
                dist = float(r["dist_km"])
                severity = "critical" if mag >= 6.0 else "warning" if mag >= 5.0 else "info"
                ts = r["event_time"]
                results.append({
                    "source": "geonet",
                    "type": "earthquake",
                    "severity": severity,
                    "title": f"M{mag:.1f} earthquake — {dist:.0f}km from property",
                    "description": (
                        f"Magnitude {mag:.1f}, depth {r['depth_km']}km"
                        + (f", near {r['location_name']}" if r.get("location_name") else "")
                    ),
                    "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                    "distance_km": dist,
                    "magnitude": mag,
                    "mmi": None,
                    "active": False,
                    "historical": True,
                })
            return results
        except Exception as e:
            logger.warning(f"Historical quake DB query failed: {e}")
            return []

    # 4. Fetch all sources in parallel (live APIs + DB)
    quakes, historical, metservice, volcanic = await asyncio.gather(
        asyncio.to_thread(_fetch_geonet_quakes),
        _fetch_historical_quakes(),
        asyncio.to_thread(_fetch_metservice_warnings),
        asyncio.to_thread(_fetch_volcanic_alerts),
    )

    events.extend(quakes)
    # Merge historical — skip duplicates (same quake within 1 min + similar magnitude)
    existing_times = {e["timestamp"][:16] for e in quakes}
    for hq in historical:
        if hq["timestamp"][:16] not in existing_times:
            events.append(hq)
    events.extend(metservice)
    events.extend(volcanic)

    # 5. Add hazard context from DB (flood zones, tsunami, fault proximity, etc.)
    try:
        async with db.pool.connection() as conn_haz:
            # Flood zone
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT name, hazard_ranking, hazard_type FROM flood_hazard fh, addr
                WHERE ST_Contains(fh.geom, addr.geom) LIMIT 1
            """, [address_id])
            flood = cur.fetchone()
            if flood:
                events.append({
                    "source": "council", "type": "flood_zone", "severity": "warning",
                    "title": "Property is in a flood hazard zone",
                    "description": f"{flood['hazard_type'] or 'Flood zone'} — risk level: {flood['hazard_ranking'] or 'identified'}. Historical flooding events have affected this area.",
                    "timestamp": now.isoformat(), "distance_km": 0, "active": True, "historical": False,
                })
            # Tsunami zone
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT evac_zone, zone_class FROM tsunami_zones tz, addr
                WHERE ST_Contains(tz.geom, addr.geom) LIMIT 1
            """, [address_id])
            tsunami = cur.fetchone()
            if tsunami:
                zone = tsunami['evac_zone'] or tsunami['zone_class'] or 'identified'
                sev = "critical" if str(zone).lower() in ("red", "1", "orange") else "warning"
                events.append({
                    "source": "council", "type": "tsunami_zone", "severity": sev,
                    "title": "Property is in a tsunami evacuation zone",
                    "description": f"Tsunami zone: {zone}. In the event of a long or strong earthquake, evacuate immediately to higher ground.",
                    "timestamp": now.isoformat(), "distance_km": 0, "active": True, "historical": False,
                })
            # Active fault proximity
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT fault_name, round(ST_Distance(af.geom::geography, addr.geom::geography)::numeric / 1000, 1) AS dist_km
                FROM active_faults af, addr
                WHERE af.geom && ST_Expand(addr.geom, 0.05)
                  AND ST_DWithin(af.geom::geography, addr.geom::geography, 5000)
                ORDER BY ST_Distance(af.geom, addr.geom) LIMIT 1
            """, [address_id])
            fault = cur.fetchone()
            if fault:
                events.append({
                    "source": "gns", "type": "fault_proximity", "severity": "warning",
                    "title": f"Active fault {fault['dist_km']}km from property",
                    "description": f"Active fault: {fault['fault_name'] or 'unnamed'}. Properties near active faults face elevated seismic risk.",
                    "timestamp": now.isoformat(), "distance_km": float(fault['dist_km']), "active": True, "historical": False,
                })
            # Coastal erosion
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT round(ST_Distance(ce.geom::geography, addr.geom::geography)::numeric) AS dist_m
                FROM coastal_erosion ce, addr
                WHERE ce.geom && ST_Expand(addr.geom, 0.005)
                  AND ST_DWithin(ce.geom::geography, addr.geom::geography, 500)
                LIMIT 1
            """, [address_id])
            erosion = cur.fetchone()
            if erosion:
                events.append({
                    "source": "council", "type": "coastal_erosion", "severity": "warning",
                    "title": "Coastal erosion zone nearby",
                    "description": f"Coastal erosion hazard identified within {int(erosion['dist_m'])}m. Sea level rise projections may increase risk over time.",
                    "timestamp": now.isoformat(), "distance_km": round(float(erosion['dist_m']) / 1000, 2), "active": True, "historical": False,
                })
            # Extreme weather history (from weather_events table)
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT we.event_date, we.event_type, we.severity, we.title, we.description,
                       we.precipitation_mm, we.wind_gust_kmh,
                       round(ST_Distance(we.geom::geography, addr.geom::geography)::numeric / 1000, 1) AS dist_km
                FROM weather_events we, addr
                WHERE we.geom && ST_Expand(addr.geom, 0.5)
                  AND ST_DWithin(we.geom::geography, addr.geom::geography, 50000)
                  AND we.event_date >= (CURRENT_DATE - interval '5 years')
                  AND we.severity IN ('critical', 'warning')
                ORDER BY we.event_date DESC
                LIMIT 15
            """, [address_id])
            for r in cur.fetchall():
                events.append({
                    "source": "open_meteo", "type": r["event_type"], "severity": r["severity"],
                    "title": r["title"],
                    "description": r["description"] or "",
                    "timestamp": r["event_date"].isoformat() if hasattr(r["event_date"], "isoformat") else str(r["event_date"]),
                    "distance_km": float(r["dist_km"]) if r["dist_km"] else None,
                    "active": False, "historical": True,
                })

            # Contaminated land
            cur = await conn_haz.execute("""
                WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                SELECT site_name, category, round(ST_Distance(cl.geom::geography, addr.geom::geography)::numeric) AS dist_m
                FROM contaminated_land cl, addr
                WHERE cl.geom && ST_Expand(addr.geom, 0.01)
                  AND ST_DWithin(cl.geom::geography, addr.geom::geography, 1000)
                ORDER BY ST_Distance(cl.geom, addr.geom) LIMIT 1
            """, [address_id])
            contam = cur.fetchone()
            if contam:
                events.append({
                    "source": "council", "type": "contaminated_land", "severity": "info",
                    "title": f"Contaminated site {int(contam['dist_m'])}m away",
                    "description": f"{contam['site_name'] or 'Contaminated site'}" + (f" — Category: {contam['category']}" if contam.get('category') else ""),
                    "timestamp": now.isoformat(), "distance_km": round(float(contam['dist_m']) / 1000, 2), "active": True, "historical": False,
                })
    except Exception as e:
        logger.warning(f"Hazard context query failed: {e}")

    # 4. Sort: critical first, then warning, then info; newest first within each
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)  # newest first
    events.sort(key=lambda e: severity_order.get(e["severity"], 9))  # stable sort by severity

    # 5. Build summary
    critical_count = sum(1 for e in events if e["severity"] == "critical")
    warning_count = sum(1 for e in events if e["severity"] == "warning")
    info_count = sum(1 for e in events if e["severity"] == "info")

    # Build headline
    headline_parts = []
    active_alerts = sum(1 for e in events if e.get("active") and e["source"] == "nema")
    active_weather = sum(1 for e in events if e.get("active") and e["source"] == "metservice")
    active_volcanic = sum(1 for e in events if e.get("active") and e["type"] == "volcanic_alert")
    quake_count = sum(1 for e in events if e["type"] == "earthquake")

    if active_alerts:
        headline_parts.append(f"{active_alerts} emergency alert{'s' if active_alerts > 1 else ''}")
    if active_weather:
        headline_parts.append(f"{active_weather} weather warning{'s' if active_weather > 1 else ''} active")
    if active_volcanic:
        headline_parts.append(f"{active_volcanic} volcanic alert{'s' if active_volcanic > 1 else ''}")
    if quake_count:
        headline_parts.append(f"{quake_count} recent earthquake{'s' if quake_count > 1 else ''}")

    headline = ", ".join(headline_parts) if headline_parts else "No significant activity"

    result = {
        "summary": {
            "total_events": len(events),
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count,
            "headline": headline,
        },
        "events": events,
    }

    # 6. Cache 30 minutes
    await cache_set(cache_key, orjson.dumps(result).decode(), ex=1800)

    return result


@router.get("/property/{address_id}/ai-summary")
@limiter.limit("20/minute")
async def get_ai_summary(request: Request, address_id: int):
    """Generate AI summary for a property report. Slow — call after report loads.
    Returns {ai_summary: str | null, area_profile: str | null}."""

    # Try to use the cached report as input (avoids re-running the DB function)
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
    else:
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT get_property_report(%s) AS report", [address_id]
            )
            row = cur.fetchone()
        if not row or not row["report"]:
            raise HTTPException(404, "Address not found")
        report = enrich_with_scores(row["report"])

    sa2_code = (report.get("address") or {}).get("sa2_code")
    area_profile = report.get("area_profile")

    # Fetch area profile if not already in the cached report
    if area_profile is None and sa2_code:
        async with db.pool.connection() as conn2:
            cur2 = await conn2.execute(
                "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
            )
            pr = cur2.fetchone()
            area_profile = pr["profile"] if pr else None

    try:
        summary = await asyncio.wait_for(
            generate_property_summary(report, area_profile),
            timeout=30.0,
        )
    except (asyncio.TimeoutError, Exception) as e:
        logger.warning(f"AI summary failed for {address_id}: {e}")
        summary = None

    return {"ai_summary": summary, "area_profile": area_profile}


# =============================================================================
# GET /property/{address_id}/summary — Lightweight for map popups + SSR
# =============================================================================

@router.get("/property/{address_id}/summary")
@limiter.limit("60/minute")
async def get_summary(request: Request, address_id: int):
    """Lightweight property summary for map popups and SSR metadata.
    Returns key facts only — no hazard details, no nearby data.
    Tries cached report first, falls back to minimal DB query."""

    # 1. Try extracting from cached full report
    cache_key = f"report:{address_id}"
    cached = await cache_get(cache_key)
    if cached:
        report = orjson.loads(cached)
        return _extract_summary(report, address_id)

    # 2. Fall back to full report (generates cache for future requests)
    try:
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT get_property_report(%s) AS report", [address_id]
            )
            row = cur.fetchone()
        if row and row["report"]:
            report = enrich_with_scores(row["report"])
            await cache_set(cache_key, orjson.dumps(report), ex=86400)
            return _extract_summary(report, address_id)
        raise HTTPException(404, "Address not found")
    except HTTPException:
        raise
    except Exception as e:
        # If full report fails, return minimal data
        logger.warning(f"Summary fallback for {address_id}: {type(e).__name__}: {e}")
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                """
                SELECT a.address_id, a.full_address,
                       a.suburb_locality AS suburb, a.town_city AS city,
                       a.unit_type,
                       sa2.sa2_name
                FROM addresses a
                LEFT JOIN LATERAL (
                    SELECT sa2_name FROM sa2_boundaries
                    WHERE ST_Within(a.geom, geom) LIMIT 1
                ) sa2 ON true
                WHERE a.address_id = %s
                """,
                [address_id],
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(404, "Address not found")

        return {
            "address_id": row["address_id"],
            "full_address": row["full_address"],
            "suburb": row["suburb"],
            "city": row["city"],
            "sa2_name": row["sa2_name"],
            "unit_type": row["unit_type"],
            "scores": None,
            "notable_findings": [],
        }


def _get_headline_rent(rental_overview) -> int | None:
    """Extract headline median rent from rental_overview list."""
    if not isinstance(rental_overview, list):
        return None
    row = next(
        (r for r in rental_overview if isinstance(r, dict)
         and r.get("dwelling_type") == "House" and r.get("beds") == "ALL"),
        next((r for r in rental_overview if isinstance(r, dict) and r.get("beds") == "ALL"), None),
    )
    return row.get("median") if row else None


def _extract_summary(report: dict, address_id: int) -> dict:
    """Extract lightweight summary from a full cached report."""
    addr = report.get("address") or {}
    scores = report.get("scores") or {}
    rental = (report.get("market") or {}).get("rental_overview") or []

    # Pick top 2 notable findings from category scores
    notable = []
    categories = scores.get("categories") or {}
    indicators = scores.get("indicators") or {}
    for cat_name, cat_score in categories.items():
        if isinstance(cat_score, (int, float)):
            if cat_score >= 70:
                notable.append(f"High {cat_name} risk")
            elif cat_score <= 30:
                notable.append(f"Low {cat_name} risk")

    return {
        "address_id": address_id,
        "full_address": addr.get("full_address"),
        "suburb": addr.get("suburb"),
        "city": addr.get("city"),
        "sa2_name": addr.get("sa2_name"),
        "unit_type": addr.get("unit_type"),
        "scores": {
            "composite": scores.get("composite"),
            "rating": scores.get("rating", {}).get("label") if isinstance(scores.get("rating"), dict) else scores.get("rating"),
        } if scores.get("composite") else None,
        "median_rent": _get_headline_rent(rental),
        "notable_findings": notable[:3],
    }


# =============================================================================
# PDF Generation (Background)
# =============================================================================

async def _generate_pdf_background(
    job_id: str, address_id: int, persona: str = "buyer",
    user_id: str | None = None, credit_id: int | None = None, is_pro: bool = False,
    budget_inputs: dict | None = None, rent_inputs: dict | None = None,
    buyer_inputs: dict | None = None, report_tier: str = "full",
):
    """Background task to generate PDF report. Saves report + deducts credit on success."""
    try:
        import time as _time
        _bg_start = _time.monotonic()
        await set_job_generating(job_id)

        # 1. Get full report (cache or DB)
        cache_key = f"report:{address_id}"
        cached = await cache_get(cache_key)
        if cached:
            report = orjson.loads(cached)
        else:
            async with db.pool.connection() as conn:
                cur = await conn.execute(
                    "SELECT get_property_report(%s) AS report", [address_id]
                )
                row = cur.fetchone()
            if not row or not row["report"]:
                await set_job_failed(job_id, "Address not found")
                return
            report = enrich_with_scores(row["report"])

        # Fix unit CV from rates cache (same fix as report endpoint)
        if not report.get("_cv_from_rates"):
            await _fix_unit_cv(report, address_id)

        # 2. Get area profile
        area_profile = report.get("area_profile")
        if area_profile is None:
            sa2_code = (report.get("address") or {}).get("sa2_code")
            if sa2_code:
                async with db.pool.connection() as conn2:
                    cur2 = await conn2.execute(
                        "SELECT profile FROM area_profiles WHERE sa2_code = %s", [sa2_code]
                    )
                    pr = cur2.fetchone()
                    area_profile = pr["profile"] if pr else None

        # --- Parallel data fetching (steps 3-3i + AI) ---
        # All these are independent — run concurrently for speed.
        from .nearby import AMENITY_CLASSES
        sa2_code = (report.get("address") or {}).get("sa2_code")

        async def _fetch_supermarkets():
            try:
                async with db.pool.connection() as conn_sm:
                    cur_sm = await conn_sm.execute("""
                        WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                        SELECT oa.name, oa.subcategory, oa.brand,
                               round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m,
                               ST_X(oa.geom) AS lng, ST_Y(oa.geom) AS lat
                        FROM osm_amenities oa, addr
                        WHERE oa.geom && ST_Expand(addr.geom, 10000 * 0.00001)
                          AND ST_DWithin(oa.geom::geography, addr.geom::geography, 10000)
                          AND oa.subcategory IN ('supermarket', 'greengrocer', 'convenience', 'grocery', 'wholesale', 'general')
                        ORDER BY distance_m LIMIT 5
                    """, [address_id])
                    return [dict(r) for r in cur_sm.fetchall()]
            except Exception as e:
                logger.warning(f"Nearby supermarkets query failed: {e}")
                return []

        async def _fetch_highlights():
            highlights = {"good": [], "caution": [], "info": []}
            try:
                target_subcats = tuple(AMENITY_CLASSES.keys())
                placeholders = ",".join(["%s"] * len(target_subcats))
                async with db.pool.connection() as conn_nh:
                    cur_nh = await conn_nh.execute(f"""
                        WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                        SELECT DISTINCT ON (oa.subcategory)
                               oa.name, oa.subcategory,
                               round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m
                        FROM osm_amenities oa, addr
                        WHERE oa.geom && ST_Expand(addr.geom, 1500 * 0.00001)
                          AND ST_DWithin(oa.geom::geography, addr.geom::geography, 1500)
                          AND oa.subcategory IN ({placeholders})
                        ORDER BY oa.subcategory, ST_Distance(oa.geom, addr.geom)
                    """, [address_id, *target_subcats])
                    for r in cur_nh.fetchall():
                        subcat = r["subcategory"]
                        if subcat not in AMENITY_CLASSES:
                            continue
                        sentiment, label = AMENITY_CLASSES[subcat]
                        item = {"name": r["name"] or label, "label": label, "distance_m": float(r["distance_m"])}
                        highlights[sentiment].append(item)
                for group in highlights.values():
                    group.sort(key=lambda x: x["distance_m"])
            except Exception as e:
                logger.warning(f"Nearby highlights query failed: {e}")
            return highlights

        async def _fetch_pois():
            parks, cafes, restaurants, playgrounds = [], [], [], []
            try:
                async with db.pool.connection() as conn_poi:
                    cur_poi = await conn_poi.execute("""
                        WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                        SELECT oa.name, oa.subcategory,
                               ST_X(oa.geom) AS longitude, ST_Y(oa.geom) AS latitude,
                               round(ST_Distance(oa.geom::geography, addr.geom::geography)::numeric) AS distance_m
                        FROM osm_amenities oa, addr
                        WHERE oa.geom && ST_Expand(addr.geom, 1000 * 0.00001)
                          AND ST_DWithin(oa.geom::geography, addr.geom::geography, 1000)
                          AND oa.subcategory IN ('park', 'garden', 'cafe', 'restaurant', 'playground')
                        ORDER BY distance_m
                    """, [address_id])
                    for r in cur_poi.fetchall():
                        item = dict(r)
                        sub = item.get("subcategory", "")
                        if sub in ("park", "garden"):
                            parks.append(item)
                        elif sub == "cafe":
                            cafes.append(item)
                        elif sub == "restaurant":
                            restaurants.append(item)
                        elif sub == "playground":
                            playgrounds.append(item)
            except Exception as e:
                logger.warning(f"Nearby POIs query failed: {e}")
            return parks, cafes, restaurants, playgrounds

        async def _fetch_zones():
            try:
                async with db.pool.connection() as conn_z:
                    cur_z = await conn_z.execute("""
                        WITH addr AS (SELECT geom FROM addresses WHERE address_id = %s)
                        SELECT dz.zone_name, dz.zone_code,
                               ST_AsGeoJSON(ST_Intersection(dz.geom, ST_Expand(addr.geom, 0.005)))::jsonb -> 'coordinates' AS coordinates
                        FROM district_plan_zones dz, addr
                        WHERE dz.geom && ST_Expand(addr.geom, 0.005)
                          AND ST_Intersects(dz.geom, ST_Expand(addr.geom, 0.005))
                        LIMIT 10
                    """, [address_id])
                    return [dict(r) for r in cur_z.fetchall()]
            except Exception as e:
                logger.warning(f"Nearby zones query failed: {e}")
                return []

        async def _fetch_rent_history():
            data = []
            ctx = None
            try:
                if sa2_code:
                    dw_type = (rent_inputs or {}).get("dwelling_type", "ALL")
                    beds = (rent_inputs or {}).get("bedrooms", "ALL")
                    weekly_rent = (rent_inputs or {}).get("weekly_rent")
                    query = """
                        SELECT time_frame, median_rent, lower_quartile_rent,
                               upper_quartile_rent, active_bonds
                        FROM bonds_detailed
                        WHERE location_id = %s AND dwelling_type = %s
                          AND number_of_beds = %s
                          AND time_frame >= (CURRENT_DATE - INTERVAL '10 years')
                        ORDER BY time_frame
                    """
                    async with db.pool.connection() as conn_rh:
                        cur_rh = await conn_rh.execute(query, [sa2_code, dw_type, beds])
                        data = [dict(r) for r in cur_rh.fetchall()]
                        if not data and (dw_type != "ALL" or beds != "ALL"):
                            cur_rh = await conn_rh.execute(query, [sa2_code, "ALL", "ALL"])
                            data = [dict(r) for r in cur_rh.fetchall()]
                    if rent_inputs and (rent_inputs.get("dwelling_type") or rent_inputs.get("weekly_rent")):
                        ctx = {
                            "dwelling_type": rent_inputs.get("dwelling_type"),
                            "bedrooms": rent_inputs.get("bedrooms"),
                            "weekly_rent": weekly_rent,
                        }
            except Exception as e:
                logger.warning(f"Rent history query failed: {e}")
            return data, ctx

        async def _fetch_hpi():
            try:
                async with db.pool.connection() as conn_hpi:
                    cur_hpi = await conn_hpi.execute("""
                        SELECT quarter_end, house_price_index
                        FROM rbnz_housing
                        WHERE quarter_end >= (CURRENT_DATE - INTERVAL '10 years')
                        ORDER BY quarter_end
                    """)
                    return [dict(r) for r in cur_hpi.fetchall()]
            except Exception as e:
                logger.warning(f"HPI query failed: {e}")
                return []

        async def _fetch_rates():
            try:
                full_address = (report.get("address") or {}).get("full_address", "")
                city = (report.get("address") or {}).get("city", "")
                if "wellington" in city.lower():
                    from ..services.rates import fetch_wcc_rates
                    async with db.pool.connection() as conn_rates:
                        return await fetch_wcc_rates(full_address, conn_rates)
                elif "auckland" in city.lower():
                    from ..services.auckland_rates import fetch_auckland_rates
                    async with db.pool.connection() as conn_rates:
                        return await fetch_auckland_rates(full_address, conn_rates)
                elif city.lower() == "lower hutt":
                    from ..services.hcc_rates import fetch_hcc_rates
                    return await fetch_hcc_rates(full_address)
                elif city.lower() == "porirua":
                    from ..services.pcc_rates import fetch_pcc_rates
                    return await fetch_pcc_rates(full_address)
                elif "kapiti" in city.lower() or city.lower() in ("paraparaumu", "waikanae", "otaki", "paekakariki", "raumati"):
                    from ..services.kcdc_rates import fetch_kcdc_rates
                    return await fetch_kcdc_rates(full_address)
                elif "horowhenua" in city.lower() or city.lower() in ("levin", "foxton", "shannon"):
                    from ..services.hdc_rates import fetch_hdc_rates
                    return await fetch_hdc_rates(full_address)
                elif "hamilton" in city.lower():
                    from ..services.hamilton_rates import fetch_hamilton_rates
                    return await fetch_hamilton_rates(full_address)
                elif "dunedin" in city.lower():
                    from ..services.dcc_rates import fetch_dcc_rates
                    return await fetch_dcc_rates(full_address)
                elif "christchurch" in city.lower():
                    from ..services.ccc_rates import fetch_ccc_rates
                    async with db.pool.connection() as conn_rates:
                        return await fetch_ccc_rates(full_address, conn_rates)
                elif city.lower() == "new plymouth":
                    from ..services.taranaki_rates import fetch_taranaki_rates
                    return await fetch_taranaki_rates(full_address)
                elif city.lower() in ("richmond", "motueka", "takaka", "mapua", "brightwater", "wakefield"):
                    from ..services.tasman_rates import fetch_tasman_rates
                    return await fetch_tasman_rates(full_address)
                return None
            except asyncio.TimeoutError:
                logger.warning("Rates fetch timed out")
                return None
            except Exception as e:
                logger.warning(f"Rates fetch failed: {e}")
                return None

        async def _fetch_rent_advisor():
            if not (rent_inputs and rent_inputs.get("dwelling_type")):
                return None
            try:
                from ..services.rent_advisor import compute_rent_advice
                async with db.pool.connection() as conn_ra:
                    return await compute_rent_advice(
                        conn_ra,
                        address_id=address_id,
                        weekly_rent=int(rent_inputs["weekly_rent"]) if rent_inputs.get("weekly_rent") else None,
                        dwelling_type=rent_inputs.get("dwelling_type", "ALL"),
                        bedrooms=rent_inputs.get("bedrooms", "ALL"),
                        finish_tier=rent_inputs.get("finish_tier"),
                        bathrooms=rent_inputs.get("bathrooms"),
                        has_parking=rent_inputs.get("has_parking"),
                        has_insulation=rent_inputs.get("has_insulation"),
                        is_furnished=rent_inputs.get("is_furnished"),
                        shared_kitchen=rent_inputs.get("shared_kitchen"),
                        utilities_included=rent_inputs.get("utilities_included"),
                    )
            except Exception as e:
                logger.warning(f"Rent advisor failed for PDF: {e}")
                return None

        async def _fetch_price_advisor():
            if persona != "buyer":
                return None
            try:
                from ..services.price_advisor import compute_price_advice
                bi = buyer_inputs or {}
                async with db.pool.connection() as conn_pa:
                    return await compute_price_advice(
                        conn_pa,
                        address_id=address_id,
                        asking_price=bi.get("asking_price"),
                        bedrooms=bi.get("bedrooms"),
                        finish_tier=bi.get("finish_tier"),
                        bathrooms=bi.get("bathrooms"),
                        has_parking=bi.get("has_parking"),
                    )
            except Exception as e:
                logger.warning(f"Price advisor failed for PDF: {e}")
                return None

        async def _fetch_rec_overrides():
            try:
                async with db.pool.connection() as conn_ro:
                    cur_ro = await conn_ro.execute(
                        "SELECT value FROM admin_content WHERE key = 'recommendations'"
                    )
                    row_ro = cur_ro.fetchone()
                    if row_ro:
                        return (row_ro["value"] or {}).get("overrides", {})
            except Exception:
                pass
            return {}

        # 4-5. Sync insight engines (fast, CPU-only — run before gather so report is available)
        python_insights = build_insights(report)
        lifestyle_fit = build_lifestyle_fit(report)

        # --- Phase 1: Fast data fetches (no AI) — aim for <10s ---
        # Start AI in background, don't wait for it
        ai_task = asyncio.ensure_future(asyncio.wait_for(
            generate_pdf_insights(report, area_profile, python_insights),
            timeout=45.0,
        ))

        (
            nearby_supermarkets,
            nearby_highlights,
            poi_result,
            nearby_zones,
            rent_hist_result,
            hpi_data,
            rates_data,
            rent_advisor_result,
            price_advisor_result,
            rec_overrides,
        ) = await asyncio.gather(
            _fetch_supermarkets(),
            _fetch_highlights(),
            _fetch_pois(),
            _fetch_zones(),
            _fetch_rent_history(),
            _fetch_hpi(),
            _fetch_rates(),
            _fetch_rent_advisor(),
            _fetch_price_advisor(),
            _fetch_rec_overrides(),
            return_exceptions=True,
        )

        # Unpack results, treating exceptions as empty/None
        def _safe(val, default):
            return default if isinstance(val, BaseException) else val

        nearby_supermarkets = _safe(nearby_supermarkets, [])
        nearby_highlights = _safe(nearby_highlights, {"good": [], "caution": [], "info": []})
        poi_result = _safe(poi_result, ([], [], [], []))
        nearby_parks, nearby_cafes, nearby_restaurants, nearby_playgrounds = poi_result
        nearby_zones = _safe(nearby_zones, [])
        rent_hist_result = _safe(rent_hist_result, ([], None))
        rent_history_data, user_rent_context = rent_hist_result
        hpi_data = _safe(hpi_data, [])
        rates_data = _safe(rates_data, None)
        rent_advisor_result = _safe(rent_advisor_result, None)
        price_advisor_result = _safe(price_advisor_result, None)
        rec_overrides = _safe(rec_overrides, {})

        # 6. Build recommendations
        recommendations = build_recommendations(report, overrides=rec_overrides)

        # 7b. Fetch user display name
        user_display_name = None
        if user_id:
            try:
                async with db.pool.connection() as conn_name:
                    cur_name = await conn_name.execute(
                        "SELECT display_name FROM users WHERE user_id = %s", [user_id]
                    )
                    row_name = cur_name.fetchone()
                    if row_name:
                        user_display_name = row_name["display_name"]
            except Exception:
                pass

        # Helper to build render kwargs (reused for Phase 1 and Phase 2)
        render_kwargs = dict(
            nearby_supermarkets=nearby_supermarkets,
            nearby_highlights=nearby_highlights,
            nearby_parks=nearby_parks,
            nearby_cafes=nearby_cafes,
            nearby_restaurants=nearby_restaurants,
            nearby_playgrounds=nearby_playgrounds,
            nearby_zones=nearby_zones,
            persona=persona,
            rent_history_data=rent_history_data,
            hpi_data=hpi_data,
            rates_data=rates_data,
            user_display_name=user_display_name,
            budget_inputs=budget_inputs,
            user_rent_context=user_rent_context,
            rent_advisor_result=rent_advisor_result,
            rent_inputs=rent_inputs,
            price_advisor_result=price_advisor_result,
            buyer_inputs=buyer_inputs,
        )

        # --- Phase 1 render: WITHOUT AI insights (fast) ---
        # Check if AI finished quickly (give it 2s grace)
        ai_insights = None
        try:
            ai_insights = await asyncio.wait_for(asyncio.shield(ai_task), timeout=2.0)
        except (asyncio.TimeoutError, Exception):
            pass  # AI not ready yet — render without it

        html = render_report_html(
            report, python_insights, lifestyle_fit, ai_insights, recommendations,
            **render_kwargs,
        )

        # 8a. Save report + deduct credit
        if user_id:
            full_address = (report.get("address") or {}).get("full_address", "Unknown")
            try:
                async with db.pool.connection() as conn_save:
                    await conn_save.execute(
                        """
                        INSERT INTO saved_reports (user_id, address_id, full_address, report_html, persona)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        [user_id, address_id, full_address, html, persona],
                    )
                    if not is_pro and credit_id:
                        await conn_save.execute(
                            """
                            UPDATE report_credits
                            SET credits_remaining = credits_remaining - 1
                            WHERE id = %s AND credits_remaining > 0
                            """,
                            [credit_id],
                        )
            except Exception as e:
                logger.error(f"Failed to save report/deduct credit for {user_id}: {e}")

        print(f"[PERF-BG] Pre-snapshot work: {_time.monotonic() - _bg_start:.2f}s for {address_id} (tier={report_tier})")
        # --- Phase 1: Create snapshot fast (no AI) + mark complete ---
        share_token = None
        try:
            from ..services.snapshot_generator import create_report_snapshot
            dw_type = (rent_inputs or {}).get("dwelling_type", "House")
            async with db.pool.connection() as conn_snap:
                share_token = await create_report_snapshot(
                    conn_snap,
                    address_id=address_id,
                    persona=persona,
                    dwelling_type=dw_type,
                    user_id=user_id,
                    inputs_at_purchase={**(rent_inputs or {}), **(buyer_inputs or {})},
                    skip_ai=True,  # PDF task handles AI separately
                    report_tier=report_tier,
                )
            if share_token:
                logger.info(f"Snapshot created for {address_id}: /report/{share_token}")
                if user_id:
                    try:
                        async with db.pool.connection() as conn_upd:
                            await conn_upd.execute(
                                """
                                UPDATE saved_reports SET share_token = %s
                                WHERE id = (
                                    SELECT id FROM saved_reports
                                    WHERE user_id = %s AND address_id = %s
                                      AND share_token IS NULL
                                    ORDER BY generated_at DESC LIMIT 1
                                )
                                """,
                                [share_token, user_id, address_id],
                            )
                    except Exception as upd_err:
                        logger.warning(f"Failed to update share_token in saved_reports for {user_id}/{address_id}: {upd_err}")
        except Exception as e:
            import traceback
            logger.warning(f"Snapshot generation failed for {address_id}: {e}\n{traceback.format_exc()}")

        # Fallback: if snapshot creation failed, look up an existing snapshot for this address
        if not share_token:
            try:
                import hashlib
                async with db.pool.connection() as conn_fb:
                    cur = await conn_fb.execute(
                        """
                        SELECT share_token_hash FROM report_snapshots
                        WHERE address_id = %s
                        ORDER BY created_at DESC LIMIT 1
                        """,
                        [address_id],
                    )
                    row = cur.fetchone()
                    if row:
                        # We can't recover the plaintext token from the hash, but we know
                        # a snapshot exists. Check saved_reports for a plaintext share_token.
                        if user_id:
                            cur2 = await conn_fb.execute(
                                """
                                SELECT share_token FROM saved_reports
                                WHERE address_id = %s AND share_token IS NOT NULL
                                ORDER BY generated_at DESC LIMIT 1
                                """,
                                [address_id],
                            )
                            row2 = cur2.fetchone()
                            if row2 and row2["share_token"]:
                                share_token = row2["share_token"]
                                logger.info(f"Reusing existing share_token for {address_id}: /report/{share_token}")
            except Exception as e:
                logger.warning(f"Fallback share_token lookup failed: {e}")

        await set_job_completed(job_id, html, share_token=share_token)
        print(f"[PERF-BG] Phase 1 TOTAL: {_time.monotonic() - _bg_start:.2f}s for {address_id} (tier={report_tier})")
        logger.info(f"Phase 1 complete for job {job_id} (AI={'yes' if ai_insights else 'pending'}, hosted={'yes' if share_token else 'no'})")

        # --- Send report-ready email (paid reports only, not free quick) ---
        if share_token and user_id and report_tier == "full":
            try:
                from ..services.email import send_report_ready_email
                async with db.pool.connection() as conn_email:
                    cur_email = await conn_email.execute(
                        "SELECT email FROM users WHERE user_id = %s", [user_id]
                    )
                    row_email = cur_email.fetchone()
                if row_email and row_email["email"]:
                    await asyncio.to_thread(
                        send_report_ready_email,
                        row_email["email"],
                        full_address,
                        share_token,
                        persona,
                        settings.FRONTEND_URL,
                    )
            except Exception as email_err:
                logger.warning(f"Failed to send report-ready email for job {job_id}: {email_err}")

        # --- Phase 2: Background AI enrichment ---
        if ai_insights is None:
            try:
                ai_insights = await ai_task
            except Exception as e:
                logger.warning(f"PDF AI insights failed for {address_id}: {e}")
                ai_insights = None

            if ai_insights:
                html = render_report_html(
                    report, python_insights, lifestyle_fit, ai_insights, recommendations,
                    **render_kwargs,
                )
                await set_job_completed(job_id, html, share_token=share_token)
                if user_id:
                    try:
                        async with db.pool.connection() as conn_upd_html:
                            await conn_upd_html.execute(
                                """
                                UPDATE saved_reports SET report_html = %s
                                WHERE user_id = %s AND address_id = %s
                                ORDER BY generated_at DESC LIMIT 1
                                """,
                                [html, user_id, address_id],
                            )
                    except Exception:
                        pass
                # Update snapshot with AI
                if share_token:
                    try:
                        async with db.pool.connection() as conn_snap2:
                            await conn_snap2.execute(
                                "UPDATE report_snapshots SET ai_summary = %s WHERE share_token = %s",
                                [ai_insights, share_token],
                            )
                    except Exception:
                        pass
                logger.info(f"Phase 2 AI enrichment complete for job {job_id}")

    except Exception as e:
        import traceback
        logger.error(f"PDF generation failed for job {job_id}: {e}\n{traceback.format_exc()}")
        await set_job_failed(job_id, str(e))


# =============================================================================
# POST /property/{address_id}/export/pdf/start — Initiate PDF generation
# =============================================================================

@router.post("/property/{address_id}/export/pdf/start")
@limiter.limit("20/hour")
async def start_pdf_export(
    request: Request,
    address_id: int,
    background_tasks: BackgroundTasks,
    credit_info: CreditInfo = Depends(require_paid_user),
    persona: str = "buyer",
):
    """Start background PDF generation. Requires authenticated user with credits."""
    # Parse optional budget_inputs + rent_inputs from request body
    budget_inputs = None
    rent_inputs = None
    buyer_inputs = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            if "budget_inputs" in body:
                budget_inputs = body["budget_inputs"]
            if "rent_inputs" in body:
                rent_inputs = body["rent_inputs"]
            if "buyer_inputs" in body:
                buyer_inputs = body["buyer_inputs"]
    except Exception:
        pass

    job_id = await create_job(address_id)
    background_tasks.add_task(
        _generate_pdf_background, job_id, address_id, persona,
        user_id=credit_info.user_id,
        credit_id=credit_info.credit_id,
        is_pro=credit_info.is_pro,
        budget_inputs=budget_inputs,
        rent_inputs=rent_inputs,
        buyer_inputs=buyer_inputs,
        report_tier=credit_info.report_tier,
    )
    track_event("report_generated", user_id=credit_info.user_id,
                properties={"address_id": address_id, "persona": persona})
    return JSONResponse({
        "job_id": job_id,
        "status_url": f"/api/v1/property/{address_id}/export/pdf/status/{job_id}",
        "download_url": f"/api/v1/property/{address_id}/export/pdf/download/{job_id}",
    })


# =============================================================================
# POST /property/{address_id}/export/pdf/guest-start — Guest PDF generation
# =============================================================================

@router.post("/property/{address_id}/export/pdf/guest-start")
@limiter.limit("20/hour")
async def start_guest_pdf_export(
    request: Request,
    address_id: int,
    background_tasks: BackgroundTasks,
    token: str = Query(...),
):
    """Start background PDF generation for a guest purchase. Requires valid download token."""
    # Hash token and look up in guest_purchases
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    async with db.pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, address_id, persona, job_id, expires_at, report_tier
            FROM guest_purchases
            WHERE download_token_hash = %s AND address_id = %s
              AND expires_at > now()
            """,
            [token_hash, address_id],
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(403, "Invalid or expired token")

    # Idempotent: if already has a job_id, return it
    if row["job_id"]:
        return JSONResponse({
            "job_id": row["job_id"],
            "status_url": f"/api/v1/property/{address_id}/export/pdf/status/{row['job_id']}",
            "download_url": f"/api/v1/property/{address_id}/export/pdf/download/{row['job_id']}",
        })

    # Parse optional inputs from request body (saved by frontend before Stripe redirect)
    budget_inputs = None
    rent_inputs = None
    buyer_inputs = None
    try:
        body = await request.json()
        if isinstance(body, dict):
            if "budget_inputs" in body:
                budget_inputs = body["budget_inputs"]
            if "rent_inputs" in body:
                rent_inputs = body["rent_inputs"]
            if "buyer_inputs" in body:
                buyer_inputs = body["buyer_inputs"]
    except Exception:
        pass

    job_id = await create_job(address_id)

    # Store job_id in guest_purchases
    async with db.pool.connection() as conn:
        await conn.execute(
            "UPDATE guest_purchases SET job_id = %s WHERE id = %s",
            [job_id, row["id"]],
        )

    background_tasks.add_task(
        _generate_pdf_background, job_id, address_id, row["persona"],
        budget_inputs=budget_inputs,
        rent_inputs=rent_inputs,
        buyer_inputs=buyer_inputs,
        report_tier=row.get("report_tier", "quick"),
    )

    return JSONResponse({
        "job_id": job_id,
        "status_url": f"/api/v1/property/{address_id}/export/pdf/status/{job_id}",
        "download_url": f"/api/v1/property/{address_id}/export/pdf/download/{job_id}",
    })


# =============================================================================
# GET /property/{address_id}/export/pdf/status/{job_id} — Check generation status
# =============================================================================

@router.get("/property/{address_id}/export/pdf/status/{job_id}")
@limiter.limit("120/minute")
async def check_pdf_status(request: Request, address_id: int, job_id: str):
    """Check the status of a PDF generation job."""
    status = await get_job_status(job_id)
    if not status:
        raise HTTPException(404, "Job not found")
    return JSONResponse(status)


# =============================================================================
# GET /property/{address_id}/export/pdf/download/{job_id} — Download generated PDF
# =============================================================================

@router.get("/property/{address_id}/export/pdf/download/{job_id}")
@limiter.limit("20/minute")
async def download_pdf(
    request: Request,
    address_id: int,
    job_id: str,
    token: str | None = Query(None),
):
    """Download the generated PDF report HTML. Supports optional guest token."""
    # If guest token provided, validate and track download count
    if token:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        async with db.pool.connection() as conn:
            cur = await conn.execute(
                """
                SELECT id, download_count, max_downloads, expires_at
                FROM guest_purchases
                WHERE download_token_hash = %s AND address_id = %s
                """,
                [token_hash, address_id],
            )
            gp = cur.fetchone()
            if not gp:
                raise HTTPException(403, "Invalid download token")
            if gp["expires_at"].tzinfo and gp["download_count"] >= gp["max_downloads"]:
                raise HTTPException(403, "Download limit reached (3 downloads max)")
            # Increment download count + set redeemed_at on first download
            await conn.execute(
                """
                UPDATE guest_purchases
                SET download_count = download_count + 1,
                    redeemed_at = COALESCE(redeemed_at, now())
                WHERE id = %s
                """,
                [gp["id"]],
            )

    html = await get_job_html(job_id)
    if not html:
        status = await get_job_status(job_id)
        if not status:
            raise HTTPException(404, "Job not found")
        if status["status"] == "failed":
            logger.error(f"PDF download failed for {address_id}: {status['error']}")
            raise HTTPException(400, "PDF generation failed. Please try again.")
        raise HTTPException(202, "PDF still generating")

    return HTMLResponse(
        content=html,
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
        },
    )



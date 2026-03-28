"""
walking_isochrone.py — Hill-aware walking isochrone via Valhalla.

Replaces simple 400m/800m radius circles with real walking polygons
that follow the street network and account for elevation (hills).

Usage:
    from app.services.walking_isochrone import get_walking_isochrone, count_stops_in_isochrone

    # Get 10-minute walking polygon
    iso = await get_walking_isochrone(lat=-41.2865, lon=174.7762, minutes=10)
    # iso = {"type": "Feature", "geometry": {...}, "properties": {"contour": 10, ...}}

    # Count transit stops within actual walking distance
    count = await count_stops_in_isochrone(conn, address_id, minutes=10)
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import requests

from ..config import settings

logger = logging.getLogger(__name__)

# Valhalla endpoint — Docker service name in compose, or localhost for dev
VALHALLA_URL = os.environ.get("VALHALLA_URL", settings.VALHALLA_URL)


def _build_isochrone_request(
    lat: float, lon: float, minutes: list[int] | int = 10
) -> dict:
    """Build Valhalla isochrone request body."""
    if isinstance(minutes, int):
        minutes = [minutes]

    return {
        "locations": [{"lat": lat, "lon": lon}],
        "costing": "pedestrian",
        "costing_options": {
            "pedestrian": {
                "walking_speed": 5.0,       # km/h — standard walking speed
                "use_hills": 0.5,           # 0=avoid hills, 1=ignore hills
                "step_penalty": 30,         # seconds penalty per set of steps
                "max_hiking_difficulty": 1,  # 1=basic walking (not hiking)
            }
        },
        "contours": [{"time": m} for m in minutes],
        "polygons": True,           # Return polygons, not linestrings
        "denoise": 0.5,             # Smooth out small artifacts
        "generalize": 50,           # Simplify geometry (meters)
        "show_locations": False,
    }


async def get_walking_isochrone(
    lat: float,
    lon: float,
    minutes: list[int] | int = 10,
    timeout: float = 10.0,
) -> dict[str, Any] | None:
    """
    Get walking isochrone polygon(s) from Valhalla.

    Returns GeoJSON FeatureCollection with one Feature per contour,
    or None if Valhalla is unavailable.
    """
    try:
        body = _build_isochrone_request(lat, lon, minutes)
        resp = requests.post(
            f"{VALHALLA_URL}/isochrone",
            json=body,
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        logger.warning("Valhalla not available at %s — falling back to radius", VALHALLA_URL)
        return None
    except requests.exceptions.Timeout:
        logger.warning("Valhalla isochrone timed out for (%.4f, %.4f)", lat, lon)
        return None
    except Exception:
        logger.exception("Valhalla isochrone error")
        return None


async def get_elevation_profile(
    lat: float, lon: float, timeout: float = 5.0
) -> dict[str, Any] | None:
    """
    Get elevation at a point from Valhalla's /height endpoint.

    Returns {"height": [elevation_m], "range_height": [[0, elevation_m]]}
    """
    try:
        body = {
            "range": False,
            "shape": [{"lat": lat, "lon": lon}],
        }
        resp = requests.post(
            f"{VALHALLA_URL}/height",
            json=body,
            timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.debug("Valhalla height query failed for (%.4f, %.4f)", lat, lon)
        return None


async def get_elevation_multi(
    points: list[dict], timeout: float = 8.0
) -> list[int | None]:
    """
    Get elevation for multiple points in a single Valhalla request.
    points: [{"lat": ..., "lon": ...}, ...]
    Returns list of elevations in meters (or None for failures).
    """
    try:
        body = {"range": False, "shape": points}
        resp = requests.post(f"{VALHALLA_URL}/height", json=body, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        return data.get("height", [])
    except Exception:
        logger.debug("Valhalla multi-height query failed")
        return [None] * len(points)


def _compute_slope_from_samples(
    center_elev: float, lat: float, lon: float, elevations: dict
) -> tuple[float | None, float | None]:
    """
    Compute slope angle and aspect from 4 cardinal elevation samples.

    Uses a simple finite difference method:
      slope = arctan(sqrt(dz_dx^2 + dz_dy^2))
      aspect = arctan2(-dz_dy, dz_dx)

    elevations: {"n": elev, "s": elev, "e": elev, "w": elev}
    Sample spacing is ~30m (1 SRTM pixel).
    """
    import math

    n = elevations.get("n")
    s = elevations.get("s")
    e = elevations.get("e")
    w = elevations.get("w")

    if any(v is None or v < -500 for v in [n, s, e, w]):
        return None, None

    # Sample spacing in meters (~30m = 1 arc-second at NZ latitudes)
    # 1° lat ≈ 111,320m, 1° lon ≈ 111,320 * cos(lat)
    dx = 2 * 30  # 2 * one-pixel spacing (N-to-S and E-to-W)
    dy = 2 * 30

    dz_dx = (e - w) / dx
    dz_dy = (n - s) / dy

    slope_rad = math.atan(math.sqrt(dz_dx**2 + dz_dy**2))
    slope_deg = math.degrees(slope_rad)

    # Aspect: 0=north, 90=east, 180=south, 270=west
    aspect_rad = math.atan2(-dz_dy, dz_dx)
    aspect_deg = math.degrees(aspect_rad)
    # Convert from math convention to compass (0=north, clockwise)
    aspect_deg = (90 - aspect_deg) % 360

    return round(slope_deg, 1), round(aspect_deg, 1)


async def count_stops_in_isochrone(
    conn, address_id: int, minutes: int = 10
) -> dict[str, Any]:
    """
    Count transit stops within actual walking isochrone.

    Falls back to simple radius if Valhalla is unavailable:
      - 10 min → 800m radius
      - 5 min  → 400m radius
      - 15 min → 1200m radius

    Returns:
        {
            "transit_stops_walk_10min": int,
            "bus_stops_walk_10min": int,
            "rail_stops_walk_10min": int,
            "ferry_stops_walk_10min": int,
            "isochrone_method": "valhalla" | "radius",
            "isochrone_geojson": {...} | None,  # For map display
        }
    """
    # Get property coordinates
    cur = await conn.execute(
        "SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat FROM addresses WHERE address_id = %s",
        [address_id],
    )
    row = cur.fetchone()
    if not row:
        return {"transit_stops_walk_10min": 0, "isochrone_method": "none"}

    lat, lon = row["lat"], row["lon"]

    # Try Valhalla isochrone
    iso = await get_walking_isochrone(lat, lon, minutes)

    if iso and iso.get("features"):
        # Extract the polygon geometry from the isochrone response
        feature = iso["features"][0]
        geojson_str = json.dumps(feature["geometry"])

        # Count stops within the actual walking polygon
        cur = await conn.execute(
            """
            WITH iso AS (
                SELECT ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326) AS geom
            )
            SELECT
                (SELECT COUNT(*)::int FROM metlink_stops ms, iso
                 WHERE ST_Within(ms.geom, iso.geom)
                ) + (SELECT COUNT(*)::int FROM at_stops ats, iso
                 WHERE ST_Within(ats.geom, iso.geom)
                ) AS total_stops,

                (SELECT COUNT(*)::int FROM metlink_stops ms, iso
                 WHERE ST_Within(ms.geom, iso.geom) AND 3 = ANY(ms.route_types)
                ) + (SELECT COUNT(*)::int FROM at_stops ats, iso
                 WHERE ST_Within(ats.geom, iso.geom) AND 3 = ANY(ats.route_types)
                ) AS bus_stops,

                (SELECT COUNT(*)::int FROM metlink_stops ms, iso
                 WHERE ST_Within(ms.geom, iso.geom) AND 2 = ANY(ms.route_types)
                ) + (SELECT COUNT(*)::int FROM at_stops ats, iso
                 WHERE ST_Within(ats.geom, iso.geom) AND 2 = ANY(ats.route_types)
                ) AS rail_stops,

                (SELECT COUNT(*)::int FROM metlink_stops ms, iso
                 WHERE ST_Within(ms.geom, iso.geom) AND 4 = ANY(ms.route_types)
                ) + (SELECT COUNT(*)::int FROM at_stops ats, iso
                 WHERE ST_Within(ats.geom, iso.geom) AND 4 = ANY(ats.route_types)
                ) AS ferry_stops
            """,
            [geojson_str],
        )
        counts = cur.fetchone()

        return {
            f"transit_stops_walk_{minutes}min": counts["total_stops"],
            f"bus_stops_walk_{minutes}min": counts["bus_stops"],
            f"rail_stops_walk_{minutes}min": counts["rail_stops"],
            f"ferry_stops_walk_{minutes}min": counts["ferry_stops"],
            "isochrone_method": "valhalla",
            "isochrone_geojson": feature["geometry"],
        }

    # Fallback: simple radius
    radius_m = minutes * 80  # ~80m per minute at 5km/h
    logger.info("Using %dm radius fallback for %d-min walk", radius_m, minutes)

    cur = await conn.execute(
        """
        SELECT
            (SELECT COUNT(*)::int FROM metlink_stops ms
             WHERE ms.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ms.geom::geography, a.geom::geography, %s)
            ) + (SELECT COUNT(*)::int FROM at_stops ats
             WHERE ats.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ats.geom::geography, a.geom::geography, %s)
            ) AS total_stops,

            (SELECT COUNT(*)::int FROM metlink_stops ms
             WHERE ms.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ms.geom::geography, a.geom::geography, %s)
               AND 3 = ANY(ms.route_types)
            ) + (SELECT COUNT(*)::int FROM at_stops ats
             WHERE ats.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ats.geom::geography, a.geom::geography, %s)
               AND 3 = ANY(ats.route_types)
            ) AS bus_stops,

            (SELECT COUNT(*)::int FROM metlink_stops ms
             WHERE ms.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ms.geom::geography, a.geom::geography, %s)
               AND 2 = ANY(ms.route_types)
            ) + (SELECT COUNT(*)::int FROM at_stops ats
             WHERE ats.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ats.geom::geography, a.geom::geography, %s)
               AND 2 = ANY(ats.route_types)
            ) AS rail_stops,

            (SELECT COUNT(*)::int FROM metlink_stops ms
             WHERE ms.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ms.geom::geography, a.geom::geography, %s)
               AND 4 = ANY(ms.route_types)
            ) + (SELECT COUNT(*)::int FROM at_stops ats
             WHERE ats.geom && ST_Expand(a.geom, %s / 111320.0)
               AND ST_DWithin(ats.geom::geography, a.geom::geography, %s)
               AND 4 = ANY(ats.route_types)
            ) AS ferry_stops
        FROM addresses a
        WHERE a.address_id = %s
        """,
        [radius_m] * 16 + [address_id],
    )
    counts = cur.fetchone()

    return {
        f"transit_stops_walk_{minutes}min": counts["total_stops"] if counts else 0,
        f"bus_stops_walk_{minutes}min": counts["bus_stops"] if counts else 0,
        f"rail_stops_walk_{minutes}min": counts["rail_stops"] if counts else 0,
        f"ferry_stops_walk_{minutes}min": counts["ferry_stops"] if counts else 0,
        "isochrone_method": "radius",
        "isochrone_geojson": None,
    }


async def get_terrain_at_property(conn, address_id: int) -> dict[str, Any]:
    """
    Get terrain data for a property — tries Valhalla /height first,
    falls back to PostGIS SRTM raster if loaded.

    Returns:
        {
            "elevation_m": float | None,
            "slope_degrees": float | None,
            "slope_category": str,          # flat/gentle/moderate/steep/very_steep/extreme
            "aspect_degrees": float | None,
            "aspect_label": str,            # north/south/east/west etc.
            "terrain_source": "valhalla" | "postgis" | "none",
        }
    """
    # Get property coordinates
    cur = await conn.execute(
        "SELECT ST_X(geom) AS lon, ST_Y(geom) AS lat FROM addresses WHERE address_id = %s",
        [address_id],
    )
    row = cur.fetchone()
    if not row:
        return _empty_terrain()

    lat, lon = row["lat"], row["lon"]

    # Try PostGIS raster if SRTM has been loaded (check function exists first
    # to avoid aborting the transaction on error)
    try:
        cur = await conn.execute(
            "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_terrain_summary')"
        )
        fn_exists = cur.fetchone()
        if fn_exists and list(fn_exists.values())[0]:
            cur = await conn.execute(
                "SELECT * FROM get_terrain_summary(%s, %s)",
                [lon, lat],
            )
            terrain = cur.fetchone()
            if terrain and terrain["elevation_m"] is not None:
                # PostGIS doesn't give us cardinal samples, so we fetch them
                # from Valhalla for inference (fast, single HTTP call)
                offset = 0.00027
                sample_pts = [
                    {"lat": lat, "lon": lon},
                    {"lat": lat + offset, "lon": lon},
                    {"lat": lat - offset, "lon": lon},
                    {"lat": lat, "lon": lon + offset},
                    {"lat": lat, "lon": lon - offset},
                ]
                pg_elevs = await get_elevation_multi(sample_pts)
                pg_cardinal = {}
                if pg_elevs and len(pg_elevs) == 5:
                    pg_cardinal = {"n": pg_elevs[1], "s": pg_elevs[2], "e": pg_elevs[3], "w": pg_elevs[4]}
                inferences = _classify_terrain_inferences(
                    round(terrain["elevation_m"], 1),
                    pg_cardinal,
                    round(terrain["slope_degrees"], 1) if terrain["slope_degrees"] else None,
                    terrain["aspect_label"],
                )
                return {
                    "elevation_m": round(terrain["elevation_m"], 1),
                    "slope_degrees": round(terrain["slope_degrees"], 1) if terrain["slope_degrees"] else None,
                    "slope_category": terrain["slope_category"],
                    "aspect_degrees": round(terrain["aspect_degrees"], 1) if terrain["aspect_degrees"] else None,
                    "aspect_label": terrain["aspect_label"],
                    "terrain_source": "postgis",
                    **inferences,
                }
    except Exception:
        # PostGIS raster query failed — fall through to Valhalla
        pass

    # Valhalla /height with multi-point slope estimation
    # Sample center + 4 cardinal neighbors (~30m apart = 1 SRTM pixel)
    offset = 0.00027  # ~30m in degrees at NZ latitudes
    sample_points = [
        {"lat": lat, "lon": lon},              # center
        {"lat": lat + offset, "lon": lon},     # north
        {"lat": lat - offset, "lon": lon},     # south
        {"lat": lat, "lon": lon + offset},     # east
        {"lat": lat, "lon": lon - offset},     # west
    ]
    elevs = await get_elevation_multi(sample_points)
    if elevs and len(elevs) == 5 and elevs[0] is not None and elevs[0] > -500:
        center_elev = elevs[0]
        cardinal = {"n": elevs[1], "s": elevs[2], "e": elevs[3], "w": elevs[4]}
        slope_deg, aspect_deg = _compute_slope_from_samples(center_elev, lat, lon, cardinal)

        slope_cat = "unknown"
        if slope_deg is not None:
            if slope_deg < 2: slope_cat = "flat"
            elif slope_deg < 5: slope_cat = "gentle"
            elif slope_deg < 10: slope_cat = "moderate"
            elif slope_deg < 15: slope_cat = "steep"
            elif slope_deg < 25: slope_cat = "very steep"
            else: slope_cat = "extreme"

        aspect_label = "flat"
        if aspect_deg is not None and slope_deg and slope_deg >= 2:
            if aspect_deg < 22.5 or aspect_deg >= 337.5: aspect_label = "north"
            elif aspect_deg < 67.5: aspect_label = "northeast"
            elif aspect_deg < 112.5: aspect_label = "east"
            elif aspect_deg < 157.5: aspect_label = "southeast"
            elif aspect_deg < 202.5: aspect_label = "south"
            elif aspect_deg < 247.5: aspect_label = "southwest"
            elif aspect_deg < 292.5: aspect_label = "west"
            else: aspect_label = "northwest"

        inferences = _classify_terrain_inferences(
            center_elev, cardinal, slope_deg, aspect_label,
        )
        return {
            "elevation_m": round(center_elev, 1),
            "slope_degrees": slope_deg,
            "slope_category": slope_cat,
            "aspect_degrees": aspect_deg,
            "aspect_label": aspect_label,
            "terrain_source": "valhalla",
            **inferences,
        }

    return _empty_terrain()


def _empty_terrain() -> dict[str, Any]:
    return {
        "elevation_m": None,
        "slope_degrees": None,
        "slope_category": "unknown",
        "aspect_degrees": None,
        "aspect_label": "unknown",
        "terrain_source": "none",
        "is_depression": None,
        "depression_depth_m": None,
        "relative_position": "unknown",
        "wind_exposure": "unknown",
        "wind_exposure_score": None,
        "flood_terrain_risk": "unknown",
        "flood_terrain_score": None,
    }


def _classify_terrain_inferences(
    center_elev: float,
    cardinal_elevs: dict[str, float | None],
    slope_deg: float | None,
    aspect_label: str,
) -> dict[str, Any]:
    """Infer flood-prone terrain, wind exposure, and relative position from
    the 5-point elevation sample we already fetch.

    cardinal_elevs: {"n": elev, "s": elev, "e": elev, "w": elev}
    """
    n = cardinal_elevs.get("n")
    s = cardinal_elevs.get("s")
    e = cardinal_elevs.get("e")
    w = cardinal_elevs.get("w")

    valid = [v for v in [n, s, e, w] if v is not None and v > -500]
    if len(valid) < 4:
        return {
            "is_depression": None,
            "depression_depth_m": None,
            "relative_position": "unknown",
            "wind_exposure": "unknown",
            "wind_exposure_score": None,
            "flood_terrain_risk": "unknown",
            "flood_terrain_score": None,
        }

    higher_count = sum(1 for v in valid if v > center_elev + 0.5)
    lower_count = sum(1 for v in valid if v < center_elev - 0.5)

    # --- Relative position ---
    if higher_count == 4:
        rel_pos = "depression"
    elif higher_count >= 3:
        rel_pos = "valley"
    elif lower_count == 4:
        rel_pos = "hilltop"
    elif lower_count >= 3:
        rel_pos = "ridgeline"
    else:
        rel_pos = "mid-slope"

    # --- Depression detection ---
    is_depression = higher_count == 4
    depression_depth = None
    if is_depression:
        depression_depth = round(min(valid) - center_elev, 1)

    # --- Wind exposure ---
    slope = slope_deg or 0
    west_facing = aspect_label in ("west", "northwest", "southwest")
    high_elev = center_elev > 100
    very_high_elev = center_elev > 200

    if rel_pos in ("hilltop", "ridgeline") and (very_high_elev or west_facing):
        wind_exp, wind_score = "very_exposed", 5
    elif rel_pos in ("hilltop", "ridgeline") and high_elev:
        wind_exp, wind_score = "exposed", 4
    elif rel_pos in ("hilltop", "ridgeline"):
        wind_exp, wind_score = "exposed", 4
    elif rel_pos == "mid-slope" and west_facing and high_elev:
        wind_exp, wind_score = "exposed", 4
    elif rel_pos == "mid-slope" and west_facing:
        wind_exp, wind_score = "moderate", 3
    elif rel_pos in ("depression", "valley"):
        wind_exp, wind_score = "sheltered", 1 if rel_pos == "depression" else 2
    else:
        wind_exp, wind_score = "moderate", 3

    # --- Flood terrain risk ---
    flat = slope < 2
    low = center_elev < 10
    mod_low = center_elev < 20

    if is_depression and flat and low:
        flood_risk, flood_score = "high", 4
    elif is_depression and flat:
        flood_risk, flood_score = "moderate", 3
    elif flat and low:
        flood_risk, flood_score = "moderate", 3
    elif is_depression and low:
        flood_risk, flood_score = "moderate", 3
    elif flat and mod_low:
        flood_risk, flood_score = "low", 2
    elif flat:
        flood_risk, flood_score = "low", 1
    else:
        flood_risk, flood_score = "none", 0

    return {
        "is_depression": is_depression,
        "depression_depth_m": depression_depth,
        "relative_position": rel_pos,
        "wind_exposure": wind_exp,
        "wind_exposure_score": wind_score,
        "flood_terrain_risk": flood_risk,
        "flood_terrain_score": flood_score,
    }


def classify_landslide_risk_from_slope(slope_degrees: float | None) -> dict[str, Any]:
    """
    Classify landslide susceptibility based on slope angle.

    Based on NZ GeoNet / GNS Science slope thresholds:
      - <5°: Very low risk
      - 5-15°: Low risk
      - 15-25°: Moderate risk — soil creep possible
      - 25-35°: High risk — shallow landslides likely
      - >35°: Very high risk — rockfall and deep-seated failures

    This supplements the existing slope_failure table data with
    continuous slope-based risk even where no mapped landslides exist.
    """
    if slope_degrees is None:
        return {"slope_risk": "unknown", "slope_risk_score": None, "slope_risk_detail": None}

    if slope_degrees < 5:
        return {
            "slope_risk": "very_low",
            "slope_risk_score": 1,
            "slope_risk_detail": "Flat to near-flat terrain. Negligible landslide risk from slope alone.",
        }
    elif slope_degrees < 15:
        return {
            "slope_risk": "low",
            "slope_risk_score": 2,
            "slope_risk_detail": f"Gentle slope ({slope_degrees:.0f}°). Low landslide risk under normal conditions.",
        }
    elif slope_degrees < 25:
        return {
            "slope_risk": "moderate",
            "slope_risk_score": 3,
            "slope_risk_detail": f"Moderate slope ({slope_degrees:.0f}°). Soil creep and shallow failures possible in heavy rain.",
        }
    elif slope_degrees < 35:
        return {
            "slope_risk": "high",
            "slope_risk_score": 4,
            "slope_risk_detail": f"Steep slope ({slope_degrees:.0f}°). Shallow landslides likely during extreme rainfall. Consider geotechnical assessment.",
        }
    else:
        return {
            "slope_risk": "very_high",
            "slope_risk_score": 5,
            "slope_risk_detail": f"Very steep slope ({slope_degrees:.0f}°). High rockfall and deep-seated landslide risk. Geotechnical assessment strongly recommended.",
        }

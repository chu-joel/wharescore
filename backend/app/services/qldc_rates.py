# backend/app/services/qldc_rates.py
"""
Queenstown-Lakes District Council ArcGIS property data client.
Uses the QLDC FeatureServer REST API to query property valuations.

Single-step lookup: search by address via ArcGIS query → full property data.
No cache needed. ArcGIS queries are fast and stateless.
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

QLDC_PROPERTIES_URL = (
    "https://services1.arcgis.com/9YyqaQtDdDR8tupG/arcgis/rest/services/"
    "Land_Parcels_and_Properties_Data/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "PHYSADDRESS", "STREET", "LOCALITY", "POSTCODE",
    "ASSESSMENT_NO", "RATESLEGAL", "CERT_OF_TITLE",
    "LAND_VALUE", "CAPITAL_VALUE", "IMPROVEMENTS_VALUE",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Main Street, Queenstown' → "PHYSADDRESS LIKE '42 MAIN STREET%'"
    Addresses are stored UPPERCASE in QLDC data.
    """
    parts = full_address.split(",")
    street = parts[0].strip().upper()
    street = street.replace("'", "''")
    return f"PHYSADDRESS LIKE '{street}%'"


async def fetch_qldc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from QLDC ArcGIS FeatureServer.

    Lookup strategy:
    1. If we have a reference coordinate from our addresses table, do a spatial
       query and return the nearest QLDC record. This handles unit-titled CBD
       addresses like '109 Beach Street' where the PHYSADDRESS LIKE match would
       return dozens of unit records with only some populated.
    2. Otherwise fall back to the PHYSADDRESS LIKE search.
    3. In both cases, if the final record has no CV/LV/IV, return None so the
       router responds with a proper 404 instead of an all-null payload.
    """
    try:
        ref_lat, ref_lng = await _lookup_coords(address, conn)

        if ref_lat is not None and ref_lng is not None:
            prop = await _fetch_by_spatial(ref_lat, ref_lng)
        else:
            prop = await _fetch_by_address(address)

        if not prop:
            return None
        # Treat all-null OR all-zero CV/LV/IV as "no data" and let the router
        # 404. Unit-titled parcels in QLDC ArcGIS often have null=0 valuations
        # because the value lives on the parent strata title. there's no
        # useful information in such a record for the user.
        cv = _safe_int(prop.get("CAPITAL_VALUE"))
        lv = _safe_int(prop.get("LAND_VALUE"))
        iv = _safe_int(prop.get("IMPROVEMENTS_VALUE"))
        if not cv and not lv and not iv:
            return None
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"QLDC ArcGIS error for {address}: {e}")
        return None


async def _lookup_coords(address: str, conn) -> tuple[float | None, float | None]:
    if not conn:
        return None, None
    try:
        cur = await conn.execute(
            "SELECT ST_Y(geom) AS lat, ST_X(geom) AS lng FROM addresses "
            "WHERE full_address = %s LIMIT 1",
            [address],
        )
        row = cur.fetchone()
        if row and row.get("lat") is not None and row.get("lng") is not None:
            return float(row["lat"]), float(row["lng"])
    except Exception as e:
        logger.debug(f"QLDC coord lookup failed for {address}: {e}")
    return None, None


async def _fetch_by_spatial(lat: float, lng: float) -> dict | None:
    """Find the QLDC parcel whose point/centroid is nearest to (lat, lng)."""
    params = {
        "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint",
        "spatialRel": "esriSpatialRelIntersects",
        "distance": "50",
        "units": "esriSRUnit_Meter",
        "inSR": "4326",
        "outFields": OUT_FIELDS,
        "returnGeometry": "true",
        "outSR": "4326",
        "f": "json",
    }
    url = f"{QLDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
    data = await _fetch_json(url)
    if not data or not data.get("features"):
        return None
    return _pick_nearest(data["features"], lat, lng)


async def _fetch_by_address(address: str) -> dict | None:
    """Fallback: PHYSADDRESS LIKE lookup for addresses not in our DB."""
    where = _build_search(address)
    params = {
        "where": where,
        "outFields": OUT_FIELDS,
        "returnGeometry": "false",
        "f": "json",
    }
    url = f"{QLDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
    data = await _fetch_json(url)
    if not data or not data.get("features"):
        return None
    features = data["features"]
    return _best_match(features, address)


def _pick_nearest(features: list[dict], lat: float, lng: float) -> dict | None:
    """Return the attributes of the feature whose geometry is closest to (lat, lng).
    Handles both Point geometries (x/y) and Polygon geometries (use first ring's
    first vertex as a cheap centroid proxy)."""
    def d(f: dict) -> float:
        g = f.get("geometry") or {}
        if "x" in g and "y" in g and g.get("x") is not None:
            fx, fy = float(g["x"]), float(g["y"])
        else:
            rings = g.get("rings") or []
            if not rings or not rings[0]:
                return float("inf")
            fx, fy = float(rings[0][0][0]), float(rings[0][0][1])
        dx = (fx - lng) * math.cos(math.radians(lat))
        dy = fy - lat
        return dx * dx + dy * dy

    ranked = sorted(features, key=d)
    if not ranked:
        return None
    return ranked[0].get("attributes") or None


def _best_match(features: list[dict], address: str) -> dict | None:
    """Pick the best matching feature when multiple results are returned."""
    if not features:
        return None
    if len(features) == 1:
        return features[0].get("attributes") or None

    # Try to match unit number if present
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1).upper()
        for f in features:
            attrs = f.get("attributes") or {}
            addr = (attrs.get("PHYSADDRESS") or "").strip()
            if addr.startswith(f"{unit}/"):
                return attrs

    return features[0].get("attributes") or None


def _format_response(prop: dict) -> dict:
    """Format QLDC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("CAPITAL_VALUE"))
    lv = _safe_int(prop.get("LAND_VALUE"))
    iv = _safe_int(prop.get("IMPROVEMENTS_VALUE"))
    if iv is None and cv and lv:
        iv = cv - lv

    return {
        "valuation_number": prop.get("ASSESSMENT_NO"),
        "address": prop.get("PHYSADDRESS"),
        "legal_description": prop.get("RATESLEGAL"),
        "cert_of_title": prop.get("CERT_OF_TITLE"),
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": None,
        },
        "previous_valuation": None,
        "levy_breakdown": [],
        "source": "qldc_arcgis",
    }


def _safe_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _safe_float(v) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


async def _fetch_json(url: str, timeout: int = 8) -> dict | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"QLDC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

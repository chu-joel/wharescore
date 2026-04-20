# backend/app/services/ccc_rates.py
"""
Christchurch City Council ArcGIS property data client.
CCC's rating layer has CV/LV/IV but NO street addresses. only
ValuationReference and RateLegalDescription. Lookups use spatial
queries (point geometry) matched against LINZ address coordinates.
"""
from __future__ import annotations

import asyncio
import logging
import urllib.parse

import requests

logger = logging.getLogger(__name__)

CCC_PROPERTIES_URL = (
    "https://gis.ccc.govt.nz/arcgis/rest/services/"
    "CorporateData/Rating/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "ValuationReference", "RateLegalDescription",
    "CapitalValue", "LandValue", "ImprovementsValue",
])


async def fetch_ccc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from CCC ArcGIS via spatial query.
    Since CCC has no address field, we look up the address coordinates
    from our DB and do a spatial query against the CCC point layer.

    CBD parcels can have multiple CCC records within 50 m (overlapping towers,
    stratum estates, shared-driveway splits). We ask ArcGIS to return the result
    geometry and pick the point closest to our address, not an arbitrary first
    feature. If the nearest record has a null CapitalValue, return None rather
    than emit a useless all-null response.
    """
    try:
        if not conn:
            return None

        # Get coordinates for this address from our addresses table
        cur = await conn.execute(
            "SELECT ST_X(geom) as lng, ST_Y(geom) as lat FROM addresses "
            "WHERE full_address = %s LIMIT 1", [address]
        )
        row = cur.fetchone()
        if not row or not row.get("lng"):
            return None

        lng, lat = float(row["lng"]), float(row["lat"])

        # Spatial query. return geometry so we can rank by true distance.
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
        url = f"{CCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            return None

        prop = _pick_nearest(data["features"], lat, lng)
        if prop is None:
            return None
        # If this CCC record has no CV, treat as a miss rather than return nulls.
        if _safe_int(prop.get("CapitalValue")) is None:
            return None
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"CCC ArcGIS error for {address}: {e}")
        return None


def _pick_nearest(features: list[dict], lat: float, lng: float) -> dict | None:
    """Return the attributes dict of the feature whose point is closest to (lat, lng)."""
    import math

    def d(f: dict) -> float:
        g = f.get("geometry") or {}
        fx, fy = g.get("x"), g.get("y")
        if fx is None or fy is None:
            return float("inf")
        # Simple equirectangular. CCC features are all within a few km of lat,
        # which is more than precise enough for ranking.
        dx = (float(fx) - lng) * math.cos(math.radians(lat))
        dy = float(fy) - lat
        return dx * dx + dy * dy

    sorted_feats = sorted(features, key=d)
    if not sorted_feats:
        return None
    nearest = sorted_feats[0]
    return nearest.get("attributes") or None


def _format_response(prop: dict) -> dict:
    cv = _safe_int(prop.get("CapitalValue"))
    lv = _safe_int(prop.get("LandValue"))
    iv = _safe_int(prop.get("ImprovementsValue"))
    if iv is None and cv and lv:
        iv = cv - lv

    return {
        "valuation_number": prop.get("ValuationReference"),
        "address": None,
        "legal_description": prop.get("RateLegalDescription"),
        "cert_of_title": None,
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": None,
        },
        "previous_valuation": None,
        "levy_breakdown": [],
        "source": "ccc_arcgis",
    }


def _safe_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def _fetch_json(url: str, timeout: int = 8) -> dict | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"CCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

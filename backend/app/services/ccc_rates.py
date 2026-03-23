# backend/app/services/ccc_rates.py
"""
Christchurch City Council ArcGIS property data client.
CCC's rating layer has CV/LV/IV but NO street addresses — only
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

        lng, lat = row["lng"], row["lat"]

        # Spatial query: find the nearest CCC rating unit
        params = {
            "geometry": f"{lng},{lat}",
            "geometryType": "esriGeometryPoint",
            "spatialRel": "esriSpatialRelIntersects",
            "distance": "50",
            "units": "esriSRUnit_Meter",
            "inSR": "4326",
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{CCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            return None

        prop = data["features"][0]["attributes"]
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"CCC ArcGIS error for {address}: {e}")
        return None


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

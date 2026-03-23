# backend/app/services/qldc_rates.py
"""
Queenstown-Lakes District Council ArcGIS property data client.
Uses the QLDC FeatureServer REST API to query property valuations.

Single-step lookup: search by address via ArcGIS query → full property data.
No cache needed — ArcGIS queries are fast and stateless.
"""
from __future__ import annotations

import asyncio
import logging
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
    """Fetch property data from QLDC ArcGIS FeatureServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{QLDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"QLDC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No QLDC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"QLDC ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    """Pick the best matching feature when multiple results are returned."""
    if len(features) == 1:
        return features[0]["attributes"]

    # Try to match unit number if present
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1).upper()
        for f in features:
            attrs = f["attributes"]
            addr = (attrs.get("PHYSADDRESS") or "").strip()
            if addr.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


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

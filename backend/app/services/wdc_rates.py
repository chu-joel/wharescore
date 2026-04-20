# backend/app/services/wdc_rates.py
"""
Whangarei District Council ArcGIS property data client.
Uses the WDC MapServer REST API to query property valuations.

Single-step lookup: search by address via ArcGIS query → full property data.
No cache needed. ArcGIS queries are fast and stateless.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

WDC_PROPERTIES_URL = (
    "https://geo.wdc.govt.nz/server/rest/services/"
    "Property__Land__Roads_and_Rail_public_view/MapServer/12/query"
)

OUT_FIELDS = ",".join([
    "situation_full1", "as_assess_no", "as_cv", "as_lv",
    "as_improvements", "Floor_Area", "Site", "app_concat",
    "rup_zone_code", "rup_category_code", "rup_land_use_code",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Bank Street, Regent, Whangarei' → "situation_full1 LIKE '42 Bank Street%'"
    '2/10 Mill Road, Kamo, Whangarei' → "situation_full1 LIKE '2/10 Mill Road%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"situation_full1 LIKE '{street}%'"


async def fetch_wdc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from WDC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{WDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"WDC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No WDC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"WDC ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    """Pick the best matching feature when multiple results are returned."""
    if len(features) == 1:
        return features[0]["attributes"]

    # Try to match unit number if present
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            attrs = f["attributes"]
            addr = (attrs.get("situation_full1") or "").strip()
            if addr.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format WDC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("as_cv"))
    lv = _safe_int(prop.get("as_lv"))
    iv = None
    if cv is not None and lv is not None:
        iv = cv - lv

    return {
        "valuation_number": prop.get("as_assess_no"),
        "address": prop.get("situation_full1"),
        "legal_description": prop.get("app_concat"),
        "cert_of_title": None,
        "property_improvements": prop.get("as_improvements"),
        "total_floor_area_sqm": _safe_float(prop.get("Floor_Area")),
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": None,
        },
        "previous_valuation": None,
        "levy_breakdown": [],
        "source": "wdc_arcgis",
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
        logger.warning(f"WDC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

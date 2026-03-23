# backend/app/services/icc_rates.py
"""
Invercargill City Council ArcGIS property data client.
Uses the ICC MapServer REST API to query property valuations and rates.

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

ICC_PROPERTIES_URL = (
    "https://gis.icc.govt.nz/arcgis/rest/services/"
    "Essentials/CityMap/MapServer/55/query"
)

OUT_FIELDS = ",".join([
    "ADDRESS", "HOUSE", "UNIT", "STREET",
    "CAPITAL", "LAND", "PREV_CAP", "PREV_LAND",
    "RATES_STRU", "VGNUMBER", "appellation", "titles", "SUBURB_PC",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '25 Abbot Street, Invercargill' → "ADDRESS LIKE '25 Abbot Street%'"
    Keep unit prefix — ICC stores addresses with units.
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    # Escape single quotes for SQL
    street = street.replace("'", "''")
    return f"ADDRESS LIKE '{street}%'"


async def fetch_icc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from ICC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{ICC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"ICC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No ICC results for: {where}")
            return None

        # If multiple results, prefer the one whose address most closely matches
        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"ICC ArcGIS error for {address}: {e}")
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
            feat_unit = attrs.get("UNIT")
            if feat_unit is not None and str(int(feat_unit)) == unit:
                return attrs

    # Fall back to first result
    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format ICC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("CAPITAL"))
    lv = _safe_int(prop.get("LAND"))
    iv = (cv or 0) - (lv or 0) if cv else None

    total_rates = _safe_float(prop.get("RATES_STRU"))

    # Build levy breakdown
    levy_breakdown = []
    if total_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Invercargill City Council Rates", "ratesAmount": total_rates}],
            "subtotal": total_rates,
        })

    # Previous valuation
    prev_cv = _safe_int(prop.get("PREV_CAP"))
    prev_lv = _safe_int(prop.get("PREV_LAND"))
    previous_valuation = None
    if prev_cv:
        previous_valuation = {
            "capital_value": prev_cv,
            "land_value": prev_lv,
            "total_rates": None,
        }

    return {
        "valuation_number": prop.get("VGNUMBER"),
        "address": (prop.get("ADDRESS") or "").strip(),
        "legal_description": prop.get("appellation"),
        "cert_of_title": prop.get("titles"),
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": total_rates,
        },
        "previous_valuation": previous_valuation,
        "levy_breakdown": levy_breakdown,
        "source": "icc_arcgis",
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
    """Fetch JSON from URL with timeout."""
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"ICC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    """Synchronous HTTP fetch (run in thread pool)."""
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

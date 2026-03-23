# backend/app/services/hastings_rates.py
"""
Hastings District Council ArcGIS property data client.
Uses the HDC MapServer REST API to query property rates.

Single-step lookup: search by address via ArcGIS query → full property data.
No cache needed — ArcGIS queries are fast and stateless.

NOTE: This council has RATES but NO CV/LV. We still load it because the
annual rates amount (RT_CurrentYear) is valuable data.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

HDC_PROPERTIES_URL = (
    "https://gismaps.hdc.govt.nz/server/rest/services/"
    "Property/Property_Data/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "PropertyNo", "PR_address", "RT_assessment_no", "RT_CurrentYear",
    "VAL_area", "PR_cert_of_title", "RT_override_legal", "Suburb",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Queen Street, Hastings Central, Hastings' → "PR_address LIKE '42 Queen Street%'"
    '2/10 Pakowhai Road, Tomoana, Hastings' → "PR_address LIKE '2/10 Pakowhai Road%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"PR_address LIKE '{street}%'"


async def fetch_hastings_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from Hastings District Council ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{HDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"Hastings query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No Hastings results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"Hastings ArcGIS error for {address}: {e}")
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
            addr = (attrs.get("PR_address") or "").strip()
            if addr.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format Hastings ArcGIS data to match the common rates response format."""
    rt_current = _safe_float(prop.get("RT_CurrentYear"))

    total_rates = rt_current

    levy_breakdown = []
    if rt_current:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Hastings District Council Rates", "ratesAmount": rt_current}],
            "subtotal": rt_current,
        })

    return {
        "valuation_number": prop.get("RT_assessment_no"),
        "address": prop.get("PR_address"),
        "legal_description": prop.get("RT_override_legal"),
        "cert_of_title": prop.get("PR_cert_of_title"),
        "property_improvements": None,
        "current_valuation": {
            "capital_value": None,
            "land_value": None,
            "improvements_value": None,
            "total_rates": total_rates,
        },
        "previous_valuation": None,
        "levy_breakdown": levy_breakdown,
        "source": "hastings_arcgis",
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
        logger.warning(f"Hastings fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

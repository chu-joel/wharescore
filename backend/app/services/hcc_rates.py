# backend/app/services/hcc_rates.py
"""
Hutt City Council ArcGIS property data client.
Uses the HCC MapServer REST API to query property valuations and rates.

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

HCC_PROPERTIES_URL = (
    "https://maps.huttcity.govt.nz/server01/rest/services/"
    "HCC_External_Data/MapServer/1/query"
)

OUT_FIELDS = ",".join([
    "prop_address", "house_no_full", "street_name",
    "capital_value", "land_value", "council_rates", "regional_rates", "total_rates",
    "past_capital_value", "past_land_value",
    "past_council_rates", "past_regional_rates", "past_total_rates",
    "valuation", "cert_of_title", "prop_improv",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '3/10 Laings Road, Hutt Central, Lower Hutt' → "prop_address LIKE '3/10 Laings Road%'"
    '42 High Street, Petone, Lower Hutt' → "prop_address LIKE '42 High Street%'"
    Keep unit prefix. HCC stores addresses as '2/139 Knights Road'.
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    # Escape single quotes for SQL
    street = street.replace("'", "''")
    return f"prop_address LIKE '{street}%'"


async def fetch_hcc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from HCC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{HCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"HCC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No HCC results for: {where}")
            return None

        # If multiple results, prefer the one whose address most closely matches
        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"HCC ArcGIS error for {address}: {e}")
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
            house_no = (attrs.get("house_no_full") or "").strip()
            if house_no == unit or house_no.startswith(f"{unit}/"):
                return attrs

    # Fall back to first result
    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format HCC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("capital_value"))
    lv = _safe_int(prop.get("land_value"))
    iv = (cv or 0) - (lv or 0) if cv else None

    council_rates = _safe_float(prop.get("council_rates"))
    regional_rates = _safe_float(prop.get("regional_rates"))
    total_rates = _safe_float(prop.get("total_rates"))

    # Build levy breakdown from council + regional split
    levy_breakdown = []
    if council_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Hutt City Council Rates", "ratesAmount": council_rates}],
            "subtotal": council_rates,
        })
    if regional_rates:
        levy_breakdown.append({
            "category": "Regional Rates",
            "items": [{"description": "Greater Wellington Regional Council Rates", "ratesAmount": regional_rates}],
            "subtotal": regional_rates,
        })

    # Previous valuation
    prev_cv = _safe_int(prop.get("past_capital_value"))
    prev_lv = _safe_int(prop.get("past_land_value"))
    previous_valuation = None
    if prev_cv:
        previous_valuation = {
            "capital_value": prev_cv,
            "land_value": prev_lv,
            "total_rates": _safe_float(prop.get("past_total_rates")),
        }

    return {
        "valuation_number": prop.get("valuation"),
        "address": prop.get("prop_address"),
        "legal_description": None,
        "cert_of_title": prop.get("cert_of_title"),
        "property_improvements": prop.get("prop_improv"),
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": total_rates,
        },
        "previous_valuation": previous_valuation,
        "levy_breakdown": levy_breakdown,
        "source": "hcc_arcgis",
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
        logger.warning(f"HCC fetch failed: {e}")
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

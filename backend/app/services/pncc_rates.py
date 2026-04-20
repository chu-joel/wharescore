# backend/app/services/pncc_rates.py
"""
Palmerston North City Council ArcGIS property data client.
Uses the PNCC FeatureServer REST API to query property valuations and rates.

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

PNCC_PROPERTIES_URL = (
    "https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/"
    "PROPERTY_PARCEL_VALUATION_VIEW/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "LOCATION", "VALUATION_NO", "RATES_LEGAL", "RATES_AREA",
    "RATES_ADDR", "RATES_AMOUNT", "CURR_LAND_VALUE",
    "CURR_CAPITAL_VALUE", "RATES_YEAR",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Grey Street, Palmerston North' → "LOCATION LIKE '42 Grey Street%'"
    '2/10 Featherston Street, Palmerston North' → "LOCATION LIKE '2/10 Featherston Street%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"LOCATION LIKE '{street}%'"


def _parse_currency(v) -> float | None:
    """Parse PNCC currency strings like '$ 3988.89' or '$ 465000' to numeric."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        cleaned = str(v).replace("$", "").replace(",", "").strip()
        if not cleaned:
            return None
        return float(cleaned)
    except (TypeError, ValueError):
        return None


async def fetch_pncc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from PNCC ArcGIS FeatureServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{PNCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"PNCC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No PNCC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"PNCC ArcGIS error for {address}: {e}")
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
            loc = (attrs.get("LOCATION") or "").strip()
            if loc.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format PNCC ArcGIS data to match the common rates response format."""
    cv = _safe_int(_parse_currency(prop.get("CURR_CAPITAL_VALUE")))
    lv = _safe_int(_parse_currency(prop.get("CURR_LAND_VALUE")))
    iv = None
    if cv and lv:
        iv = cv - lv

    total_rates = _safe_float(_parse_currency(prop.get("RATES_AMOUNT")))

    levy_breakdown = []
    if total_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Palmerston North City Council Rates", "ratesAmount": total_rates}],
            "subtotal": total_rates,
        })

    return {
        "valuation_number": prop.get("VALUATION_NO"),
        "address": prop.get("LOCATION"),
        "legal_description": prop.get("RATES_LEGAL"),
        "cert_of_title": None,
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": total_rates,
        },
        "previous_valuation": None,
        "levy_breakdown": levy_breakdown,
        "source": "pncc_arcgis",
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
        logger.warning(f"PNCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

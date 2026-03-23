# backend/app/services/hdc_rates.py
"""
Horowhenua District Council property data client.
Uses the Horizons Regional Council ArcGIS MapServer REST API, filtered
to Horowhenua District properties.

Single-step lookup: search by address via ArcGIS query → full property data.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

HORIZONS_PROPERTIES_URL = (
    "https://maps.horizons.govt.nz/arcgis/rest/services/"
    "LocalMapsPublic/Public_Property/MapServer/1/query"
)

OUT_FIELDS = ",".join([
    "VnzLocation", "VnzCapitalValue", "VnzLandValue",
    "VnzLegalDescription", "ValuationNumber", "TerritorialAuthority",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '1 Oxford Street, Levin, Horowhenua' → "VnzLocation LIKE '%1 Oxford Street%' AND TerritorialAuthority LIKE '%Horowhenua%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"VnzLocation LIKE '%{street}%' AND TerritorialAuthority LIKE '%Horowhenua%'"


async def fetch_hdc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from Horizons ArcGIS MapServer (Horowhenua)."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{HORIZONS_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"HDC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No HDC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"HDC/Horizons ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    """Pick the best matching feature when multiple results are returned."""
    if len(features) == 1:
        return features[0]["attributes"]

    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            attrs = f["attributes"]
            loc = (attrs.get("VnzLocation") or "").strip()
            if f"{unit}/" in loc or f"{unit} " in loc:
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format Horizons ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("VnzCapitalValue"))
    lv = _safe_int(prop.get("VnzLandValue"))
    iv = (cv or 0) - (lv or 0) if cv else None

    return {
        "valuation_number": prop.get("ValuationNumber"),
        "address": prop.get("VnzLocation"),
        "legal_description": prop.get("VnzLegalDescription"),
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
        "source": "horizons_arcgis",
    }


def _safe_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def _fetch_json(url: str, timeout: int = 10) -> dict | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"HDC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

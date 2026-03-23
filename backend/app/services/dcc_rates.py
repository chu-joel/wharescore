# backend/app/services/dcc_rates.py
"""
Dunedin City Council ArcGIS property data client.
Uses the DCC MapServer REST API to query property valuations and rates.

Note: DCC only provides Rateable_Value (capital value) — no separate
land value or improvements value split.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

DCC_PROPERTIES_URL = (
    "https://apps.dunedin.govt.nz/arcgis/rest/services/"
    "Public/Rates/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "Assessment_Number", "Formatted_address", "Rateable_Value",
    "Total_rates", "VGNumber", "Area_Ha", "Land_Use_Descript",
    "Diff_Category",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '18 Weka Street, St Leonards, Dunedin' → "Formatted_address LIKE '18 Weka Street%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"Formatted_address LIKE '{street}%'"


async def fetch_dcc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from DCC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{DCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"DCC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No DCC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"DCC ArcGIS error for {address}: {e}")
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
            addr = (attrs.get("Formatted_address") or "").strip()
            if addr.startswith(f"{unit}/") or addr.startswith(f"{unit} "):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format DCC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("Rateable_Value"))
    total_rates = _safe_float(prop.get("Total_rates"))

    levy_breakdown = []
    if total_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Dunedin City Council Rates", "ratesAmount": total_rates}],
            "subtotal": total_rates,
        })

    return {
        "valuation_number": (prop.get("VGNumber") or "").strip() or None,
        "address": (prop.get("Formatted_address") or "").strip(),
        "legal_description": None,
        "cert_of_title": None,
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": None,
            "improvements_value": None,
            "total_rates": total_rates,
        },
        "previous_valuation": None,
        "levy_breakdown": levy_breakdown,
        "source": "dcc_arcgis",
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
        logger.warning(f"DCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

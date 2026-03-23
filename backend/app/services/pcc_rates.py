# backend/app/services/pcc_rates.py
"""
Porirua City Council ArcGIS property data client.
Uses the PCC MapServer REST API to query property valuations and rates.

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

PCC_PROPERTIES_URL = (
    "https://maps.poriruacity.govt.nz/server/rest/services/"
    "Property/PropertyAdminExternal/MapServer/5/query"
)

OUT_FIELDS = ",".join([
    "Address", "Valuation_No", "Total_Value", "Land_Value", "Imp_Value",
    "PCC_rates", "GW_rates", "Rates_Category", "TITLES", "FULL_APP",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Mungavin Avenue, Ranui Heights, Porirua' → "Address LIKE '42 Mungavin Avenue%'"
    '2/10 Doris Street, Elsdon, Porirua' → "Address LIKE '2/10 Doris Street%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"Address LIKE '{street}%'"


async def fetch_pcc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from PCC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{PCC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"PCC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No PCC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"PCC ArcGIS error for {address}: {e}")
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
            addr = (attrs.get("Address") or "").strip()
            if addr.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format PCC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("Total_Value"))
    lv = _safe_int(prop.get("Land_Value"))
    iv = _safe_int(prop.get("Imp_Value"))
    if iv is None and cv and lv:
        iv = cv - lv

    pcc_rates = _safe_float(prop.get("PCC_rates"))
    gw_rates = _safe_float(prop.get("GW_rates"))
    total_rates = None
    if pcc_rates is not None or gw_rates is not None:
        total_rates = (pcc_rates or 0) + (gw_rates or 0)

    levy_breakdown = []
    if pcc_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "Porirua City Council Rates", "ratesAmount": pcc_rates}],
            "subtotal": pcc_rates,
        })
    if gw_rates:
        levy_breakdown.append({
            "category": "Regional Rates",
            "items": [{"description": "Greater Wellington Regional Council Rates", "ratesAmount": gw_rates}],
            "subtotal": gw_rates,
        })

    return {
        "valuation_number": prop.get("Valuation_No"),
        "address": prop.get("Address"),
        "legal_description": prop.get("FULL_APP"),
        "cert_of_title": prop.get("TITLES"),
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": total_rates,
        },
        "previous_valuation": None,
        "levy_breakdown": levy_breakdown,
        "source": "pcc_arcgis",
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
        logger.warning(f"PCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

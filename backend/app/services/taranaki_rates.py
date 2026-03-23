# backend/app/services/taranaki_rates.py
"""
Taranaki (New Plymouth District) ArcGIS property data client.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

TARANAKI_PROPERTIES_URL = (
    "https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/"
    "Property_Rating/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "Assessment", "Property_Address", "Legal_Description",
    "Capital_Value", "Land_Value", "District_Rates", "Regional_Rates",
    "Total_Rates",
])


def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"Property_Address LIKE '{street}%'"


async def fetch_taranaki_rates(address: str, conn=None) -> dict | None:
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{TARANAKI_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            return None

        features = data["features"]
        prop = features[0]["attributes"]
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"Taranaki ArcGIS error for {address}: {e}")
        return None


def _format_response(prop: dict) -> dict:
    cv = _safe_int(prop.get("Capital_Value"))
    lv = _safe_int(prop.get("Land_Value"))
    iv = (cv or 0) - (lv or 0) if cv else None

    district_rates = _safe_float(prop.get("District_Rates"))
    regional_rates = _safe_float(prop.get("Regional_Rates"))
    total_rates = _safe_float(prop.get("Total_Rates"))

    levy_breakdown = []
    if district_rates:
        levy_breakdown.append({
            "category": "Council Rates",
            "items": [{"description": "New Plymouth District Council Rates", "ratesAmount": district_rates}],
            "subtotal": district_rates,
        })
    if regional_rates:
        levy_breakdown.append({
            "category": "Regional Rates",
            "items": [{"description": "Taranaki Regional Council Rates", "ratesAmount": regional_rates}],
            "subtotal": regional_rates,
        })

    return {
        "valuation_number": str(prop.get("Assessment")) if prop.get("Assessment") else None,
        "address": prop.get("Property_Address"),
        "legal_description": prop.get("Legal_Description"),
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
        "source": "taranaki_arcgis",
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
        logger.warning(f"Taranaki fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

# backend/app/services/uhcc_rates.py
"""
Upper Hutt City Council ArcGIS property data client.
Uses the UHCC rating_valuation FeatureServer on ArcGIS Online.

Fields: CapitalValue, LandValue, ImprovementsValue, ValuationLocation,
        ANNRATES, Suburb, ValuationLegalDescription
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

UHCC_URL = (
    "https://services7.arcgis.com/8G10QCd84QpdcTJ9/arcgis/rest/services/"
    "rating_valuation/FeatureServer/0/query"
)

OUT_FIELDS = ",".join([
    "ValuationLocation", "ASSESSMNT", "ValuationLegalDescription",
    "CapitalValue", "LandValue", "ImprovementsValue",
    "ANNRATES", "Suburb", "DVRCategoryDescription",
])


def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"ValuationLocation LIKE '{street}%'"


async def fetch_uhcc_rates(address: str, conn=None) -> dict | None:
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{UHCC_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            return None

        features = data["features"]
        prop = _best_match(features, address)

        cv = _safe_int(prop.get("CapitalValue"))
        lv = _safe_int(prop.get("LandValue"))
        iv = _safe_int(prop.get("ImprovementsValue"))
        rates = _safe_float(prop.get("ANNRATES"))

        levy_breakdown = []
        if rates:
            levy_breakdown.append({
                "category": "Council Rates",
                "items": [{"description": "Upper Hutt City Council Rates", "ratesAmount": rates}],
                "subtotal": rates,
            })

        return {
            "valuation_number": prop.get("ASSESSMNT"),
            "address": prop.get("ValuationLocation"),
            "legal_description": prop.get("ValuationLegalDescription"),
            "cert_of_title": None,
            "property_improvements": None,
            "current_valuation": {
                "capital_value": cv,
                "land_value": lv,
                "improvements_value": iv,
                "total_rates": rates,
            },
            "previous_valuation": None,
            "levy_breakdown": levy_breakdown,
            "source": "uhcc_arcgis",
        }
    except Exception as e:
        logger.warning(f"UHCC ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    if len(features) == 1:
        return features[0]["attributes"]
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            loc = (f["attributes"].get("ValuationLocation") or "").strip()
            if loc.startswith(f"{unit}/"):
                return f["attributes"]
    return features[0]["attributes"]


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
        logger.warning(f"UHCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

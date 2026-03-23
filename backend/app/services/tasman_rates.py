# backend/app/services/tasman_rates.py
"""
Tasman District Council ArcGIS property data client.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

TASMAN_PROPERTIES_URL = (
    "https://gispublic.tasman.govt.nz/server/rest/services/"
    "OpenData/OpenData_Property/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "ValuationAssessment", "PropertyLocation", "ValuationLegalDescription",
    "ValuationTitleReference", "CapitalValue", "LandValue", "ImprovementsValue",
    "PrimaryLandUse",
])


def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"PropertyLocation LIKE '{street}%'"


async def fetch_tasman_rates(address: str, conn=None) -> dict | None:
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{TASMAN_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            return None

        features = data["features"]
        prop = _best_match(features, address)
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"Tasman ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    if len(features) == 1:
        return features[0]["attributes"]

    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            loc = (f["attributes"].get("PropertyLocation") or "").strip()
            if loc.startswith(f"{unit}/"):
                return f["attributes"]

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    cv = _safe_int(prop.get("CapitalValue"))
    lv = _safe_int(prop.get("LandValue"))
    iv = _safe_int(prop.get("ImprovementsValue"))
    if iv is None and cv and lv:
        iv = cv - lv

    return {
        "valuation_number": prop.get("ValuationAssessment"),
        "address": prop.get("PropertyLocation"),
        "legal_description": prop.get("ValuationLegalDescription"),
        "cert_of_title": prop.get("ValuationTitleReference"),
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": None,
        },
        "previous_valuation": None,
        "levy_breakdown": [],
        "source": "tasman_arcgis",
    }


def _safe_int(v) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


async def _fetch_json(url: str, timeout: int = 8) -> dict | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"Tasman fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

# backend/app/services/kcdc_rates.py
"""
Kapiti Coast District Council ArcGIS property data client.
Uses the KCDC MapServer REST API to query property valuations.

Single-step lookup: search by address via ArcGIS query → full property data.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

KCDC_PROPERTIES_URL = (
    "https://maps.kapiticoast.govt.nz/server/rest/services/"
    "Public/Property_Public/MapServer/0/query"
)

OUT_FIELDS = ",".join([
    "Valuation_ID", "Location", "Capital_Value", "Land_Value",
    "Improvements_Value", "Legal", "Latitude", "Longitude",
])


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Rimu Road, Paraparaumu, Kapiti Coast' → "Location LIKE '42 Rimu Road%'"
    """
    parts = full_address.split(",")
    street = parts[0].strip()
    street = street.replace("'", "''")
    return f"Location LIKE '{street}%'"


async def fetch_kcdc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from KCDC ArcGIS MapServer."""
    try:
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": OUT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{KCDC_PROPERTIES_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"KCDC query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No KCDC results for: {where}")
            return None

        features = data["features"]
        prop = _best_match(features, address)

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"KCDC ArcGIS error for {address}: {e}")
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
            loc = (attrs.get("Location") or "").strip()
            if loc.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(prop: dict) -> dict:
    """Format KCDC ArcGIS data to match the common rates response format."""
    cv = _safe_int(prop.get("Capital_Value"))
    lv = _safe_int(prop.get("Land_Value"))
    iv = _safe_int(prop.get("Improvements_Value"))
    if iv is None and cv and lv:
        iv = cv - lv

    return {
        "valuation_number": prop.get("Valuation_ID"),
        "address": prop.get("Location"),
        "legal_description": prop.get("Legal"),
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
        "source": "kcdc_arcgis",
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
        logger.warning(f"KCDC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

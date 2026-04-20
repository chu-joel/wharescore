# backend/app/services/wbop_rates.py
"""
Western Bay of Plenty District Council ArcGIS property data client.
Uses the WBOPDC Property MapServer REST API to query property valuations.

Multi-step lookup:
  1. Search Parcels layer (12) by ParcelAddress → get ValuationID
  2. Convert ValuationID to ValuationNumber format (strip * and leading 0s)
  3. Query Capital Value layer (4) by ValuationNumber → CV
  4. Query Land Value layer (5) by ValuationNumber → LV
  Combine results into common format.
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

# Parcels layer. addresses, legal descriptions, ValuationID
WBOP_PARCELS_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/12/query"
)

# Capital Value layer. CV by ValuationNumber
WBOP_CV_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/4/query"
)

# Land Value layer. LV by ValuationNumber
WBOP_LV_URL = (
    "https://map.westernbay.govt.nz/arcgisext/rest/services/"
    "Property/MapServer/5/query"
)

PARCEL_FIELDS = "ParcelID,ValuationID,ParcelAddress,ValuationAddress,LegalDescription,LegalArea"
CV_FIELDS = "ValuationNumber,CapitalValue"
LV_FIELDS = "ValuationNumber,LandValue,PPH"


def _valuation_id_to_number(val_id: str) -> str:
    """Convert ValuationID format to ValuationNumber format.

    ValuationID: "06819*321*09*" → strip * → "0681932109" → strip leading 0 → "681932109"
    ValuationNumber: "681932109"
    """
    stripped = val_id.replace("*", "")
    return stripped.lstrip("0") or "0"


def _parse_currency(val: str | None) -> int | None:
    """Parse currency string like '280,000' to integer."""
    if val is None:
        return None
    try:
        return int(val.replace(",", ""))
    except (TypeError, ValueError):
        return None


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '461B Minden Road, Western Bay of Plenty' → "ParcelAddress LIKE '%461B MINDEN ROAD%'"
    WBOP stores addresses in uppercase.
    """
    parts = full_address.split(",")
    street = parts[0].strip().upper()
    street = street.replace("'", "''")
    return f"ParcelAddress LIKE '%{street}%'"


async def fetch_wbop_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from WBOPDC ArcGIS MapServer."""
    try:
        # Step 1: Search Parcels layer by address
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": PARCEL_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{WBOP_PARCELS_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"WBOP parcel query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No WBOP parcel results for: {where}")
            return None

        # Pick best match
        parcel = _best_match(data["features"], address)
        val_id = parcel.get("ValuationID")
        if not val_id:
            return None

        val_number = _valuation_id_to_number(val_id)

        # Step 2: Query Capital Value layer by ValuationNumber
        cv_params = {
            "where": f"ValuationNumber = '{val_number}'",
            "outFields": CV_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        cv_url = f"{WBOP_CV_URL}?{urllib.parse.urlencode(cv_params)}"
        logger.debug(f"WBOP CV query: {cv_url}")
        cv_data = await _fetch_json(cv_url)

        cv_attrs = {}
        if cv_data and cv_data.get("features"):
            cv_attrs = cv_data["features"][0]["attributes"]

        # Step 3: Query Land Value layer by ValuationNumber
        lv_params = {
            "where": f"ValuationNumber = '{val_number}'",
            "outFields": LV_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        lv_url = f"{WBOP_LV_URL}?{urllib.parse.urlencode(lv_params)}"
        logger.debug(f"WBOP LV query: {lv_url}")
        lv_data = await _fetch_json(lv_url)

        lv_attrs = {}
        if lv_data and lv_data.get("features"):
            lv_attrs = lv_data["features"][0]["attributes"]

        return _format_response(parcel, cv_attrs, lv_attrs, val_number)

    except Exception as e:
        logger.warning(f"WBOP ArcGIS error for {address}: {e}")
        return None


def _best_match(features: list[dict], address: str) -> dict:
    """Pick the best matching feature when multiple results are returned."""
    if len(features) == 1:
        return features[0]["attributes"]

    # Try to match unit number if present
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1).upper()
        for f in features:
            attrs = f["attributes"]
            loc = (attrs.get("ParcelAddress") or "").strip()
            if loc.startswith(f"{unit}/") or loc.startswith(f"{unit} "):
                return attrs

    return features[0]["attributes"]


def _format_response(parcel: dict, cv_attrs: dict, lv_attrs: dict, val_number: str) -> dict:
    """Format WBOP ArcGIS data to match the common rates response format."""
    cv = _parse_currency(cv_attrs.get("CapitalValue"))
    lv = _parse_currency(lv_attrs.get("LandValue"))
    vi = None
    if cv is not None and lv is not None:
        vi = cv - lv

    land_area = _safe_float(parcel.get("LegalArea"))

    return {
        "valuation_number": val_number,
        "address": parcel.get("ParcelAddress"),
        "suburb": None,
        "legal_description": parcel.get("LegalDescription"),
        "cert_of_title": None,
        "property_improvements": None,
        "land_area_ha": land_area,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": vi,
            "total_rates": None,
        },
        "previous_valuation": None,
        "value_change": {
            "capital_value_pct": None,
            "land_value_pct": None,
        },
        "levy_breakdown": [],
        "source": "wbop_arcgis",
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


async def _fetch_json(url: str, timeout: int = 10) -> dict | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"WBOP fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

# backend/app/services/tcc_rates.py
"""
Tauranga City Council ArcGIS property data client.
Uses the TCC FeatureServer REST API to query property valuations and rates.

Two-step lookup:
  1. Search Assessment layer by address → get VNZ
  2. Query Capital_Value_Total_2023 by VNZ → full valuation data
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

# Assessment layer. has LOCATIONADDRESS, SUBURB, VNZ
TCC_ASSESSMENT_URL = (
    "https://gis.tauranga.govt.nz/server/rest/services/"
    "Assessment/FeatureServer/2/query"
)

# Capital Value layer. has CV, LV, VI, AnnualRates for 2023 + 2021
TCC_VALUATION_URL = (
    "https://gis.tauranga.govt.nz/server/rest/services/"
    "Capital_Value_Total_2023/FeatureServer/10/query"
)

ASSESSMENT_FIELDS = "VNZ,LOCATIONADDRESS,SUBURB,ASSESSMENT,RatingUnitID"
VALUATION_FIELDS = (
    "VNZ,CV2023,CV2021,LV2023,LV2021,VI2023,VI2021,"
    "AnnualRates,LandArea,CapValPerc,LandValPerc"
)


def _build_search(full_address: str) -> str:
    """Build ArcGIS WHERE clause from LINZ address.
    '42 Fraser Street, Tauranga South, Tauranga' → "LOCATIONADDRESS LIKE '42 FRASER STREET%'"
    '2/10 Ninth Avenue, Tauranga' → "LOCATIONADDRESS LIKE '2/10 NINTH AVENUE%'"
    TCC stores addresses in uppercase.
    """
    parts = full_address.split(",")
    street = parts[0].strip().upper()
    street = street.replace("'", "''")
    return f"LOCATIONADDRESS LIKE '{street}%'"


async def fetch_tcc_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from TCC ArcGIS FeatureServer."""
    try:
        # Step 1: Search Assessment layer by address
        where = _build_search(address)
        params = {
            "where": where,
            "outFields": ASSESSMENT_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        url = f"{TCC_ASSESSMENT_URL}?{urllib.parse.urlencode(params)}"
        logger.debug(f"TCC assessment query: {url}")
        data = await _fetch_json(url)

        if not data or not data.get("features"):
            logger.debug(f"No TCC assessment results for: {where}")
            return None

        # Pick best match
        assessment = _best_match(data["features"], address)
        vnz = assessment.get("VNZ")
        if not vnz:
            return None

        # Step 2: Query Capital Value layer by VNZ
        val_params = {
            "where": f"VNZ = '{vnz}'",
            "outFields": VALUATION_FIELDS,
            "returnGeometry": "false",
            "f": "json",
        }
        val_url = f"{TCC_VALUATION_URL}?{urllib.parse.urlencode(val_params)}"
        logger.debug(f"TCC valuation query: {val_url}")
        val_data = await _fetch_json(val_url)

        valuation = {}
        if val_data and val_data.get("features"):
            valuation = val_data["features"][0]["attributes"]

        return _format_response(assessment, valuation)

    except Exception as e:
        logger.warning(f"TCC ArcGIS error for {address}: {e}")
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
            loc = (attrs.get("LOCATIONADDRESS") or "").strip()
            if loc.startswith(f"{unit}/"):
                return attrs

    return features[0]["attributes"]


def _format_response(assessment: dict, valuation: dict) -> dict:
    """Format TCC ArcGIS data to match the common rates response format."""
    cv = _safe_int(valuation.get("CV2023"))
    lv = _safe_int(valuation.get("LV2023"))
    vi = _safe_int(valuation.get("VI2023"))
    if vi is None and cv and lv:
        vi = cv - lv

    annual_rates = _safe_float(valuation.get("AnnualRates"))

    # Build levy breakdown. TCC doesn't split council/regional in this data
    levy_breakdown = []
    if annual_rates:
        levy_breakdown.append({
            "category": "Total Rates",
            "items": [{"description": "Tauranga City Council Annual Rates", "ratesAmount": annual_rates}],
            "subtotal": annual_rates,
        })

    # Previous valuation (2021)
    prev_cv = _safe_int(valuation.get("CV2021"))
    prev_lv = _safe_int(valuation.get("LV2021"))
    previous_valuation = None
    if prev_cv:
        prev_vi = _safe_int(valuation.get("VI2021"))
        if prev_vi is None and prev_cv and prev_lv:
            prev_vi = prev_cv - prev_lv
        previous_valuation = {
            "capital_value": prev_cv,
            "land_value": prev_lv,
            "improvements_value": prev_vi,
        }

    return {
        "valuation_number": assessment.get("VNZ"),
        "address": assessment.get("LOCATIONADDRESS"),
        "suburb": assessment.get("SUBURB"),
        "legal_description": None,
        "cert_of_title": None,
        "property_improvements": None,
        "land_area_ha": _safe_float(valuation.get("LandArea")),
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": vi,
            "total_rates": annual_rates,
        },
        "previous_valuation": previous_valuation,
        "value_change": {
            "capital_value_pct": _safe_float(valuation.get("CapValPerc")),
            "land_value_pct": _safe_float(valuation.get("LandValPerc")),
        },
        "levy_breakdown": levy_breakdown,
        "source": "tcc_arcgis",
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
        logger.warning(f"TCC fetch failed: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    resp = requests.get(
        url,
        headers={"User-Agent": "WhareScore/1.0", "Accept": "application/json"},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

# backend/app/services/hamilton_rates.py
"""
Hamilton City Council property data client.
Hamilton doesn't expose a public ArcGIS API for valuations, so this
scrapes their property search page for individual lookups.
"""
from __future__ import annotations

import asyncio
import logging
import re

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://hamilton.govt.nz/property-rates-and-building/property/property-search/"


async def fetch_hamilton_rates(address: str, conn=None) -> dict | None:
    """Fetch property data from Hamilton's property search page."""
    try:
        # First search for the address to get the property ID
        search_result = await _search_address(address)
        if not search_result:
            return None

        # Then fetch the property detail
        return await _fetch_property(search_result["property_id"])

    except Exception as e:
        logger.warning(f"Hamilton rates error for {address}: {e}")
        return None


async def _search_address(address: str) -> dict | None:
    """Search Hamilton property search by address to find property ID."""
    parts = address.split(",")
    street = parts[0].strip()

    loop = asyncio.get_running_loop()
    html = await loop.run_in_executor(None, _sync_search, street)
    if not html:
        return None

    # Look for property links in results
    matches = re.findall(r'property=(\d+)', html)
    if not matches:
        return None

    return {"property_id": int(matches[0])}


async def _fetch_property(property_id: int) -> dict | None:
    """Fetch and parse a single Hamilton property page."""
    loop = asyncio.get_running_loop()
    html = await loop.run_in_executor(None, _sync_fetch_property, property_id)
    if not html or "Capital value:" not in html:
        return None

    return _parse_property(html)


def _parse_property(html: str) -> dict | None:
    """Parse property data from Hamilton's HTML page."""
    result = {}

    # Address from h1
    m = re.search(r'<h1[^>]*>\s*(.*?)\s*</h1>', html, re.S)
    if m:
        addr = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        if addr and addr.lower() != "property search":
            result["address"] = addr

    # Extract th/td pairs
    for m in re.finditer(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', html, re.S):
        key = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        val = re.sub(r'<[^>]+>', '', m.group(2)).strip()
        if key == "Valuation number":
            result["valuation_number"] = val
        elif key == "Legal description":
            result["legal_description"] = val
        elif key == "Land Value" and "land_value" not in result:
            result["land_value"] = _parse_dollar(val)
        elif key in ("Value of Improvements", "Improvements") and "improvements_value" not in result:
            result["improvements_value"] = _parse_dollar(val)
        elif key == "Capital Value" and "capital_value" not in result:
            result["capital_value"] = _parse_dollar(val)

    # Fallback capital value
    if "capital_value" not in result:
        m = re.search(r'Capital value:\s*\$([\d,]+)', html)
        if m:
            result["capital_value"] = int(m.group(1).replace(",", ""))

    # Total annual rates
    m = re.search(r'Total annual rates:\s*\$([\d,.]+)', html)
    if m:
        result["total_rates"] = float(m.group(1).replace(",", ""))

    cv = result.get("capital_value")
    if not cv:
        return None

    lv = result.get("land_value")
    iv = result.get("improvements_value")
    if iv is None and cv and lv:
        iv = cv - lv

    return {
        "valuation_number": result.get("valuation_number"),
        "address": result.get("address"),
        "legal_description": result.get("legal_description"),
        "cert_of_title": None,
        "property_improvements": None,
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
            "total_rates": result.get("total_rates"),
        },
        "previous_valuation": None,
        "levy_breakdown": [],
        "source": "hamilton_web",
    }


def _parse_dollar(val: str) -> int | None:
    val = val.replace("$", "").replace(",", "").strip()
    if not val or val == "-":
        return None
    try:
        return int(val)
    except ValueError:
        return None


def _sync_search(street: str) -> str | None:
    try:
        resp = requests.get(
            BASE_URL,
            params={"searchby": "streetname", "keywords": street, "start": "0"},
            headers={"User-Agent": "Mozilla/5.0 (WhareScore/1.0)"},
            timeout=10,
            verify=False,
        )
        if resp.status_code == 200:
            return resp.text
    except Exception as e:
        logger.warning(f"Hamilton search failed: {e}")
    return None


def _sync_fetch_property(property_id: int) -> str | None:
    try:
        resp = requests.get(
            BASE_URL,
            params={"searchby": "streetname", "keywords": "", "property": str(property_id)},
            headers={"User-Agent": "Mozilla/5.0 (WhareScore/1.0)"},
            timeout=10,
            verify=False,
        )
        if resp.status_code == 200:
            return resp.text
    except Exception as e:
        logger.warning(f"Hamilton fetch failed: {e}")
    return None

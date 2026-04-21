# backend/app/services/wdc_whanganui_rates.py
"""
Whanganui District Council GeoServer WFS property data client.
Uses the GeoNode/GeoServer at data.whanganui.govt.nz.
Values are formatted strings like "$ 160,000.00". needs parsing.

Two-step: property_addresses (address lookup) + property_values (CV/LV/IV via prop_no join)
"""
from __future__ import annotations
import asyncio, logging, re, urllib.parse, requests

logger = logging.getLogger(__name__)

WDC_ADDR_URL = "https://data.whanganui.govt.nz/geoserver/ows"
WDC_VALUES_URL = "https://data.whanganui.govt.nz/geoserver/ows"

def _parse_currency(v) -> int | None:
    if v is None: return None
    if isinstance(v, (int, float)): return int(v)
    cleaned = str(v).replace("$", "").replace(",", "").strip()
    if not cleaned: return None
    try: return int(float(cleaned))
    except: return None

def _build_cql(full_address: str) -> str:
    # WDC GeoServer schema renamed "address" → "full_address" (discovered
    # 2026-04-21 via DescribeFeatureType; old column was causing 100% 404s).
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"full_address LIKE '{street}%'"

async def fetch_whanganui_rates(address: str, conn=None) -> dict | None:
    try:
        # Step 1: Search addresses
        params = {
            "service": "WFS", "version": "1.0.0", "request": "GetFeature",
            "typeName": "geonode:property_addresses",
            "outputFormat": "application/json",
            "CQL_FILTER": _build_cql(address),
            "maxFeatures": "5",
        }
        url = f"{WDC_ADDR_URL}?{urllib.parse.urlencode(params)}"
        addr_data = await _fetch_json(url)
        if not addr_data or not addr_data.get("features"): return None

        # Get prop_no from best address match
        feat = addr_data["features"][0]
        props = feat.get("properties", {})
        found_addr = props.get("full_address") or props.get("address") or address
        # WDC dropped the explicit prop_no join key from property_addresses.
        # Fall back to spatial BBOX intersect on property_values using a
        # ~20m tolerance around the address point. property_values also has
        # a geom column (confirmed via DescribeFeatureType 2026-04-21).
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") if geom.get("type") == "Point" else None
        if not coords:
            return None
        lon, lat = float(coords[0]), float(coords[1])
        delta = 0.0002   # ~20m
        bbox = f"{lon-delta},{lat-delta},{lon+delta},{lat+delta},EPSG:4326"
        val_params = {
            "service": "WFS", "version": "1.0.0", "request": "GetFeature",
            "typeName": "geonode:property_values",
            "outputFormat": "application/json",
            "bbox": bbox,
            "maxFeatures": "3",
        }
        val_url = f"{WDC_VALUES_URL}?{urllib.parse.urlencode(val_params)}"
        val_data = await _fetch_json(val_url)
        if not val_data or not val_data.get("features"): return None

        val_props = val_data["features"][0].get("properties", {})
        cv = _parse_currency(val_props.get("capital_value"))
        lv = _parse_currency(val_props.get("land_value"))
        iv = _parse_currency(val_props.get("improvements"))

        return {
            "valuation_number": val_props.get("assessment_no"),
            "address": found_addr,
            "legal_description": None,
            "current_valuation": {"capital_value": cv, "land_value": lv, "improvements_value": iv, "total_rates": None},
            "previous_valuation": None, "levy_breakdown": [], "source": "whanganui_wfs",
        }
    except Exception as e:
        logger.warning(f"Whanganui WFS error for {address}: {e}")
        return None

async def _fetch_json(url, timeout=15):
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: requests.get(url, headers={"User-Agent": "WhareScore/1.0"}, timeout=timeout).json())
    except Exception as e:
        logger.warning(f"Whanganui fetch failed: {e}")
        return None

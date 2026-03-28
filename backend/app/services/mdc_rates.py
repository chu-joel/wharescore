# backend/app/services/mdc_rates.py
"""
Marlborough District Council ArcGIS property data client.
Uses the MDC PropertyLandParcel MapServer.
Fields: PropertyAddress, CapitalValue, LandValue, ImprovementValue
"""
from __future__ import annotations
import asyncio, logging, re, urllib.parse, requests

logger = logging.getLogger(__name__)

MDC_URL = (
    "https://gis.marlborough.govt.nz/server/rest/services/"
    "DataPublic/PropertyLandParcel/MapServer/0/query"
)
OUT_FIELDS = "PropertyAddress,CapitalValue,LandValue,ImprovementValue,LandArea,LegalDescription,assessment_no"

def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"PropertyAddress LIKE '{street}%'"

async def fetch_mdc_rates(address: str, conn=None) -> dict | None:
    try:
        params = {"where": _build_search(address), "outFields": OUT_FIELDS, "returnGeometry": "false", "f": "json"}
        url = f"{MDC_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)
        if not data or not data.get("features"): return None
        prop = _best_match(data["features"], address)
        cv = _safe_int(prop.get("CapitalValue"))
        lv = _safe_int(prop.get("LandValue"))
        iv = _safe_int(prop.get("ImprovementValue"))
        return {
            "valuation_number": prop.get("assessment_no"),
            "address": prop.get("PropertyAddress"),
            "legal_description": prop.get("LegalDescription"),
            "current_valuation": {"capital_value": cv, "land_value": lv, "improvements_value": iv, "total_rates": None},
            "previous_valuation": None, "levy_breakdown": [], "source": "mdc_arcgis",
        }
    except Exception as e:
        logger.warning(f"MDC ArcGIS error for {address}: {e}")
        return None

def _best_match(features, address):
    if len(features) == 1: return features[0]["attributes"]
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            loc = (f["attributes"].get("PropertyAddress") or "").strip()
            if loc.startswith(f"{unit}/") or loc.startswith(f"{unit} /"):
                return f["attributes"]
    return features[0]["attributes"]

def _safe_int(v):
    if v is None: return None
    try: return int(v)
    except: return None

async def _fetch_json(url, timeout=10):
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: requests.get(url, headers={"User-Agent": "WhareScore/1.0"}, timeout=timeout).json())
    except Exception as e:
        logger.warning(f"MDC fetch failed: {e}")
        return None

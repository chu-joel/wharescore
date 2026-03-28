# backend/app/services/timaru_rates.py
"""
Timaru District Council ArcGIS property data client.
Uses the TDC Rating_Units MapServer.
Fields: StreetAddress, CapitalValue, LandValue, ImprovementsValue, ValuationNo
"""
from __future__ import annotations
import asyncio, logging, re, urllib.parse, requests

logger = logging.getLogger(__name__)

TIMARU_URL = (
    "https://maps.timaru.govt.nz/server/rest/services/"
    "Vector/Rating_Units/MapServer/0/query"
)
OUT_FIELDS = "StreetAddress,CapitalValue,LandValue,ImprovementsValue,ValuationNo,LegalDescription,LocalityName,LandUse"

def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"StreetAddress LIKE '{street}%'"

async def fetch_timaru_rates(address: str, conn=None) -> dict | None:
    try:
        params = {"where": _build_search(address), "outFields": OUT_FIELDS, "returnGeometry": "false", "f": "json"}
        url = f"{TIMARU_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)
        if not data or not data.get("features"): return None
        prop = _best_match(data["features"], address)
        cv = _safe_int(prop.get("CapitalValue"))
        lv = _safe_int(prop.get("LandValue"))
        iv = _safe_int(prop.get("ImprovementsValue"))
        return {
            "valuation_number": prop.get("ValuationNo"),
            "address": prop.get("StreetAddress"),
            "legal_description": prop.get("LegalDescription"),
            "current_valuation": {"capital_value": cv, "land_value": lv, "improvements_value": iv, "total_rates": None},
            "previous_valuation": None, "levy_breakdown": [], "source": "timaru_arcgis",
        }
    except Exception as e:
        logger.warning(f"Timaru ArcGIS error for {address}: {e}")
        return None

def _best_match(features, address):
    if len(features) == 1: return features[0]["attributes"]
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            loc = (f["attributes"].get("StreetAddress") or "").strip()
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
        logger.warning(f"Timaru fetch failed: {e}")
        return None

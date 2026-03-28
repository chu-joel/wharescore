# backend/app/services/rlc_rates.py
"""
Rotorua Lakes Council ArcGIS property data client.
Uses the RDC_Valuations_Snapshot FeatureServer (tabular, no geometry).
Values are formatted strings like "$430,000" — needs parsing.
Fields: Location, CapitalValue, LandValue, ImprovementsValue, TotalRatesThisYear
"""
from __future__ import annotations
import asyncio, logging, re, urllib.parse, requests

logger = logging.getLogger(__name__)

RLC_URL = (
    "https://services8.arcgis.com/rH83DoI7Xdq2nG28/arcgis/rest/services/"
    "RDC_Valuations_Snapshot/FeatureServer/0/query"
)
OUT_FIELDS = "Location,CapitalValue,LandValue,ImprovementsValue,Valuation,LegalDescription,Hectares,TotalRatesThisYear,ValuationDate"

def _parse_currency(v) -> int | None:
    if v is None: return None
    if isinstance(v, (int, float)): return int(v)
    cleaned = str(v).replace("$", "").replace(",", "").strip()
    if not cleaned: return None
    try: return int(float(cleaned))
    except: return None

def _build_search(full_address: str) -> str:
    parts = full_address.split(",")
    street = parts[0].strip().replace("'", "''")
    return f"Location LIKE '{street}%'"

async def fetch_rlc_rates(address: str, conn=None) -> dict | None:
    try:
        params = {"where": _build_search(address), "outFields": OUT_FIELDS, "returnGeometry": "false", "f": "json"}
        url = f"{RLC_URL}?{urllib.parse.urlencode(params)}"
        data = await _fetch_json(url)
        if not data or not data.get("features"): return None
        prop = _best_match(data["features"], address)
        cv = _parse_currency(prop.get("CapitalValue"))
        lv = _parse_currency(prop.get("LandValue"))
        iv = _parse_currency(prop.get("ImprovementsValue"))
        rates = _parse_currency(prop.get("TotalRatesThisYear"))
        levy = []
        if rates:
            levy.append({"category": "Council Rates", "items": [{"description": "Rotorua Lakes Council Rates", "ratesAmount": float(rates)}], "subtotal": float(rates)})
        return {
            "valuation_number": str(prop.get("Valuation", "")),
            "address": prop.get("Location"),
            "legal_description": prop.get("LegalDescription"),
            "current_valuation": {"capital_value": cv, "land_value": lv, "improvements_value": iv, "total_rates": float(rates) if rates else None},
            "previous_valuation": None, "levy_breakdown": levy, "source": "rlc_arcgis",
        }
    except Exception as e:
        logger.warning(f"RLC ArcGIS error for {address}: {e}")
        return None

def _best_match(features, address):
    if len(features) == 1: return features[0]["attributes"]
    unit_match = re.match(r"^(\d+[A-Za-z]?)/", address)
    if unit_match:
        unit = unit_match.group(1)
        for f in features:
            loc = (f["attributes"].get("Location") or "").strip()
            if loc.startswith(f"{unit}/"):
                return f["attributes"]
    return features[0]["attributes"]

async def _fetch_json(url, timeout=10):
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: requests.get(url, headers={"User-Agent": "WhareScore/1.0"}, timeout=timeout).json())
    except Exception as e:
        logger.warning(f"RLC fetch failed: {e}")
        return None

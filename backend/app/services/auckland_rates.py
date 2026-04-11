# backend/app/services/auckland_rates.py
"""
Auckland Council Property API client.
Uses the experience.aucklandcouncil.govt.nz Next.js API endpoints.

Two-step lookup:
1. Search by address -> get rateAccountKey
2. Fetch rate-assessment by rateAccountKey -> full property + valuation data

Results are cached in auckland_rates_cache table.
Always hits the API for fresh data, updates cache if different.
Falls back to cache if API is unavailable.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

AC_API_BASE = "https://experience.aucklandcouncil.govt.nz/nextapi"
AC_SEARCH_URL = f"{AC_API_BASE}/property"
AC_RATES_URL = f"{AC_API_BASE}/property/{{key}}/rate-assessment"

# Auckland suburb tokens that appear in result addresses. If the SEARCH address
# contains one of these but the RESULT address contains a DIFFERENT one from the
# set, the result is a hard mismatch (e.g. Queen Street Pukekohe vs Auckland Central).
_SUBURB_TOKENS = {
    "auckland central", "ponsonby", "grey lynn", "mount eden", "parnell", "newmarket",
    "remuera", "epsom", "ellerslie", "onehunga", "penrose", "mt wellington",
    "glen innes", "panmure", "pakuranga", "howick", "east tamaki", "botany",
    "manurewa", "papakura", "pukekohe", "waiuku", "tuakau", "papatoetoe",
    "otahuhu", "mangere", "otara", "avondale", "new lynn", "henderson",
    "titirangi", "mount roskill", "royal oak", "one tree hill", "orakei",
    "mission bay", "st heliers", "kohimarama", "devonport", "takapuna",
    "milford", "browns bay", "albany", "silverdale", "orewa", "warkworth",
    "waiheke", "waitakere", "massey", "hobsonville", "whenuapai",
}


def _extract_suburb_tokens(addr: str) -> set[str]:
    """Return the set of known Auckland suburb phrases found in an address string."""
    lower = addr.lower()
    return {tok for tok in _SUBURB_TOKENS if tok in lower}


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _best_match(
    items: list[dict],
    search_addr: str,
    ref_lat: float | None = None,
    ref_lng: float | None = None,
) -> str | None:
    """Pick the best matching rateAccountKey from Auckland Council API results.

    Rules (in priority order):
    1. Reject any result whose suburb is a KNOWN DIFFERENT Auckland suburb from the
       one in the search address. This prevents "1 Queen Street Auckland Central"
       matching "1 Queen Street Pukekohe".
    2. If we have reference coordinates and the result has x/y, prefer the result
       closest to the reference point. A distance > 2 km is a hard reject.
    3. Fall back to word-overlap score against the search address.
    """
    if not items:
        return None

    search_lower = search_addr.lower()
    search_words = set(search_lower.split())
    search_suburbs = _extract_suburb_tokens(search_lower)

    # Pass 1: filter out cross-suburb mismatches
    filtered: list[dict] = []
    for item in items:
        addr = (item.get("address") or item.get("name") or "").lower()
        item_suburbs = _extract_suburb_tokens(addr)
        if search_suburbs and item_suburbs and not (search_suburbs & item_suburbs):
            # Different suburb → hard reject
            logger.debug(
                f"Rejecting AC result (suburb mismatch): search={search_suburbs} item={item_suburbs}"
            )
            continue
        filtered.append(item)
    candidates = filtered or items  # fall back to all if filter emptied the list

    # Pass 2: distance sort if we have a reference point
    if ref_lat is not None and ref_lng is not None:
        scored: list[tuple[float, dict]] = []
        for item in candidates:
            ix, iy = item.get("x"), item.get("y")
            if ix is None or iy is None:
                scored.append((float("inf"), item))
                continue
            try:
                d = _haversine_m(ref_lat, ref_lng, float(iy), float(ix))
            except (TypeError, ValueError):
                d = float("inf")
            scored.append((d, item))
        scored.sort(key=lambda t: t[0])
        if scored and scored[0][0] <= 2000:  # 2 km hard ceiling
            return scored[0][1].get("id")
        # If the nearest match is > 2 km, this isn't the right property
        if scored and scored[0][0] != float("inf"):
            logger.debug(f"AC nearest result is {scored[0][0]:.0f}m away — rejecting")
            return None

    # Pass 3: word-overlap fallback
    best_key = None
    best_score = -1
    for item in candidates:
        addr = (item.get("address") or item.get("name") or "").lower()
        addr_words = set(addr.replace(",", " ").split())
        score = len(search_words & addr_words)
        if score > best_score:
            best_score = score
            best_key = item.get("id")
    return best_key


def _simplify_address(full_address: str) -> str:
    """Simplify LINZ full_address for Auckland Council API search.
    '1/63 Landscape Road, Mount Eden, Auckland' -> '1/63 Landscape Road Mount Eden'
    """
    parts = full_address.split(",")
    # Take first two parts (street + suburb), drop city
    if len(parts) >= 2:
        return f"{parts[0].strip()} {parts[1].strip()}"
    return parts[0].strip()


async def fetch_auckland_rates(address: str, conn) -> dict | None:
    """Fetch property data from Auckland Council API.
    Always tries live API first, updates cache, falls back to cache on failure."""
    try:
        # 1. Search by address to get rateAccountKey
        search_addr = _simplify_address(address)
        search_url = f"{AC_SEARCH_URL}?query={urllib.parse.quote(search_addr)}&pageSize=5"
        logger.debug(f"Auckland search: {search_url}")
        search_data = await _fetch_json(search_url)

        if not search_data or not search_data.get("items"):
            logger.debug(f"No Auckland search results for: {search_addr}")
            # Fall back to cache
            return await _get_cached(address, conn) if conn else None

        # Look up the requested address's coordinates so _best_match can reject
        # results that are far away (e.g. "1 Queen Street Pukekohe" when the user
        # asked for "1 Queen Street Auckland Central").
        ref_lat, ref_lng = None, None
        if conn:
            try:
                cur = await conn.execute(
                    "SELECT ST_Y(geom) AS lat, ST_X(geom) AS lng FROM addresses "
                    "WHERE full_address = %s LIMIT 1",
                    [address],
                )
                row = cur.fetchone()
                if row and row.get("lat") is not None and row.get("lng") is not None:
                    ref_lat, ref_lng = float(row["lat"]), float(row["lng"])
            except Exception as e:
                logger.debug(f"AC rates ref coord lookup failed: {e}")

        # Find best match — verify suburb/street + distance align with search to
        # avoid "1 Queen Street Auckland Central" matching "1 Queen Street Pukekohe"
        items = search_data["items"]
        rate_key = _best_match(items, search_addr, ref_lat, ref_lng)
        if not rate_key:
            return await _get_cached(address, conn) if conn else None

        # 2. Fetch full rate assessment
        rates_url = AC_RATES_URL.replace("{key}", rate_key)
        logger.debug(f"Auckland rates lookup: {rates_url}")
        prop = await _fetch_json(rates_url)

        if not prop or not prop.get("capitalValue"):
            return await _get_cached(address, conn) if conn else None

        # 3. Cache the result
        if conn:
            await _upsert_cache(prop, conn)

        # 4. Format and return
        return _format_response(prop)

    except Exception as e:
        logger.warning(f"Auckland Council API error for {address}: {e}")
        return await _get_cached(address, conn) if conn else None


async def _upsert_cache(prop: dict, conn) -> None:
    """Upsert Auckland Council property data into cache."""
    try:
        await conn.execute(
            """
            INSERT INTO auckland_rates_cache (
                rate_account_key, valuation_number, address,
                street_number, street_name, suburb, city,
                legal_description, record_of_title,
                property_category, land_use, local_board,
                total_floor_area_sqm, building_coverage_pct,
                capital_value, land_value, improvements_value,
                total_rates, rate_breakdown,
                x_coord, y_coord,
                fetched_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, NOW(), NOW()
            )
            ON CONFLICT (rate_account_key) DO UPDATE SET
                capital_value = EXCLUDED.capital_value,
                land_value = EXCLUDED.land_value,
                improvements_value = EXCLUDED.improvements_value,
                total_rates = EXCLUDED.total_rates,
                rate_breakdown = EXCLUDED.rate_breakdown,
                total_floor_area_sqm = EXCLUDED.total_floor_area_sqm,
                legal_description = EXCLUDED.legal_description,
                record_of_title = EXCLUDED.record_of_title,
                updated_at = NOW()
            """,
            [
                prop.get("rateAccountKey"),
                prop.get("valuationNumber"),
                prop.get("address"),
                prop.get("streetNumber"),
                prop.get("streetName"),
                prop.get("suburbName"),
                prop.get("city"),
                prop.get("legalDescription"),
                prop.get("recordOfTitle"),
                prop.get("propertyCategory"),
                prop.get("landUseDescription"),
                prop.get("localBoard"),
                _safe_float(prop.get("totalFloorArea")),
                _safe_float(prop.get("buildingSiteCoverage")),
                _safe_int(prop.get("capitalValue")),
                _safe_int(prop.get("landValue")),
                _safe_int(prop.get("valueOfImprovements")),
                _safe_float(prop.get("totalRates")),
                json.dumps(prop.get("rateBreakdown", [])),
                _safe_float(prop.get("x")),
                _safe_float(prop.get("y")),
            ],
        )
    except Exception as e:
        logger.warning(f"Auckland cache upsert failed: {e}")


async def _get_cached(address: str, conn) -> dict | None:
    """Fall back to cached data if API is unavailable."""
    if not conn:
        return None
    try:
        # Try exact match first, then fuzzy
        search = _simplify_address(address).lower()
        cur = await conn.execute(
            """
            SELECT * FROM auckland_rates_cache
            WHERE lower(address) LIKE %s
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [f"%{search}%"],
        )
        r = cur.fetchone()
        if not r:
            return None

        return {
            "valuation_number": r["valuation_number"],
            "rate_account_key": r["rate_account_key"],
            "address": r["address"],
            "legal_description": r["legal_description"],
            "record_of_title": r["record_of_title"],
            "property_category": r["property_category"],
            "land_use": r["land_use"],
            "local_board": r["local_board"],
            "total_floor_area_sqm": float(r["total_floor_area_sqm"]) if r.get("total_floor_area_sqm") else None,
            "building_site_coverage_pct": float(r["building_coverage_pct"]) if r.get("building_coverage_pct") else None,
            "current_valuation": {
                "capital_value": r["capital_value"],
                "land_value": r["land_value"],
                "improvements_value": r["improvements_value"],
            },
            "total_rates": float(r["total_rates"]) if r.get("total_rates") else None,
            "rate_breakdown": r.get("rate_breakdown") or [],
            "source": "auckland_cache",
        }
    except Exception as e:
        logger.warning(f"Auckland cache lookup failed: {e}")
        return None


def _format_response(prop: dict) -> dict:
    """Format Auckland Council API data."""
    cv = _safe_int(prop.get("capitalValue"))
    lv = _safe_int(prop.get("landValue"))
    iv = _safe_int(prop.get("valueOfImprovements"))

    rate_breakdown = []
    for r in prop.get("rateBreakdown", []):
        rate_breakdown.append({
            "name": r.get("rateName"),
            "type": r.get("rateType"),
            "amount": _safe_float(r.get("totalRate")),
            "description": r.get("rateTypeDescription"),
        })

    return {
        "valuation_number": prop.get("valuationNumber"),
        "rate_account_key": prop.get("rateAccountKey"),
        "address": prop.get("address"),
        "legal_description": prop.get("legalDescription"),
        "record_of_title": prop.get("recordOfTitle"),
        "property_category": prop.get("propertyCategory"),
        "land_use": prop.get("landUseDescription"),
        "local_board": prop.get("localBoard"),
        "total_floor_area_sqm": _safe_float(prop.get("totalFloorArea")),
        "building_site_coverage_pct": _safe_float(prop.get("buildingSiteCoverage")),
        "current_valuation": {
            "capital_value": cv,
            "land_value": lv,
            "improvements_value": iv,
        },
        "total_rates": _safe_float(prop.get("totalRates")),
        "rate_breakdown": rate_breakdown,
        "source": "auckland_council_api",
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


async def _fetch_json(url: str, timeout: int = 8) -> dict | None:
    """Fetch JSON from URL with timeout."""
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"Auckland API fetch failed for {url}: {e}")
        return None


def _sync_fetch(url: str, timeout: int) -> dict:
    """Synchronous HTTP fetch (run in thread pool)."""
    resp = requests.get(
        url,
        headers={
            "User-Agent": "WhareScore/1.0",
            "Accept": "application/json",
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()

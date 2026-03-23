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
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

AC_API_BASE = "https://experience.aucklandcouncil.govt.nz/nextapi"
AC_SEARCH_URL = f"{AC_API_BASE}/property"
AC_RATES_URL = f"{AC_API_BASE}/property/{{key}}/rate-assessment"


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

        # Find best match
        items = search_data["items"]
        rate_key = items[0].get("id")
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

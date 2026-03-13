# backend/app/services/rates.py
"""
WCC Property Search API client.
Always calls the live API for fresh data, upserts into wcc_rates_cache.
Falls back to cached data if API is unavailable.
"""
from __future__ import annotations

import asyncio
import json
import logging
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

WCC_BASE = "https://services.wellington.govt.nz/property-search"
WCC_SEARCH_URL = f"{WCC_BASE}/api/property-info/address-search"
WCC_ACCOUNT_URL = f"{WCC_BASE}/api/property-info/account-search"


def _simplify_address(full_address: str) -> str:
    """Simplify LINZ full_address for WCC API search.
    '1/136 Karori Road, Karori, Wellington' → '136 Karori Road'
    '42 Vivian Street, Te Aro, Wellington' → '42 Vivian Street'
    """
    import re
    # Remove city (last part after comma)
    parts = full_address.split(",")
    street = parts[0].strip()
    # Strip unit prefix like '1/' or '2A/'
    street = re.sub(r"^\d+[A-Za-z]?/", "", street)
    return street.strip()


async def fetch_wcc_rates(address: str, conn) -> dict | None:
    """Fetch rates from WCC API, upsert into cache, return formatted data.
    On API failure, falls back to cached data."""
    try:
        # 1. Search by address to get account number
        search_addr = _simplify_address(address)
        search_url = f"{WCC_SEARCH_URL}?address={urllib.parse.quote(search_addr)}&page=1&pageSize=3"
        logger.debug(f"WCC search: {search_url}")
        search_data = await _fetch_json(search_url)
        logger.debug(f"WCC search results: {len(search_data.get('results', []))} hits")

        if not search_data or not search_data.get("results"):
            logger.debug("No WCC search results, falling back to cache")
            return await _get_cached(address, conn)

        # Prefer "Current" rated result over non-rated parent lots
        results = search_data["results"]
        result = next(
            (r for r in results if r.get("rateValidity") == "Current"),
            results[0],
        )
        account = result.get("rateAccountNumber")

        # 2. Get full property data by account number
        account_url = f"{WCC_ACCOUNT_URL}?account={account}"
        logger.debug(f"WCC account lookup: {account_url}")
        account_data = await _fetch_json(account_url)
        logger.debug(f"WCC account result: {bool(account_data)}")

        if not account_data or not account_data.get("results"):
            return await _get_cached(address, conn)

        prop = account_data["results"][0]

        # 3. Extract current valuation
        current_val = next(
            (v for v in prop.get("valuations", []) if v.get("periodStatus") == "C"),
            prop.get("valuations", [{}])[0] if prop.get("valuations") else {},
        )

        # 4. Upsert into cache
        await conn.execute(
            """
            INSERT INTO wcc_rates_cache (
                valuation_number, rate_account_number, address, identifier,
                rating_category, billing_code, legal_description, valued_land_area,
                has_water_meter, capital_value, land_value, improvements_value,
                valuation_date, total_rates, rates_period, valuations, levies, fetched_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s::date, %s, %s, %s::jsonb, %s::jsonb, NOW()
            )
            ON CONFLICT (valuation_number) DO UPDATE SET
                rate_account_number = EXCLUDED.rate_account_number,
                address = EXCLUDED.address,
                capital_value = EXCLUDED.capital_value,
                land_value = EXCLUDED.land_value,
                improvements_value = EXCLUDED.improvements_value,
                valuation_date = EXCLUDED.valuation_date,
                total_rates = EXCLUDED.total_rates,
                rates_period = EXCLUDED.rates_period,
                valuations = EXCLUDED.valuations,
                levies = EXCLUDED.levies,
                fetched_at = NOW()
            """,
            [
                prop.get("valuationNumber"),
                prop.get("rateAccountNumber"),
                prop.get("address"),
                prop.get("identifier"),
                prop.get("ratingCategory"),
                prop.get("billingCode"),
                prop.get("legalDescription"),
                prop.get("valuedLandArea"),
                prop.get("hasWaterMeter", False),
                current_val.get("capitalValue"),
                current_val.get("landValue"),
                (current_val.get("capitalValue", 0) or 0) - (current_val.get("landValue", 0) or 0),
                current_val.get("valuationDate"),
                current_val.get("ratesAmount"),
                current_val.get("period"),
                json.dumps(prop.get("valuations", [])),
                json.dumps(prop.get("levies", [])),
            ],
        )
        await conn.commit()

        return _format_response(prop)

    except Exception as e:
        logger.warning(f"WCC API error for {address}: {e}")
        return await _get_cached(address, conn)


def _format_response(prop: dict) -> dict:
    """Format WCC API data for the frontend."""
    current_val = next(
        (v for v in prop.get("valuations", []) if v.get("periodStatus") == "C"),
        prop.get("valuations", [{}])[0] if prop.get("valuations") else {},
    )
    prev_val = next(
        (v for v in prop.get("valuations", []) if v.get("periodStatus") == "P"),
        None,
    )

    # Group levies by category
    levies_by_category = {}
    for levy in prop.get("levies", []):
        cat = levy.get("category", "Other")
        if cat not in levies_by_category:
            levies_by_category[cat] = {"category": cat, "items": [], "subtotal": 0}
        levies_by_category[cat]["items"].append(levy)
        levies_by_category[cat]["subtotal"] += levy.get("ratesAmount", 0)

    return {
        "valuation_number": prop.get("valuationNumber"),
        "address": prop.get("address"),
        "rating_category": prop.get("ratingCategory"),
        "billing_code": prop.get("billingCode"),
        "legal_description": prop.get("legalDescription"),
        "land_area_m2": prop.get("valuedLandArea"),
        "has_water_meter": prop.get("hasWaterMeter"),
        "current_valuation": {
            "capital_value": current_val.get("capitalValue"),
            "land_value": current_val.get("landValue"),
            "improvements_value": (current_val.get("capitalValue", 0) or 0)
            - (current_val.get("landValue", 0) or 0),
            "valuation_date": current_val.get("valuationDate"),
            "total_rates": current_val.get("ratesAmount"),
            "period": current_val.get("header"),
        },
        "previous_valuation": {
            "capital_value": prev_val.get("capitalValue"),
            "land_value": prev_val.get("landValue"),
            "total_rates": prev_val.get("ratesAmount"),
            "valuation_date": prev_val.get("valuationDate"),
            "period": prev_val.get("header"),
        }
        if prev_val
        else None,
        "levy_breakdown": list(levies_by_category.values()),
        "source": "wcc_live",
    }


async def _fetch_json(url: str, timeout: int = 5) -> dict | None:
    """Fetch JSON from URL with timeout. Returns None on failure."""
    try:
        return await asyncio.to_thread(_sync_fetch, url, timeout)
    except Exception as e:
        logger.warning(f"HTTP fetch failed for {url}: {e}")
        return None


class _RedirectHandler(urllib.request.HTTPRedirectHandler):
    """Handle 308 Permanent Redirect (not handled by default in older Python)."""
    http_error_308 = urllib.request.HTTPRedirectHandler.http_error_302


def _sync_fetch(url: str, timeout: int) -> dict:
    """Synchronous HTTP fetch (run in thread pool)."""
    opener = urllib.request.build_opener(_RedirectHandler)
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    resp = opener.open(req, timeout=timeout)
    return json.loads(resp.read())


async def _get_cached(address: str, conn) -> dict | None:
    """Fall back to cached data if WCC API is unavailable."""
    cur = await conn.execute(
        """
        SELECT capital_value, land_value, improvements_value, total_rates,
               rates_period, valuation_date, address, rating_category,
               billing_code, legal_description, valued_land_area,
               has_water_meter, valuations, levies
        FROM wcc_rates_cache WHERE lower(address) LIKE %s LIMIT 1
        """,
        [f"%{address.lower()}%"],
    )
    r = cur.fetchone()
    if not r:
        return None

    return {
        "valuation_number": None,
        "address": r.get("address"),
        "rating_category": r.get("rating_category"),
        "billing_code": r.get("billing_code"),
        "legal_description": r.get("legal_description"),
        "land_area_m2": r.get("valued_land_area"),
        "has_water_meter": r.get("has_water_meter"),
        "current_valuation": {
            "capital_value": r.get("capital_value"),
            "land_value": r.get("land_value"),
            "improvements_value": r.get("improvements_value"),
            "valuation_date": str(r["valuation_date"]) if r.get("valuation_date") else None,
            "total_rates": float(r["total_rates"]) if r.get("total_rates") else None,
            "period": r.get("rates_period"),
        },
        "previous_valuation": None,
        "levy_breakdown": r.get("levies") if isinstance(r.get("levies"), list) else [],
        "source": "cache",
    }

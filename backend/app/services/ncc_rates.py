# backend/app/services/ncc_rates.py
"""
Nelson City Council property data client.
Uses the MagiqCloud rates portal at online.nelson.magiqcloud.com.

Two-step lookup:
  1. Search by address → get valuation number
  2. Fetch property detail page → extract CV, LV, IV, rates
"""
from __future__ import annotations

import asyncio
import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

NCC_SEARCH_URL = "https://online.nelson.magiqcloud.com/rates/properties/search"
NCC_DETAIL_URL = "https://online.nelson.magiqcloud.com/rates/properties"


def _extract_street(full_address: str) -> tuple[str, str]:
    """Extract street number and name from full address."""
    parts = full_address.split(",")
    street = parts[0].strip()
    # Handle unit: "2/10 Main Street" → number="10", street="Main Street"
    unit_match = re.match(r"^(\d+[A-Za-z]?)/(\d+)\s+(.+)$", street)
    if unit_match:
        return unit_match.group(2), unit_match.group(3)
    # Normal: "10 Main Street"
    num_match = re.match(r"^(\d+[A-Za-z]?)\s+(.+)$", street)
    if num_match:
        return num_match.group(1), num_match.group(2)
    return "", street


async def fetch_ncc_rates(address: str, conn=None) -> dict | None:
    try:
        number, street = _extract_street(address)
        # Step 1: Search
        params = {
            "streetNumber": number,
            "streetName": street,
        }
        search_url = f"{NCC_SEARCH_URL}?{urllib.parse.urlencode(params)}"
        html = await _fetch_html(search_url)
        if not html:
            return None

        # Extract valuation IDs from search results
        # Pattern: /rates/properties/1975028125
        val_ids = re.findall(r'/rates/properties/(\d+)', html)
        if not val_ids:
            logger.debug(f"No NCC results for: {number} {street}")
            return None

        # Step 2: Fetch detail page
        detail_url = f"{NCC_DETAIL_URL}/{val_ids[0]}"
        detail_html = await _fetch_html(detail_url)
        if not detail_html:
            return None

        # Parse valuation data from detail page
        cv = _extract_value(detail_html, r'Capital\s*Value.*?[\$]?([\d,]+)')
        lv = _extract_value(detail_html, r'Land\s*Value.*?[\$]?([\d,]+)')
        iv = _extract_value(detail_html, r'Improvements?\s*Value.*?[\$]?([\d,]+)')
        rates = _extract_value(detail_html, r'Annual\s*Rates.*?[\$]?([\d,.]+)')

        # If no improvements value, calculate from CV - LV
        if iv is None and cv and lv:
            iv = cv - lv

        if not cv:
            return None

        addr_match = re.search(r'<h[12][^>]*>([^<]+)</h', detail_html)
        found_addr = addr_match.group(1).strip() if addr_match else address

        levy_breakdown = []
        if rates:
            levy_breakdown.append({
                "category": "Council Rates",
                "items": [{"description": "Nelson City Council Rates", "ratesAmount": rates}],
                "subtotal": rates,
            })

        return {
            "valuation_number": val_ids[0],
            "address": found_addr,
            "legal_description": None,
            "cert_of_title": None,
            "property_improvements": None,
            "current_valuation": {
                "capital_value": int(cv) if cv else None,
                "land_value": int(lv) if lv else None,
                "improvements_value": int(iv) if iv else None,
                "total_rates": float(rates) if rates else None,
            },
            "previous_valuation": None,
            "levy_breakdown": levy_breakdown,
            "source": "ncc_magiqcloud",
        }
    except Exception as e:
        logger.warning(f"NCC MagiqCloud error for {address}: {e}")
        return None


def _extract_value(html: str, pattern: str) -> float | None:
    """Extract a numeric value from HTML using regex."""
    match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    if match:
        try:
            cleaned = match.group(1).replace(",", "")
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    return None


async def _fetch_html(url: str, timeout: int = 10) -> str | None:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _sync_fetch_html, url, timeout)
    except Exception as e:
        logger.warning(f"NCC fetch failed: {e}")
        return None


def _sync_fetch_html(url: str, timeout: int) -> str:
    resp = requests.get(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; WhareScore/1.0)",
            "Accept": "text/html",
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.text

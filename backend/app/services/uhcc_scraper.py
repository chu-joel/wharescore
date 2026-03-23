# backend/app/services/uhcc_scraper.py
"""
Upper Hutt City Council property scraper.
Fetches valuations + rates from the Magiq Cloud HTML portal.

Strategy:
1. Enumerate valuation IDs via prefix search (7-digit, deepening to 8 if truncated)
2. Fetch each detail page and parse CV/LV/IV/rates/address from HTML
3. Insert into council_valuations

~10-12K properties, takes ~60-90 minutes due to per-page HTML fetching.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Callable

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://online.uhcc.magiqcloud.com/rates/properties"
SESSION_HEADERS = {"User-Agent": "WhareScore/1.0"}
PAGE_LIMIT = 20  # Magiq returns max 20 per search


def scrape_all_properties(
    on_progress: Callable[[str], None] | None = None,
) -> list[dict]:
    """Scrape all Upper Hutt properties. Returns list of parsed property dicts."""
    log = on_progress or (lambda msg: logger.info(msg))

    # Phase 1: Discover all valuation IDs
    log("Phase 1: Discovering valuation IDs...")
    val_ids = _discover_valuation_ids(log)
    log(f"Found {len(val_ids)} unique valuation IDs")

    # Phase 2: Fetch detail pages
    log("Phase 2: Fetching property details...")
    properties = []
    session = requests.Session()
    session.headers.update(SESSION_HEADERS)

    for i, vid in enumerate(val_ids):
        try:
            prop = _fetch_detail(session, vid)
            if prop and prop.get("capital_value"):
                properties.append(prop)
        except Exception as e:
            logger.debug(f"Error fetching {vid}: {e}")

        if (i + 1) % 200 == 0:
            log(f"  [{i+1}/{len(val_ids)}] {len(properties)} properties parsed")
            time.sleep(0.1)  # brief pause every 200

    log(f"Scraped {len(properties)} properties with CV data")
    return properties


def _discover_valuation_ids(log: Callable) -> list[str]:
    """Find all valuation IDs by searching with progressively longer prefixes."""
    session = requests.Session()
    session.headers.update(SESSION_HEADERS)

    # Known active 4-digit prefixes for Upper Hutt
    # (1518-1599 range, discovered empirically)
    all_ids: set[str] = set()

    active_prefixes = []
    for p in range(1518, 1600):
        ids = _search_by_prefix(session, str(p))
        if ids:
            active_prefixes.append(p)
            if len(ids) < PAGE_LIMIT:
                all_ids.update(ids)

    log(f"  Active 4-digit prefixes: {len(active_prefixes)}")

    # For prefixes that returned PAGE_LIMIT results, go deeper
    for p4 in active_prefixes:
        test_ids = _search_by_prefix(session, str(p4))
        if len(test_ids) >= PAGE_LIMIT:
            # Need 7-digit prefixes (p4 + 0xx)
            for sub in range(0, 100):
                prefix7 = f"{p4}0{sub:02d}"
                ids = _search_by_prefix(session, prefix7)
                if ids:
                    if len(ids) >= PAGE_LIMIT:
                        # Go even deeper: 8-digit
                        for sub2 in range(0, 10):
                            prefix8 = f"{prefix7}{sub2}"
                            ids8 = _search_by_prefix(session, prefix8)
                            all_ids.update(ids8)
                    else:
                        all_ids.update(ids)

    return sorted(all_ids)


def _search_by_prefix(session: requests.Session, prefix: str) -> list[str]:
    """Search Magiq portal by valuation ID prefix. Returns list of valuation IDs."""
    try:
        resp = session.get(
            BASE_URL,
            params={"valuation_id": prefix},
            timeout=15,
        )
        if resp.status_code != 200:
            return []
        return re.findall(r"/rates/properties/(\d+)", resp.text)
    except Exception:
        return []


def _fetch_detail(session: requests.Session, val_id: str) -> dict | None:
    """Fetch and parse a single property detail page."""
    try:
        resp = session.get(f"{BASE_URL}/{val_id}", timeout=15)
        if resp.status_code != 200:
            return None
        return _parse_detail(resp.text, val_id)
    except Exception:
        return None


def _parse_detail(html: str, val_id: str) -> dict | None:
    """Parse property detail HTML into a dict.
    HTML structure: <div class="col-xs-3"><p><b>Label</b></p></div>
                    <div class="col-xs-9"><p>Value</p></div>
    """
    # Extract all label-value pairs from the Bootstrap grid layout
    pairs = re.findall(
        r'<div class="col-xs-3">\s*<p>(?:<b>)?([^<]+?)(?:</b>)?</p>\s*</div>'
        r'\s*<div class="col-xs-9">\s*<p>(?:<b>)?([^<]+?)(?:</b>)?</p>',
        html, re.DOTALL,
    )
    fields = {label.strip(): value.strip() for label, value in pairs}

    def _money(key: str) -> int | None:
        val = fields.get(key)
        if not val:
            return None
        cleaned = re.sub(r"[$ ,]", "", val)
        try:
            return int(float(cleaned))
        except (ValueError, TypeError):
            return None

    cv = _money("Capital Value")
    if not cv:
        return None

    lv = _money("Land Value")
    iv = _money("Improvements Value")
    if iv is None and cv and lv:
        iv = cv - lv

    address = fields.get("Location")
    total_rates = _money("Current Year\u2019s Rates") or _money("Current Year's Rates")

    return {
        "valuation_id": val_id,
        "address": address,
        "capital_value": cv,
        "land_value": lv,
        "improvements_value": iv,
        "total_rates": total_rates,
    }


def load_uhcc_rates(conn, log: Callable = None) -> int:
    """Data loader entry point: scrape UHCC and insert into council_valuations.
    Compatible with data_loader.run_loader() interface."""
    import psycopg

    _log = log or (lambda msg: print(msg, flush=True))

    # Scrape all properties
    properties = scrape_all_properties(on_progress=_log)
    if not properties:
        _log("No properties scraped")
        return 0

    # We need to geocode by matching against our addresses table
    _log(f"Matching {len(properties)} properties to addresses...")

    cur = conn.cursor()
    cur.execute("DELETE FROM council_valuations WHERE council = 'uhcc'")

    inserted = 0
    unmatched = 0

    for prop in properties:
        addr = prop.get("address") or ""
        cv = prop.get("capital_value")
        lv = prop.get("land_value") or 0
        iv = prop.get("improvements_value") or (cv - lv if cv else 0)

        if not cv or not addr:
            continue

        # Parse street number + name from UHCC address format
        # "10 Ward Street, Upper Hutt" or "1/25 Ward Street, Upper Hutt"
        parts = addr.split(",")
        street_part = parts[0].strip() if parts else addr

        # Try to match against our addresses table to get geometry
        # Match against our addresses table by full_address ILIKE
        cur.execute(
            """
            SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat
            FROM addresses
            WHERE town_city = 'Upper Hutt'
              AND address_lifecycle = 'Current'
              AND full_address ILIKE %s
            LIMIT 1
            """,
            [f"{street_part}%"],
        )

        row = cur.fetchone()
        if not row:
            unmatched += 1
            continue

        lng, lat = row[0], row[1]
        try:
            cur.execute(
                """
                INSERT INTO council_valuations (
                    council, valuation_id, address, full_address,
                    capital_value, land_value, improvements_value, geom
                ) VALUES (
                    'uhcc', %s, %s, %s,
                    %s, %s, %s,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                ) ON CONFLICT DO NOTHING
                """,
                [
                    prop["valuation_id"], addr, addr,
                    cv, lv, iv,
                    lng, lat,
                ],
            )
            inserted += 1
        except Exception:
            conn.rollback()
            continue

        if inserted % 500 == 0:
            conn.commit()
            _log(f"  Inserted {inserted} rows...")

    conn.commit()
    _log(f"Done: {inserted} inserted, {unmatched} unmatched addresses")
    return inserted

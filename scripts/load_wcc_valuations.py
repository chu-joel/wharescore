"""
Bulk download WCC property valuations from ArcGIS REST API into PostGIS.

Source: Wellington City Council Property MapServer
URL: https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0
Records: ~87,800 properties with CV/LV/IV, polygon geometry
CRS: EPSG:2193 (NZTM) → converted to EPSG:4326 (WGS84) on insert
Licence: CC-BY-SA

Usage:
    py -3.14 scripts/load_wcc_valuations.py
"""

import asyncio
import json
import math
import sys
import time
from urllib.request import urlopen, Request
from urllib.parse import urlencode

# Database config
DB_CONFIG = {
    "dbname": "wharescore",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": 5432,
}

API_BASE = "https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0/query"
PAGE_SIZE = 2000
TOTAL_EXPECTED = 87819


def fetch_page(offset: int) -> dict:
    """Fetch a page of features from the ArcGIS REST API."""
    params = {
        "where": "1=1",
        "outFields": "OBJECTID,ValuationID,RollNumber,AssessmentNumber,"
                     "StreetNumber,StreetName,Suburb,PostCode,Address,FullAddress,"
                     "LegalDescription,Title,LandArea,"
                     "CapitalValue,LandValue,ImprovementsValue,"
                     "ValuationDate,EffectiveRatingDate",
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
        "returnGeometry": "true",
        "outSR": "4326",  # Request WGS84 directly from the API
        "f": "json",
    }
    url = f"{API_BASE}?{urlencode(params)}"
    req = Request(url, headers={"User-Agent": "WhareScore-POC/1.0"})
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def parse_date(date_str: str) -> str | None:
    """Parse DD/MM/YYYY to YYYY-MM-DD."""
    if not date_str:
        return None
    parts = date_str.split("/")
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return None


def rings_to_wkt(rings: list) -> str:
    """Convert ArcGIS rings to WKT MULTIPOLYGON."""
    polys = []
    for ring in rings:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
        polys.append(f"(({coords}))")
    return f"MULTIPOLYGON({', '.join(polys)})"


def main():
    try:
        import psycopg
    except ImportError:
        print("ERROR: psycopg not installed. Run: py -3.14 -m pip install psycopg[binary]")
        sys.exit(1)

    conn = psycopg.connect(**DB_CONFIG)
    cur = conn.cursor()

    # Create table
    cur.execute("""
        DROP TABLE IF EXISTS council_valuations CASCADE;
        CREATE TABLE council_valuations (
            id SERIAL PRIMARY KEY,
            council TEXT NOT NULL DEFAULT 'wcc',
            objectid INTEGER,
            valuation_id TEXT,
            roll_number TEXT,
            assessment_number TEXT,
            street_number TEXT,
            street_name TEXT,
            suburb TEXT,
            postcode TEXT,
            address TEXT,
            full_address TEXT,
            legal_description TEXT,
            title TEXT,
            land_area NUMERIC,
            capital_value INTEGER,
            land_value INTEGER,
            improvements_value INTEGER,
            valuation_date DATE,
            effective_rating_date DATE,
            geom GEOMETRY(MultiPolygon, 4326)
        );
    """)
    conn.commit()
    print("Created council_valuations table")

    # Calculate pages
    total_pages = math.ceil(TOTAL_EXPECTED / PAGE_SIZE)
    total_loaded = 0
    start_time = time.time()

    for page in range(total_pages + 2):  # +2 for safety margin
        offset = page * PAGE_SIZE
        try:
            data = fetch_page(offset)
        except Exception as e:
            print(f"  Page {page} failed: {e}. Retrying...")
            time.sleep(2)
            try:
                data = fetch_page(offset)
            except Exception as e2:
                print(f"  Page {page} failed again: {e2}. Skipping.")
                continue

        features = data.get("features", [])
        if not features:
            print(f"  Page {page}: no features, done.")
            break

        # Batch insert
        rows = []
        for feat in features:
            a = feat["attributes"]
            geom = feat.get("geometry")

            wkt = None
            if geom and geom.get("rings"):
                wkt = rings_to_wkt(geom["rings"])

            rows.append((
                a.get("OBJECTID"),
                a.get("ValuationID"),
                a.get("RollNumber"),
                a.get("AssessmentNumber"),
                a.get("StreetNumber"),
                a.get("StreetName"),
                a.get("Suburb"),
                a.get("PostCode"),
                a.get("Address"),
                a.get("FullAddress"),
                a.get("LegalDescription"),
                a.get("Title"),
                float(a["LandArea"]) if a.get("LandArea") else None,
                int(a["CapitalValue"]) if a.get("CapitalValue") else None,
                int(a["LandValue"]) if a.get("LandValue") else None,
                int(a["ImprovementsValue"]) if a.get("ImprovementsValue") else None,
                parse_date(a.get("ValuationDate")),
                parse_date(a.get("EffectiveRatingDate")),
                wkt,
            ))

        # Insert rows one at a time using ST_GeomFromText
        for r in rows:
            wkt = r[-1]
            vals = r[:-1]
            if wkt:
                cur.execute("""
                    INSERT INTO council_valuations (
                        objectid, valuation_id, roll_number, assessment_number,
                        street_number, street_name, suburb, postcode,
                        address, full_address, legal_description, title,
                        land_area, capital_value, land_value, improvements_value,
                        valuation_date, effective_rating_date, geom
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        ST_GeomFromText(%s, 4326)
                    )
                """, vals + (wkt,))
            else:
                cur.execute("""
                    INSERT INTO council_valuations (
                        objectid, valuation_id, roll_number, assessment_number,
                        street_number, street_name, suburb, postcode,
                        address, full_address, legal_description, title,
                        land_area, capital_value, land_value, improvements_value,
                        valuation_date, effective_rating_date
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s
                    )
                """, vals)
        conn.commit()

        total_loaded += len(features)
        elapsed = time.time() - start_time
        rate = total_loaded / elapsed if elapsed > 0 else 0
        pct = (total_loaded / TOTAL_EXPECTED) * 100
        print(f"  Page {page + 1}/{total_pages}: {len(features)} features "
              f"(total: {total_loaded:,} / {TOTAL_EXPECTED:,}, {pct:.0f}%, "
              f"{rate:.0f} rec/s)")

        if not data.get("exceededTransferLimit", False):
            print("  No more pages.")
            break

    elapsed = time.time() - start_time
    print(f"\nLoaded {total_loaded:,} properties in {elapsed:.1f}s")

    # Create indexes
    print("Creating indexes...")
    cur.execute("""
        CREATE INDEX idx_cv_geom ON council_valuations USING GIST(geom);
        CREATE INDEX idx_cv_suburb ON council_valuations(suburb);
        CREATE INDEX idx_cv_full_address ON council_valuations(full_address);
        CREATE INDEX idx_cv_valuation_id ON council_valuations(valuation_id);
        CREATE INDEX idx_cv_council ON council_valuations(council);
        CREATE INDEX idx_cv_capital_value ON council_valuations(capital_value);
    """)
    conn.commit()
    print("Indexes created.")

    # Analyze
    cur.execute("ANALYZE council_valuations;")
    conn.commit()

    # Summary stats
    cur.execute("""
        SELECT
            COUNT(*) AS total,
            COUNT(geom) AS with_geom,
            COUNT(capital_value) AS with_cv,
            MIN(capital_value) AS min_cv,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY capital_value) AS median_cv,
            MAX(capital_value) AS max_cv,
            MIN(valuation_date) AS earliest_val,
            MAX(valuation_date) AS latest_val,
            COUNT(DISTINCT suburb) AS suburbs
        FROM council_valuations;
    """)
    row = cur.fetchone()
    print(f"\nSummary:")
    print(f"  Total properties: {row[0]:,}")
    print(f"  With geometry: {row[1]:,}")
    print(f"  With CV: {row[2]:,}")
    print(f"  CV range: ${row[3]:,} - ${row[5]:,}")
    print(f"  Median CV: ${int(row[4]):,}")
    print(f"  Valuation dates: {row[6]} to {row[7]}")
    print(f"  Suburbs: {row[8]}")

    cur.close()
    conn.close()
    print("\nDone!")


if __name__ == "__main__":
    main()

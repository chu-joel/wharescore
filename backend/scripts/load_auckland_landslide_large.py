"""Load Auckland Large-Scale Landslide Susceptibility (~86k features).

Task 3: https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Large_Scale_Landslide_Susceptibility/FeatureServer/0
"""
import json
import ssl
import time
import urllib.parse
import urllib.request

import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"
ENDPOINT = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Large_Scale_Landslide_Susceptibility/FeatureServer/0"
PAGE_SIZE = 2000
COMMIT_EVERY = 5000

_SSL_CTX = ssl.create_default_context()
_SSL_NOVERIFY = ssl._create_unverified_context()


def fetch_url(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    for attempt in range(3):
        try:
            ctx = _SSL_CTX if attempt == 0 else _SSL_NOVERIFY
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return resp.read()
        except ssl.SSLCertVerificationError:
            if attempt == 0:
                continue
            raise
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}", flush=True)
            if attempt < 2:
                time.sleep(3)
                continue
            raise
    return b""


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s not in ("", "None", "null", "Null") else None


def poly_wkt(geom):
    """Convert ArcGIS rings to WKT. Single ring → POLYGON, multiple → MULTIPOLYGON."""
    rings = geom.get("rings", [])
    if not rings:
        return None
    if len(rings) == 1:
        coords = ", ".join(f"{p[0]} {p[1]}" for p in rings[0])
        return f"POLYGON(({coords}))"
    else:
        parts = []
        for ring in rings:
            coords = ", ".join(f"{p[0]} {p[1]}" for p in ring)
            parts.append(f"(({coords}))")
        return f"MULTIPOLYGON({', '.join(parts)})"


def fetch_page(offset):
    params = {
        "where": "1=1",
        "outFields": "*",
        "f": "json",
        "returnGeometry": "true",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE_SIZE),
    }
    url = ENDPOINT + "/query?" + urllib.parse.urlencode(params)
    data = json.loads(fetch_url(url))
    return data.get("features", [])


def main():
    print("=== Auckland Large-Scale Landslide Susceptibility ===", flush=True)
    print(f"Endpoint: {ENDPOINT}", flush=True)

    conn = psycopg.connect(DB)
    cur = conn.cursor()

    # Task 2 check: verify geometry column type
    cur.execute(
        "SELECT type FROM geometry_columns "
        "WHERE f_table_name = 'landslide_susceptibility' AND f_geometry_column = 'geom'"
    )
    row = cur.fetchone()
    geom_type = row[0] if row else None
    print(f"landslide_susceptibility geom column type: {geom_type}", flush=True)
    if geom_type != "GEOMETRY":
        print("  Fixing geometry column type...", flush=True)
        cur.execute(
            "ALTER TABLE landslide_susceptibility "
            "ALTER COLUMN geom TYPE geometry(Geometry, 4326) "
            "USING geom::geometry(Geometry, 4326)"
        )
        conn.commit()
        print("  Done.", flush=True)
    else:
        print("  Geometry type is GEOMETRY — OK.", flush=True)

    import sys
    fresh = "--fresh" in sys.argv

    if fresh:
        print("--fresh: Deleting existing auckland/large_scale records...", flush=True)
        cur.execute(
            "DELETE FROM landslide_susceptibility WHERE source_council = %s AND type = %s",
            ("auckland", "large_scale"),
        )
        deleted = cur.rowcount
        conn.commit()
        print(f"  Deleted {deleted} existing rows.", flush=True)
        existing = 0
    else:
        cur.execute("SELECT COUNT(*) FROM landslide_susceptibility WHERE source_council = 'auckland' AND type = 'large_scale'")
        existing = cur.fetchone()[0]
        if existing > 0:
            print(f"RESUMING from offset {existing} (pass --fresh to start over)", flush=True)
        else:
            print("Starting fresh (no existing rows).", flush=True)

    # Fetch and insert
    offset = existing
    total_inserted = existing
    total_errors = 0
    batch_inserted = 0

    print("Fetching features...", flush=True)
    while True:
        features = fetch_page(offset)
        if not features:
            print(f"  No more features at offset {offset}.", flush=True)
            break

        for f in features:
            a = f.get("attributes", {})
            geom = f.get("geometry")
            if not geom or not geom.get("rings"):
                continue
            wkt = poly_wkt(geom)
            if not wkt:
                continue

            accuracy = clean(a.get("SusceptibilityValue")) or clean(a.get("Confidence"))

            try:
                cur.execute(
                    "INSERT INTO landslide_susceptibility (accuracy, type, source_council, geom) "
                    "VALUES (%s, %s, %s, ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 2193), 4326))",
                    (accuracy, "large_scale", "auckland", wkt),
                )
                total_inserted += 1
                batch_inserted += 1
            except Exception as e:
                conn.rollback()
                total_errors += 1
                if total_errors <= 5:
                    print(f"  Insert error: {e}", flush=True)

        offset += len(features)

        # Commit every COMMIT_EVERY rows
        if batch_inserted >= COMMIT_EVERY:
            conn.commit()
            print(f"  Committed. Total inserted so far: {total_inserted:,}, errors: {total_errors}", flush=True)
            batch_inserted = 0

        if len(features) < PAGE_SIZE:
            print(f"  Last page (got {len(features)} features). Done fetching.", flush=True)
            break

        time.sleep(0.2)
        print(f"  Fetched page ending at offset {offset} — {total_inserted:,} inserted so far...", flush=True)

    # Final commit
    conn.commit()
    print(f"Final commit done.", flush=True)

    # Record in data_versions (will be updated again after shallow loads)
    cur.execute(
        "INSERT INTO data_versions (source, loaded_at, row_count) VALUES (%s, NOW(), %s) "
        "ON CONFLICT (source) DO UPDATE SET loaded_at = NOW(), row_count = EXCLUDED.row_count",
        ("auckland_landslide_large", total_inserted),
    )
    conn.commit()

    print(f"\n=== DONE ===", flush=True)
    print(f"Inserted: {total_inserted:,}", flush=True)
    print(f"Errors:   {total_errors}", flush=True)

    # Summary check
    cur.execute(
        "SELECT type, COUNT(*) FROM landslide_susceptibility "
        "WHERE source_council = 'auckland' GROUP BY type"
    )
    for row in cur.fetchall():
        print(f"  auckland/{row[0]}: {row[1]:,} rows", flush=True)

    conn.close()


if __name__ == "__main__":
    main()

"""Load Auckland Shallow Landslide Susceptibility (~1M features).

Task 4: https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Shallow_Landslide_Susceptibility/FeatureServer/0

This is a HUGE dataset (~1M features). Will take a long time.
Uses larger page sizes and commits frequently to avoid memory issues.
"""
import json
import ssl
import time
import urllib.parse
import urllib.request

import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"
ENDPOINT = "https://services1.arcgis.com/n4yPwebTjJCmXB6W/arcgis/rest/services/Shallow_Landslide_Susceptibility/FeatureServer/0"
PAGE_SIZE = 2000
COMMIT_EVERY = 10000

_SSL_CTX = ssl.create_default_context()
_SSL_NOVERIFY = ssl._create_unverified_context()


def fetch_url(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "WhareScore/1.0"})
    for attempt in range(4):
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
            if attempt < 3:
                time.sleep(5)
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
    import sys
    # Resumes by default — pass --fresh to delete and start over
    fresh = "--fresh" in sys.argv

    print("=== Auckland Shallow Landslide Susceptibility (~4.87M features) ===", flush=True)
    print(f"Endpoint: {ENDPOINT}", flush=True)
    print(f"Page size: {PAGE_SIZE}, Commit every: {COMMIT_EVERY}", flush=True)

    conn = psycopg.connect(DB)
    cur = conn.cursor()

    if fresh:
        print("--fresh: Deleting existing auckland/shallow records...", flush=True)
        cur.execute(
            "DELETE FROM landslide_susceptibility WHERE source_council = %s AND type = %s",
            ("auckland", "shallow"),
        )
        deleted = cur.rowcount
        conn.commit()
        print(f"  Deleted {deleted} existing rows.", flush=True)
        existing = 0
    else:
        cur.execute("SELECT COUNT(*) FROM landslide_susceptibility WHERE source_council = 'auckland' AND type = 'shallow'")
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
    start_time = time.time()

    print("Fetching features...", flush=True)
    while True:
        try:
            features = fetch_page(offset)
        except Exception as e:
            print(f"  FATAL fetch error at offset {offset}: {e}", flush=True)
            break

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
                    (accuracy, "shallow", "auckland", wkt),
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
            elapsed = time.time() - start_time
            rate = total_inserted / elapsed if elapsed > 0 else 0
            print(
                f"  [{elapsed:.0f}s] Committed. Total: {total_inserted:,}, "
                f"errors: {total_errors}, rate: {rate:.0f}/s",
                flush=True,
            )
            batch_inserted = 0

        if len(features) < PAGE_SIZE:
            print(f"  Last page (got {len(features)} features). Done fetching.", flush=True)
            break

        time.sleep(0.1)

    # Final commit
    conn.commit()
    elapsed = time.time() - start_time
    print(f"Final commit done. Total time: {elapsed:.0f}s", flush=True)

    # Record in data_versions
    cur.execute(
        "INSERT INTO data_versions (source, loaded_at, row_count) VALUES (%s, NOW(), %s) "
        "ON CONFLICT (source) DO UPDATE SET loaded_at = NOW(), row_count = EXCLUDED.row_count",
        ("auckland_landslide_shallow", total_inserted),
    )

    # Also update combined auckland_landslide entry
    cur.execute(
        "SELECT SUM(row_count) FROM data_versions "
        "WHERE source IN ('auckland_landslide_large', 'auckland_landslide_shallow')"
    )
    combined = cur.fetchone()[0] or total_inserted
    cur.execute(
        "INSERT INTO data_versions (source, loaded_at, row_count) VALUES (%s, NOW(), %s) "
        "ON CONFLICT (source) DO UPDATE SET loaded_at = NOW(), row_count = EXCLUDED.row_count",
        ("auckland_landslide", int(combined)),
    )
    conn.commit()

    print(f"\n=== DONE ===", flush=True)
    print(f"Inserted: {total_inserted:,}", flush=True)
    print(f"Errors:   {total_errors}", flush=True)
    print(f"Time:     {elapsed:.0f}s", flush=True)

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

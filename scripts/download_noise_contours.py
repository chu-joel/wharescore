"""Download NZTA Road Noise Contours via ArcGIS REST API pagination.

Writes each page as a newline-delimited JSON file (one feature per line),
then combines into a GeoJSON FeatureCollection at the end.
"""
import json
import urllib.request
import sys
import time
import os

BASE_URL = "https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/Road_Noise_Contours/FeatureServer/0/query"
OUTPUT_DIR = "D:/Projects/Experiments/propertyiq-poc/data/noise"
NDJSON_FILE = os.path.join(OUTPUT_DIR, "road-noise-features.ndjson")
OUTPUT = os.path.join(OUTPUT_DIR, "road-noise-contours.geojson")
PAGE_SIZE = 2000
TOTAL_EXPECTED = 488275


def fetch_page(offset):
    params = (
        f"?where=1%3D1&outFields=LAeq24h&outSR=4326&f=geojson"
        f"&resultRecordCount={PAGE_SIZE}&resultOffset={offset}"
    )
    url = BASE_URL + params
    for attempt in range(3):
        try:
            req = urllib.request.Request(url)
            req.add_header("User-Agent", "WhareScore-POC/1.0")
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            print(f"  Retry {attempt+1} at offset {offset}: {e}", flush=True)
            if attempt < 2:
                time.sleep(5 * (attempt + 1))
    return None


def main():
    # Resume support: check how many features already downloaded
    existing = 0
    if os.path.exists(NDJSON_FILE):
        with open(NDJSON_FILE, "r") as f:
            for line in f:
                existing += 1
        print(f"Resuming from {existing:,} existing features", flush=True)

    offset = existing
    start = time.time()
    total = existing

    with open(NDJSON_FILE, "a") as out:
        while offset < TOTAL_EXPECTED:
            data = fetch_page(offset)
            if data is None:
                print(f"FATAL: Failed at offset {offset}", flush=True)
                sys.exit(1)

            features = data.get("features", [])
            if not features:
                break

            for feat in features:
                out.write(json.dumps(feat, separators=(",", ":")) + "\n")
            out.flush()

            total += len(features)
            elapsed = time.time() - start
            downloaded_this_session = total - existing
            rate = downloaded_this_session / elapsed if elapsed > 0 else 0
            remaining = TOTAL_EXPECTED - total
            eta = remaining / rate if rate > 0 else 0
            print(
                f"  {total:,}/{TOTAL_EXPECTED:,} ({total/TOTAL_EXPECTED*100:.1f}%) "
                f"- {rate:.0f} feat/s - ETA {eta/60:.1f}min",
                flush=True,
            )

            offset += PAGE_SIZE
            if len(features) < PAGE_SIZE:
                break

    print(f"\nTotal features: {total:,}", flush=True)

    # Combine into GeoJSON FeatureCollection
    print("Building GeoJSON FeatureCollection...", flush=True)
    with open(OUTPUT, "w") as out:
        out.write('{"type":"FeatureCollection","features":[\n')
        first = True
        with open(NDJSON_FILE, "r") as inp:
            for line in inp:
                if not first:
                    out.write(",\n")
                out.write(line.rstrip("\n"))
                first = False
        out.write("\n]}")

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"Done! {OUTPUT} = {size_mb:.0f} MB", flush=True)


if __name__ == "__main__":
    main()

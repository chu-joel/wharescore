"""Batch-run all remaining Auckland loaders + Christchurch flood.

Imports loader functions from data_loader.py via a workaround
(patches config to ignore extra env vars).
"""
import sys
import os
import time

# Fix pydantic settings before importing anything from app
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore")

# Patch config to allow import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Monkey-patch Settings before import
import app.config as cfg
original_init = cfg.Settings.__init__


def patched_init(self, **kwargs):
    # Force extra=ignore at class level
    pass


# Just set the config directly
cfg.Settings.model_config["extra"] = "ignore"
cfg.settings = cfg.Settings()

import psycopg
from app.services.data_loader import (
    load_auckland_tsunami,
    load_auckland_overland_flow,
    load_auckland_flood_sensitive,
    load_auckland_heritage,
    load_auckland_aircraft_noise,
    load_auckland_special_character,
    load_auckland_notable_trees,
    load_auckland_ecological_areas,
    load_auckland_coastal_erosion,
    load_auckland_height_variation,
    load_auckland_mana_whenua,
    load_auckland_geotech_reports,
    load_auckland_schools,
    load_auckland_parks,
    load_auckland_viewshafts,
    load_auckland_heritage_extent,
    load_at_gtfs,
    load_christchurch_flood,
)

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"


def log(msg):
    print(msg, flush=True)


def record_load(conn, source, count):
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO data_versions (source, loaded_at, row_count) VALUES (%s, NOW(), %s) "
        "ON CONFLICT (source) DO UPDATE SET loaded_at = NOW(), row_count = %s",
        (source, count, count),
    )
    conn.commit()


LOADERS = [
    ("auckland_tsunami", "Auckland Tsunami Evacuation Zones", load_auckland_tsunami),
    ("auckland_flood_sensitive", "Auckland Flood Sensitive Areas", load_auckland_flood_sensitive),
    ("auckland_heritage", "Auckland Historic Heritage Overlay", load_auckland_heritage),
    ("auckland_aircraft_noise", "Auckland Aircraft Noise Overlay", load_auckland_aircraft_noise),
    ("auckland_special_character", "Auckland Special Character Areas", load_auckland_special_character),
    ("auckland_notable_trees", "Auckland Notable Trees", load_auckland_notable_trees),
    ("auckland_ecological", "Auckland Ecological Areas", load_auckland_ecological_areas),
    ("auckland_height_variation", "Auckland Height Variation Control", load_auckland_height_variation),
    ("auckland_mana_whenua", "Auckland Mana Whenua Sites", load_auckland_mana_whenua),
    ("auckland_geotech", "Auckland Geotech Reports", load_auckland_geotech_reports),
    ("auckland_schools", "Auckland Schools", load_auckland_schools),
    ("auckland_parks", "Auckland Parks", load_auckland_parks),
    ("auckland_viewshafts", "Auckland Viewshafts", load_auckland_viewshafts),
    ("auckland_heritage_extent", "Auckland Heritage Extent", load_auckland_heritage_extent),
    ("auckland_overland_flow", "Auckland Overland Flow Paths", load_auckland_overland_flow),
    ("auckland_coastal_erosion", "Auckland Coastal Erosion", load_auckland_coastal_erosion),
    ("chch_flood", "Christchurch Flood Management", load_christchurch_flood),
    ("at_gtfs", "Auckland Transport GTFS", load_at_gtfs),
]


def main():
    conn = psycopg.connect(DB)
    total_loaders = len(LOADERS)
    succeeded = 0
    failed = 0

    for i, (key, label, loader_fn) in enumerate(LOADERS, 1):
        print(f"\n=== [{i}/{total_loaders}] {label} ===", flush=True)
        t0 = time.time()
        try:
            count = loader_fn(conn, log)
            elapsed = time.time() - t0
            record_load(conn, key, count)
            print(f"  OK: {count:,} records ({elapsed:.1f}s)", flush=True)
            succeeded += 1
        except Exception as e:
            elapsed = time.time() - t0
            print(f"  FAILED ({elapsed:.1f}s): {e}", flush=True)
            failed += 1
            try:
                conn.rollback()
            except Exception:
                # Reconnect if connection is broken
                conn.close()
                conn = psycopg.connect(DB)

    print(f"\n=== DONE: {succeeded} succeeded, {failed} failed out of {total_loaders} ===", flush=True)
    conn.close()


if __name__ == "__main__":
    main()

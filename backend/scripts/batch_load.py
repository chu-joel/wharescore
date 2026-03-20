"""Batch loader — runs all 78 data sources in parallel waves.

Loaders that share tables are grouped so they don't conflict.
Within each wave, all loaders run concurrently via ThreadPoolExecutor.

Usage:
    cd backend
    python -m scripts.batch_load              # run all
    python -m scripts.batch_load --wave 3     # run only wave 3
    python -m scripts.batch_load --dry-run    # show plan without executing
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Waves are ordered so that:
# 1. TRUNCATE-based loaders (Wellington-specific) run first, before council loaders that DELETE by source_council
# 2. Loaders sharing the same table with different source_councils can run in parallel
# 3. Large/slow loaders (GTFS, GNS national) get their own slots

WAVES: list[tuple[str, list[str]]] = [
    # Wave 1: Wellington TRUNCATE-based loaders (these wipe their tables first)
    ("Wellington core (TRUNCATE-based)", [
        "wcc_solar",
        "epb_wcc",
        "resource_consents",
        "height_controls",
        "corrosion_zones",
        "rail_vibration",
        "erosion_prone_land",
        "coastal_elevation",
    ]),

    # Wave 2: Wellington council loaders that use DELETE WHERE source_council
    # + GNS national (TRUNCATE their own tables)
    ("Wellington hazards + GNS national", [
        "gwrc_earthquake",       # TRUNCATE-ish: DELETE WHERE source_council
        "wcc_hazards",           # DELETE WHERE source_council
        "gwrc_landslide",        # DELETE WHERE source_council
        "gwrc_flood_extents",    # DELETE WHERE source_council
        "gns_landslides",        # TRUNCATE landslide_events/areas
        "gns_active_faults",     # TRUNCATE active_faults/faz
    ]),

    # Wave 3: Wellington remaining (TRUNCATE-based, different tables from wave 2)
    ("Wellington overlays + transit", [
        "district_plan",         # TRUNCATE district_plan_zones
        "viewshafts",            # TRUNCATE viewshafts
        "character_precincts",   # TRUNCATE character_precincts
        "coastal_inundation",    # TRUNCATE coastal_inundation
        "contaminated_land",     # TRUNCATE contaminated_land
        "metlink_gtfs",          # TRUNCATE metlink_stops etc.
    ]),

    # Wave 4: Auckland — unique tables (all safe in parallel)
    ("Auckland unique tables", [
        "auckland_stormwater",        # stormwater_management_area
        "auckland_overland_flow",     # overland_flow_paths (new)
        "auckland_heritage",          # historic_heritage_overlay (new)
        "auckland_aircraft_noise",    # aircraft_noise_overlay (new)
        "auckland_special_character", # special_character_areas (new)
        "auckland_notable_trees",     # notable_trees (new)
        "auckland_ecological",        # significant_ecological_areas (new)
        "auckland_coastal_erosion",   # coastal_erosion (new)
        "auckland_height_variation",  # height_variation_control (new)
        "auckland_mana_whenua",       # mana_whenua_sites (new)
        "auckland_geotech",           # geotechnical_reports (new)
        "auckland_schools",           # auckland_schools (new)
        "auckland_parks",             # park_extents (new)
        "auckland_heritage_extent",   # heritage_extent (new)
    ]),

    # Wave 5: Auckland — shared tables (different source_councils, safe in parallel)
    ("Auckland shared tables", [
        "auckland_flood",             # flood_hazard / auckland
        "auckland_flood_sensitive",   # flood_hazard / auckland_flood_sensitive
        "auckland_coastal",           # coastal_inundation / auckland
        "auckland_liquefaction",      # liquefaction_detail / auckland
        "auckland_landslide",         # landslide_susceptibility / auckland
        "auckland_plan_zones",        # district_plan_zones / auckland
        "auckland_tsunami",           # tsunami_hazard / auckland
        "auckland_viewshafts",        # viewshafts / auckland
    ]),

    # Wave 6: Auckland Transport GTFS (large download, own tables)
    ("Auckland Transport GTFS", [
        "at_gtfs",
    ]),

    # Wave 7: Christchurch (different source_councils from all above)
    ("Christchurch", [
        "chch_liquefaction",
        "chch_flood",
    ]),

    # Wave 8: Hamilton + Waikato (all different source_councils)
    ("Hamilton / Waikato", [
        "hamilton_flood",
        "hamilton_plan_zones",
        "hamilton_overland_flood",
        "hamilton_riverbank_hazard",
        "hamilton_sna",
        "waikato_liquefaction",
        "waikato_flood",
        "waikato_ground_shaking",
    ]),

    # Wave 9: Tauranga (all different source_councils)
    ("Tauranga / Bay of Plenty", [
        "tauranga_flood",
        "tauranga_liquefaction",
        "tauranga_plan_zones",
        "tauranga_tsunami",
        "tauranga_slope",
        "tauranga_coastal_erosion",
    ]),

    # Wave 10: Dunedin / Otago
    ("Dunedin / Otago", [
        "dunedin_flood_h1",
        "dunedin_flood_h2",
        "dunedin_flood_h3",
        "dunedin_land_instability",
        "dunedin_tsunami",
        "dunedin_plan_zones",
        "dunedin_coastal_hazard",
        "dunedin_heritage_precinct",
    ]),

    # Wave 11: Napier/Hastings + Nelson
    ("Hawke's Bay + Nelson", [
        "hbrc_flood",
        "hbrc_liquefaction",
        "hbrc_tsunami",
        "hbrc_landslide_high",
        "hbrc_contaminated",
        "hbrc_earthquake_amp",
        "hbrc_coastal_hazard",
        "hbrc_plan_zones",
        "nelson_flood",
        "nelson_liquefaction",
        "nelson_fault_hazard",
        "nelson_slope",
        "nelson_trees",
    ]),

    # Wave 12: Christchurch expanded + fixes
    ("Christchurch expanded", [
        "chch_liquefaction",   # FIXED: now uses GCSP + ECan regional
        "chch_plan_zones",
        "chch_tsunami",
        "chch_heritage",
        "chch_notable_trees",
        "chch_slope",
        "chch_coastal_erosion",
        "chch_coastal_inundation",
        "chch_flood_high",
    ]),

    # Wave 13: Heritage + trees for Hamilton, Dunedin, airport noise
    ("Heritage, trees, airport noise", [
        "hamilton_heritage",
        "hamilton_trees",
        "dunedin_heritage",
        "dunedin_trees",
        "dunedin_airport_noise",
    ]),

    # Wave 14: Tauranga fix + regional GTFS transit
    ("Tauranga fix + Regional GTFS", [
        "tauranga_plan_zones",  # FIXED: new endpoint
        "hamilton_gtfs",
        "dunedin_gtfs",
        "nelson_gtfs",
        "taranaki_gtfs",
        "palmerston_gtfs",
    ]),

    # Wave 15: Rates (large downloads — Auckland 623K, Christchurch 186K)
    ("Council rates/valuations", [
        "auckland_rates",
        "chch_rates",
        "dunedin_rates",
    ]),
]


def run_migrations():
    """Run pending SQL migrations via psycopg."""
    import os
    import psycopg

    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore")
    migrations_dir = os.path.join(os.path.dirname(__file__), "..", "migrations")
    migration_files = sorted([
        f for f in os.listdir(migrations_dir)
        if f.endswith(".sql") and f.startswith("0")
    ])

    conn = psycopg.connect(db_url)
    conn.autocommit = True

    for mf in migration_files:
        path = os.path.join(migrations_dir, mf)
        print(f"Running migration: {mf}...", flush=True)
        try:
            with open(path, encoding="utf-8") as f:
                sql = f.read()
            conn.execute(sql)
            print(f"  OK: {mf}", flush=True)
        except Exception as e:
            # Already applied or non-fatal
            err_str = str(e).split("\n")[0]
            print(f"  SKIP/WARN: {mf} — {err_str}", flush=True)

    conn.close()
    print("Migrations done.\n", flush=True)


def run_one(source_key: str) -> tuple[str, int, str | None, float]:
    """Run a single loader. Returns (key, rows, error, elapsed_seconds)."""
    from app.services.data_loader import run_loader

    t0 = time.time()
    progress_msgs = []

    def on_progress(msg):
        progress_msgs.append(msg)
        print(f"  [{source_key}] {msg}", flush=True)

    result = run_loader(source_key, on_progress)
    elapsed = time.time() - t0
    return source_key, result["rows"], result.get("error"), elapsed


def main():
    parser = argparse.ArgumentParser(description="Batch data loader")
    parser.add_argument("--wave", type=int, help="Run only this wave number (1-based)")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without executing")
    parser.add_argument("--workers", type=int, default=6, help="Max parallel workers per wave")
    parser.add_argument("--only", type=str, help="Comma-separated list of source keys to run")
    parser.add_argument("--skip-migrations", action="store_true", help="Skip running SQL migrations")
    args = parser.parse_args()

    # Run migrations first (unless skipped or dry-run)
    if not args.dry_run and not args.skip_migrations:
        print("Running SQL migrations...\n")
        run_migrations()

    # Filter waves
    waves = WAVES
    if args.wave:
        if args.wave < 1 or args.wave > len(WAVES):
            print(f"Wave must be 1-{len(WAVES)}")
            sys.exit(1)
        waves = [WAVES[args.wave - 1]]

    # Filter by --only
    only_keys = set(args.only.split(",")) if args.only else None

    total_keys = sum(len(keys) for _, keys in waves)
    print(f"=== WhareScore Batch Loader ===")
    print(f"Waves: {len(waves)}, Total loaders: {total_keys}, Workers/wave: {args.workers}")
    print()

    if args.dry_run:
        for i, (name, keys) in enumerate(waves, 1):
            filtered = [k for k in keys if not only_keys or k in only_keys]
            if not filtered:
                continue
            print(f"Wave {i}: {name} ({len(filtered)} loaders)")
            for k in filtered:
                print(f"  - {k}")
            print()
        print("Dry run — no data loaded.")
        return

    grand_total = 0
    grand_errors = 0
    grand_t0 = time.time()

    for i, (name, keys) in enumerate(waves, 1):
        filtered = [k for k in keys if not only_keys or k in only_keys]
        if not filtered:
            continue

        print(f"\n{'='*60}")
        print(f"Wave {i}/{len(WAVES)}: {name} ({len(filtered)} loaders)")
        print(f"{'='*60}")
        wave_t0 = time.time()
        wave_rows = 0
        wave_errors = 0

        with ThreadPoolExecutor(max_workers=min(args.workers, len(filtered))) as executor:
            futures = {executor.submit(run_one, key): key for key in filtered}
            for future in as_completed(futures):
                key, rows, error, elapsed = future.result()
                if error:
                    print(f"  FAIL [{key}] {error} ({elapsed:.1f}s)")
                    wave_errors += 1
                else:
                    print(f"  OK   [{key}] {rows:,} rows ({elapsed:.1f}s)")
                    wave_rows += rows

        wave_elapsed = time.time() - wave_t0
        print(f"Wave {i} done: {wave_rows:,} rows, {wave_errors} errors, {wave_elapsed:.1f}s")
        grand_total += wave_rows
        grand_errors += wave_errors

    grand_elapsed = time.time() - grand_t0
    print(f"\n{'='*60}")
    print(f"ALL DONE: {grand_total:,} total rows, {grand_errors} errors, {grand_elapsed:.1f}s")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

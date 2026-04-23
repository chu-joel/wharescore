#!/usr/bin/env python3
"""Load NZ SeaRise per-point sea-level-rise projections into PostGIS.

Input: the Zenodo published dataset (record 11398538):
  - NZ_VLM_final_May24.csv     (site_id -> lon/lat + VLM rate)
  - NZSeaRise_proj_vlm.csv     (relative SLR incl VLM, long-form,
                                per site x year x SSP x confidence)
  - NZSeaRise_proj_novlm.csv   (absolute SLR, not used in loader;
                                available for sanity cross-check)

Download from https://zenodo.org/records/11398538 or Takiwā "Download".

Kept per site: medium-confidence median (0.5 percentile) for
SSP1-2.6 / SSP2-4.5 / SSP5-8.5 at years 2050 / 2100 / 2150.
Medium-confidence H+ (83rd percentile) also stored for the worst-case stat.

Usage:
    python backend/scripts/load_searise_points.py --dry-run
    python backend/scripts/load_searise_points.py
    python backend/scripts/load_searise_points.py --csv-dir /path/to/11398538
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

try:
    import psycopg
except ImportError:
    psycopg = None

DEFAULT_DIR = Path(r"C:/Users/joelt/Downloads/11398538")
DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore"
)

# Scenario key used in snapshot.coastal.scenarios -> (SSP field, scenario field)
SCENARIOS = {
    "SSP126": ("SSP1", "2.6"),
    "SSP245": ("SSP2", "4.5"),
    "SSP585": ("SSP5", "8.5"),
}
YEARS = (2050, 2100, 2150)
CONFIDENCE = "medium_confidence"


def read_vlm(path: Path) -> dict[int, dict]:
    """site_id -> {lon, lat, vlm_mm_yr}."""
    out: dict[int, dict] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                sid = int(row["Site ID"])
                out[sid] = {
                    "lon": float(row["Lon"]),
                    "lat": float(row["Lat"]),
                    "vlm_mm_yr": float(row["Vertical Rate (mm/yr)"]),
                }
            except (KeyError, ValueError):
                continue
    return out


def read_projections(path: Path) -> dict[int, dict]:
    """Returns site_id -> {SSP126: {2050:{median,upper}, 2100:..., 2150:...}, ...}.
    Values in cm. Only keeps medium_confidence rows for the 3 target scenarios."""
    want = {(ssp, sc): key for key, (ssp, sc) in SCENARIOS.items()}
    out: dict[int, dict] = defaultdict(lambda: defaultdict(dict))
    skipped = 0
    with path.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["Confidence"] != CONFIDENCE:
                continue
            key = want.get((row["SSP"], row["scenario"]))
            if key is None:
                continue
            try:
                year = int(row["year"])
                if year not in YEARS:
                    continue
                sid = int(row["site"])
                median_m = float(row["0.5"])
                upper_m = float(row["0.83"])
                out[sid][key][year] = {
                    "median_cm": round(median_m * 100, 1),
                    "upper_cm": round(upper_m * 100, 1),
                }
            except (KeyError, ValueError):
                skipped += 1
    if skipped:
        print(f"  skipped {skipped} malformed rows", file=sys.stderr)
    return out


def merge(vlm: dict, proj: dict) -> list[dict]:
    """Join VLM site metadata with projections. Skips sites missing either."""
    points = []
    missing_proj = 0
    incomplete_proj = 0
    for sid, meta in vlm.items():
        p = proj.get(sid)
        if not p:
            missing_proj += 1
            continue
        complete = all(
            year in p.get(scen, {}) for scen in SCENARIOS for year in YEARS
        )
        if not complete:
            incomplete_proj += 1
            continue
        points.append({
            "site_id": sid,
            "lon": meta["lon"],
            "lat": meta["lat"],
            "vlm_mm_yr": round(meta["vlm_mm_yr"], 2),
            "projections": p,
        })
    if missing_proj or incomplete_proj:
        print(f"  skipped {missing_proj} sites without projections, "
              f"{incomplete_proj} with incomplete coverage", file=sys.stderr)
    return points


def verify(points: list[dict]) -> None:
    """Print human-readable sanity check."""
    print(f"\n{len(points):,} sites loaded.\n")

    # National-median envelopes per published sources. A point outside
    # these is almost certainly a unit or scenario mix-up.
    envelopes = {
        ("SSP126", 2050): (10, 40),
        ("SSP245", 2050): (10, 45),
        ("SSP585", 2050): (10, 50),
        ("SSP126", 2100): (25, 80),
        ("SSP245", 2100): (30, 100),
        ("SSP585", 2100): (40, 140),
        ("SSP245", 2150): (45, 160),
        ("SSP585", 2150): (70, 250),
    }
    print("Range check (median, cm, across all sites):")
    print(f"  {'scenario':>8} {'year':>4}  {'min':>7} {'p25':>7} {'median':>7} {'p75':>7} {'max':>7}  envelope  flagged")
    for (scen, year), (lo, hi) in envelopes.items():
        vals = sorted(
            p["projections"][scen][year]["median_cm"] for p in points
            if scen in p["projections"] and year in p["projections"][scen]
        )
        if not vals:
            continue
        n = len(vals)
        flagged = sum(1 for v in vals if not (lo <= v <= hi))
        mark = "WARN" if flagged > n * 0.05 else "ok"
        print(
            f"  {scen:>8} {year:>4}  "
            f"{vals[0]:>7.1f} {vals[n//4]:>7.1f} {vals[n//2]:>7.1f} "
            f"{vals[3*n//4]:>7.1f} {vals[-1]:>7.1f}  "
            f"[{lo},{hi}]  {flagged}  ({mark})"
        )

    # VLM distribution. Most of NZ is between -4 and +2 mm/yr.
    vlms = sorted(p["vlm_mm_yr"] for p in points)
    n = len(vlms)
    subsiding = sum(1 for v in vlms if v < -1)
    rising = sum(1 for v in vlms if v > 1)
    stable = n - subsiding - rising
    print(f"\nVLM distribution (mm/yr):")
    print(f"  min {vlms[0]:.2f}  p25 {vlms[n//4]:.2f}  median {vlms[n//2]:.2f}  "
          f"p75 {vlms[3*n//4]:.2f}  max {vlms[-1]:.2f}")
    print(f"  subsiding (<-1): {subsiding:,}  stable: {stable:,}  rising (>+1): {rising:,}")

    # Specific city samples. Useful to eyeball the regional story.
    cities = {
        "Auckland Viaduct": (174.763, -36.842),
        "Wellington CBD":   (174.778, -41.289),
        "Christchurch CBD": (172.639, -43.531),
        "Tauranga":         (176.168, -37.688),
        "Nelson":           (173.284, -41.272),
        "Napier":           (176.917, -39.487),
        "Dunedin":          (170.500, -45.879),
    }
    print("\nNearest-site sample for 7 NZ cities:")
    print(f"  {'city':<20} {'lon':>8} {'lat':>8} {'vlm':>6}  "
          f"SSP245 2050/2100  SSP585 2050/2100/2150")
    for name, (lon, lat) in cities.items():
        best = min(
            points,
            key=lambda p: (p["lon"] - lon) ** 2 + (p["lat"] - lat) ** 2,
        )
        d = ((best["lon"] - lon) ** 2 + (best["lat"] - lat) ** 2) ** 0.5 * 111
        p245 = best["projections"]["SSP245"]
        p585 = best["projections"]["SSP585"]
        print(
            f"  {name:<20} {best['lon']:>8.3f} {best['lat']:>8.3f} "
            f"{best['vlm_mm_yr']:>5.2f}  "
            f"{p245[2050]['median_cm']:>4.0f}/{p245[2100]['median_cm']:>4.0f}     "
            f"{p585[2050]['median_cm']:>4.0f}/{p585[2100]['median_cm']:>4.0f}/{p585[2150]['median_cm']:>4.0f}  "
            f"(dist {d:.1f} km)"
        )


def create_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS searise_points (
                site_id INTEGER PRIMARY KEY,
                geom geometry(Point, 4326) NOT NULL,
                vlm_mm_yr REAL,
                projections JSONB NOT NULL
            )
        """)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS searise_points_geom_gix "
            "ON searise_points USING GIST (geom)"
        )
    conn.commit()


def upsert(conn, points: list[dict]) -> None:
    with conn.cursor() as cur:
        cur.execute("TRUNCATE searise_points")
        cur.executemany(
            """INSERT INTO searise_points (site_id, geom, vlm_mm_yr, projections)
               VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s::jsonb)""",
            [
                (p["site_id"], p["lon"], p["lat"], p["vlm_mm_yr"], json.dumps(p["projections"]))
                for p in points
            ],
        )
    conn.commit()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--csv-dir", type=Path, default=DEFAULT_DIR)
    ap.add_argument("--dry-run", action="store_true", help="verify only, no DB write")
    args = ap.parse_args()

    vlm_file = args.csv_dir / "NZ_VLM_final_May24.csv"
    proj_file = args.csv_dir / "NZSeaRise_proj_vlm.csv"
    for f in (vlm_file, proj_file):
        if not f.exists():
            print(f"Missing: {f}", file=sys.stderr)
            return 2

    print(f"Reading {vlm_file.name} ...")
    vlm = read_vlm(vlm_file)
    print(f"  {len(vlm):,} sites")

    print(f"\nReading {proj_file.name} (this takes a moment) ...")
    proj = read_projections(proj_file)
    print(f"  {len(proj):,} sites with projections")

    points = merge(vlm, proj)
    verify(points)

    if args.dry_run:
        print("\n[dry-run] skipping DB write")
        return 0

    if psycopg is None:
        print("psycopg not installed. Run: pip install psycopg[binary]", file=sys.stderr)
        return 1

    print(f"\nConnecting to {DB_URL}")
    with psycopg.connect(DB_URL) as conn:
        create_table(conn)
        upsert(conn, points)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

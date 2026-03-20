# backend/scripts/generate_area_profiles.py
"""
Batch generate AI area profiles for all SA2s.

Usage:
    cd backend
    python -m scripts.generate_area_profiles --ta "Wellington City"
    python -m scripts.generate_area_profiles --all --skip-existing
    python -m scripts.generate_area_profiles --all --skip-existing --workers 10
"""

import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg
import psycopg.rows
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

MODEL = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")

SYSTEM_PROMPT = """You are a New Zealand suburb expert. Given data about a suburb,
write 2-3 short sentences describing what it feels like to live there.

Focus on vibe and character — the kind of thing a local would tell a friend who's
thinking of moving there. Terrain, neighbourhood feel, walkability, any notable
quirks or watch-outs.

Do NOT include statistics, numbers, or data points. Do NOT mention specific businesses.
Keep it conversational and concise — like a one-breath description, not a report.

Output ONLY the profile text, no headings or labels."""

# SQL query to gather all available data for an SA2
DATA_SNAPSHOT_SQL = """
SELECT
  sa2.sa2_code, sa2.sa2_name, sa2.ta_name,
  (SELECT COUNT(*) FROM flood_zones fz WHERE ST_Intersects(fz.geom, sa2.geom)) AS flood_zones,
  (SELECT COUNT(*) FROM tsunami_zones tz WHERE ST_Intersects(tz.geom, sa2.geom)) AS tsunami_zones,
  (SELECT string_agg(DISTINCT lz.liquefaction, ', ')
   FROM liquefaction_zones lz WHERE ST_Intersects(lz.geom, sa2.geom)) AS liquefaction,
  (SELECT wz.zone_name FROM wind_zones wz
   WHERE ST_Intersects(wz.geom, ST_Centroid(sa2.geom)) LIMIT 1) AS wind_zone,
  (SELECT MAX(nc.laeq24h) FROM noise_contours nc
   WHERE ST_Intersects(nc.geom, sa2.geom)) AS max_road_noise_db,
  (SELECT COUNT(*) FROM contaminated_land cl
   WHERE ST_Intersects(cl.geom, sa2.geom)) AS contaminated_sites,
  (SELECT COUNT(*) FROM transit_stops ts
   WHERE ST_Within(ts.geom, sa2.geom)) AS transit_stops,
  (SELECT COUNT(*) FROM schools s
   WHERE ST_DWithin(s.geom::geography, ST_Centroid(sa2.geom)::geography, 1500)) AS schools_nearby,
  (SELECT ROUND(AVG(s.eqi_index)) FROM schools s
   WHERE ST_DWithin(s.geom::geography, ST_Centroid(sa2.geom)::geography, 1500)) AS avg_school_eqi,
  (SELECT COUNT(*) FROM heritage_sites hs
   WHERE ST_Within(hs.geom, sa2.geom)) AS heritage_sites,
  (SELECT rm.median_rent FROM mv_rental_market rm
   WHERE rm.sa2_code = sa2.sa2_code AND rm.dwelling_type = 'All'
   AND rm.number_of_beds = 'All' LIMIT 1) AS median_rent_all,
  (SELECT rm.yoy_pct FROM mv_rental_market rm
   WHERE rm.sa2_code = sa2.sa2_code AND rm.dwelling_type = 'All'
   AND rm.number_of_beds = 'All' LIMIT 1) AS rent_yoy_pct,
  (SELECT sv.cv_median FROM mv_sa2_valuations sv
   WHERE sv.sa2_code = sa2.sa2_code) AS median_cv,
  (SELECT string_agg(DISTINCT dpz.zone_name, ', ')
   FROM district_plan_zones dpz WHERE ST_Intersects(dpz.geom, sa2.geom)) AS zone_types,
  (SELECT MAX(hc.height_metres) FROM height_controls hc
   WHERE ST_Intersects(hc.geom, sa2.geom)) AS max_height_limit,
  (SELECT COUNT(*) FROM infrastructure_projects ip
   WHERE ip.geom IS NOT NULL
   AND ST_DWithin(ip.geom::geography, ST_Centroid(sa2.geom)::geography, 5000)) AS infra_projects
FROM sa2_boundaries sa2
WHERE sa2.sa2_code = %s
"""

UPSERT_SQL = """
INSERT INTO area_profiles (sa2_code, sa2_name, ta_name, profile, data_snapshot, model_used)
VALUES (%s, %s, %s, %s, %s::jsonb, %s)
ON CONFLICT (sa2_code) DO UPDATE SET
    profile = EXCLUDED.profile,
    data_snapshot = EXCLUDED.data_snapshot,
    model_used = EXCLUDED.model_used,
    generated_at = NOW()
"""


def process_sa2(sa2, db_url, index, total):
    """Process a single SA2 — each thread gets its own DB conn and OpenAI client."""
    ai_client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_version="2024-12-01-preview",
    )

    try:
        with psycopg.connect(db_url, row_factory=psycopg.rows.dict_row) as conn:
            # Get data snapshot
            data_row = conn.execute(DATA_SNAPSHOT_SQL, [sa2["sa2_code"]]).fetchone()
            if not data_row:
                logger.warning(f"  [{index}/{total}] No data for {sa2['sa2_code']}")
                return False

            data_snapshot = {k: v for k, v in data_row.items() if v is not None}

            # Generate profile via AI
            response = ai_client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Suburb: {sa2['sa2_name']}, {sa2['ta_name']}\n\nBackground data (for context only — do not cite numbers):\n{json.dumps(data_snapshot, indent=2, default=str)}",
                    },
                ],
                max_completion_tokens=2000,
            )
            profile = response.choices[0].message.content
            logger.info(f"  [{index}/{total}] {sa2['sa2_name']}: {len(profile)} chars")

            # Upsert
            conn.execute(
                UPSERT_SQL,
                [
                    sa2["sa2_code"],
                    sa2["sa2_name"],
                    sa2["ta_name"],
                    profile,
                    json.dumps(data_snapshot, default=str),
                    MODEL,
                ],
            )
            conn.commit()
            return True

    except Exception as e:
        logger.error(f"  [{index}/{total}] Failed {sa2['sa2_name']}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ta", help="Generate for a specific TA (e.g. 'Wellington City')")
    parser.add_argument("--all", action="store_true", help="Generate for all SA2s nationally")
    parser.add_argument("--skip-existing", action="store_true", help="Skip SA2s that already have profiles")
    parser.add_argument("--workers", type=int, default=5, help="Number of parallel workers (default: 5)")
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wharescore")

    with psycopg.connect(db_url, row_factory=psycopg.rows.dict_row) as conn:
        # Get SA2 list
        if args.ta:
            cur = conn.execute(
                "SELECT sa2_code, sa2_name, ta_name FROM sa2_boundaries WHERE ta_name = %s ORDER BY sa2_name",
                [args.ta],
            )
        elif args.all:
            cur = conn.execute("SELECT sa2_code, sa2_name, ta_name FROM sa2_boundaries ORDER BY ta_name, sa2_name")
        else:
            print("Usage: --ta 'Wellington City' or --all")
            sys.exit(1)

        sa2s = cur.fetchall()

        # Filter out existing if requested
        if args.skip_existing:
            existing_codes = {
                r["sa2_code"]
                for r in conn.execute("SELECT sa2_code FROM area_profiles").fetchall()
            }
            sa2s = [s for s in sa2s if s["sa2_code"] not in existing_codes]

        logger.info(f"Processing {len(sa2s)} SA2s with {args.workers} workers")

    if not sa2s:
        logger.info("Nothing to do — all profiles exist")
        return

    # Process in parallel
    done = 0
    failed = 0
    total = len(sa2s)
    start = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(process_sa2, sa2, db_url, i + 1, total): sa2
            for i, sa2 in enumerate(sa2s)
        }
        for future in as_completed(futures):
            if future.result():
                done += 1
            else:
                failed += 1

            if (done + failed) % 50 == 0:
                elapsed = time.time() - start
                rate = (done + failed) / elapsed
                remaining = (total - done - failed) / rate if rate > 0 else 0
                logger.info(
                    f"  Progress: {done + failed}/{total} "
                    f"({done} ok, {failed} failed) "
                    f"~{remaining/60:.1f} min remaining"
                )

    elapsed = time.time() - start
    logger.info(f"Done: {done} generated, {failed} failed in {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()

# backend/scripts/generate_area_profiles.py
"""
Batch generate AI area profiles for all SA2s.

Usage:
    cd backend
    python -m scripts.generate_area_profiles --ta "Wellington City"
    python -m scripts.generate_area_profiles --all  # national (~$0.50)
"""

import argparse
import json
import logging
import os
import sys
import time

import psycopg
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# Azure OpenAI client (sync — this is a batch script)
client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version="2024-12-01-preview",
)
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


def generate_profile(sa2_name: str, ta_name: str, data: dict) -> str:
    """Call Azure OpenAI to generate a suburb profile."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Suburb: {sa2_name}, {ta_name}\n\nBackground data (for context only — do not cite numbers):\n{json.dumps(data, indent=2, default=str)}",
            },
        ],
        max_completion_tokens=2000,
    )
    return response.choices[0].message.content


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ta", help="Generate for a specific TA (e.g. 'Wellington City')")
    parser.add_argument("--all", action="store_true", help="Generate for all SA2s nationally")
    parser.add_argument("--skip-existing", action="store_true", help="Skip SA2s that already have profiles")
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
        logger.info(f"Processing {len(sa2s)} SA2s")

        for i, sa2 in enumerate(sa2s):
            if args.skip_existing:
                existing = conn.execute(
                    "SELECT 1 FROM area_profiles WHERE sa2_code = %s", [sa2["sa2_code"]]
                ).fetchone()
                if existing:
                    logger.info(f"  [{i+1}/{len(sa2s)}] Skipping {sa2['sa2_name']} (exists)")
                    continue

            # Get data snapshot
            data_row = conn.execute(DATA_SNAPSHOT_SQL, [sa2["sa2_code"]]).fetchone()
            if not data_row:
                logger.warning(f"  [{i+1}/{len(sa2s)}] No data for {sa2['sa2_code']}")
                continue

            data_snapshot = {k: v for k, v in data_row.items() if v is not None}

            # Generate profile
            try:
                profile = generate_profile(sa2["sa2_name"], sa2["ta_name"], data_snapshot)
                logger.info(f"  [{i+1}/{len(sa2s)}] {sa2['sa2_name']}: {len(profile)} chars")
            except Exception as e:
                logger.error(f"  [{i+1}/{len(sa2s)}] Failed {sa2['sa2_name']}: {e}")
                time.sleep(2)
                continue

            # Upsert into area_profiles
            conn.execute(
                """
                INSERT INTO area_profiles (sa2_code, sa2_name, ta_name, profile, data_snapshot, model_used)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (sa2_code) DO UPDATE SET
                    profile = EXCLUDED.profile,
                    data_snapshot = EXCLUDED.data_snapshot,
                    model_used = EXCLUDED.model_used,
                    generated_at = NOW()
                """,
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
            time.sleep(0.5)  # rate limit courtesy

    logger.info("Done")


if __name__ == "__main__":
    main()

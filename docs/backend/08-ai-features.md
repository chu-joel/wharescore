# Backend — AI Features (Phase 2G)

**Creates:** Area profile generation script, AI property summary service, integration into report endpoint
**Prerequisites:** `02-project-setup.md` complete, `area_profiles` table exists (`sql/06-materialized-views.sql`), Azure OpenAI deployment ready
**Dependencies:** `openai>=1.60` in requirements.txt, Azure OpenAI API key in `.env`

---

## Files to Create

```
backend/
├── app/
│   └── services/
│       └── ai_summary.py       # Real-time property summary generation
└── scripts/
    └── generate_area_profiles.py  # Batch script — run once per region
```

---

## Overview

Two AI features, both using Azure OpenAI GPT-4o-mini:

1. **Area profiles** — Pre-generated suburb descriptions stored in `area_profiles` table. Batch script, run once. Cost: ~$0.02 for Wellington (78 SA2s), ~$0.50 national.

2. **AI property summary** — Real-time per-property summary blending area profile + report data + scores. Generated on each uncached report request. Cost: ~$0.0005/report. Cached 24h with the report.

Both are **non-blocking enhancements**. If Azure OpenAI is down or slow (>3s), the report returns without AI content.

---

## Step 1: AI Summary Service

```python
# backend/app/services/ai_summary.py
"""
Real-time AI property summary using Azure OpenAI GPT-4o-mini.
Called after scores are computed, before caching.
"""

import json
import logging

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

# Initialize Azure OpenAI client (async)
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI | None:
    """Lazy-init Azure OpenAI client. Returns None if not configured."""
    global _client
    if _client is not None:
        return _client
    if not settings.AZURE_OPENAI_API_KEY or not settings.AZURE_OPENAI_ENDPOINT:
        return None
    _client = AsyncOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        base_url=settings.AZURE_OPENAI_ENDPOINT,
    )
    return _client


SUMMARY_SYSTEM_PROMPT = """You are WhareScore's AI analyst for New Zealand properties.
Given a pre-written area profile and a full property data report (hazards, environment,
liveability, market, planning scores), write a concise 4-6 sentence summary.

Structure:
1. Open with the area context (from the profile — don't repeat it verbatim, weave it in)
2. Highlight the 2-3 most important findings from the data (best and worst)
3. Market position — is the rent/value fair? Trending up or down?
4. One practical takeaway for a prospective renter or buyer

Be specific with numbers from the data. Use a confident but balanced tone.
Flag genuine risks clearly, but contextualise ("10 EPBs within 300m is high for Wellington CBD").
Do NOT use bullet points — write flowing prose. Output ONLY the summary text."""


async def generate_property_summary(
    report: dict, area_profile: str | None
) -> str | None:
    """Generate AI summary for a property report.
    Returns summary text or None on failure."""
    client = _get_client()
    if not client:
        return None

    user_content = ""
    if area_profile:
        user_content += f"Area profile:\n{area_profile}\n\n"
    user_content += f"Property report data:\n{json.dumps(report, indent=2, default=str)}"

    try:
        response = await client.chat.completions.create(
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.6,
            max_tokens=400,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"AI summary generation failed: {e}")
        return None
```

---

## Step 2: Integrate into Report Endpoint

Add this block to `routers/property.py` inside `get_report()`, **after** `enrich_with_scores()` and **before** the cache write.

```python
# In routers/property.py — add these imports at top:
import asyncio
from ..services.ai_summary import generate_property_summary

# Inside get_report(), after enrich_with_scores(result):

    # --- AI summary (non-blocking, 3s timeout) ---
    area_profile = None
    sa2_code = (result.get("address") or {}).get("sa2_code")
    if sa2_code:
        async with pool.connection() as conn2:
            cur2 = await conn2.execute(
                "SELECT profile FROM area_profiles WHERE sa2_code = %s",
                [sa2_code],
            )
            pr = await cur2.fetchone()
            if pr:
                area_profile = pr["profile"]

    try:
        summary = await asyncio.wait_for(
            generate_property_summary(report, area_profile),
            timeout=3.0,
        )
        report["ai_summary"] = summary
    except (asyncio.TimeoutError, Exception):
        report["ai_summary"] = None  # AI is enhancement, not dependency

    report["area_profile"] = area_profile
    # --- end AI summary block ---

    # Then cache and return (existing code)
```

---

## Step 3: Batch Area Profile Generation Script

Run once to pre-generate suburb descriptions for all SA2s. Start with Wellington (~78 SA2s), expand nationally later.

```python
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
from openai import OpenAI

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

# Azure OpenAI client (sync — this is a batch script)
client = OpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
)
MODEL = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

SYSTEM_PROMPT = """You are a New Zealand property area expert. Given data about a
Statistical Area 2 (SA2) — a suburb-level geographic unit — write a concise 3-5
sentence profile describing what it's like to live there.

Cover: terrain/geography, neighbourhood character, practical liveability (transport,
shops, walkability), notable features (views, parks, heritage), and any watch-outs
(wind, noise, hazards). Be specific to the area — avoid generic statements.

Use the provided data to ground your description. You may add well-established general
knowledge about the area (e.g. "Mt Victoria is known for its hillside character homes")
but do NOT mention specific businesses by name. Write in a warm, informative tone —
like a knowledgeable local friend, not an estate agent.

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
  (SELECT ROUND(AVG(s.eqi)) FROM schools s
   WHERE ST_DWithin(s.geom::geography, ST_Centroid(sa2.geom)::geography, 1500)) AS avg_school_eqi,
  (SELECT COUNT(*) FROM heritage_sites hs
   WHERE ST_Within(hs.geom, sa2.geom)) AS heritage_sites,
  (SELECT rm.median_rent FROM mv_rental_market rm
   WHERE rm.sa2_code = sa2.sa2_code AND rm.dwelling_type = 'All'
   AND rm.number_of_beds = 'All' LIMIT 1) AS median_rent_all,
  (SELECT rm.yoy_pct FROM mv_rental_market rm
   WHERE rm.sa2_code = sa2.sa2_code AND rm.dwelling_type = 'All'
   AND rm.number_of_beds = 'All' LIMIT 1) AS rent_yoy_pct,
  (SELECT sv.median_cv FROM mv_sa2_valuations sv
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
                "content": f"Area: {sa2_name}, {ta_name}\n\nData:\n{json.dumps(data, indent=2, default=str)}",
            },
        ],
        temperature=0.7,
        max_tokens=300,
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
```

---

## Running the Script

```bash
cd backend

# Set env vars (or use .env):
export AZURE_OPENAI_API_KEY=your-key
export AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/openai/v1/
export AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wharescore

# Generate for Wellington (~78 SA2s, ~$0.02, ~2 minutes):
python -m scripts.generate_area_profiles --ta "Wellington City"

# Generate nationally (~2,171 SA2s, ~$0.50, ~20 minutes):
python -m scripts.generate_area_profiles --all --skip-existing
```

---

## Verification

```sql
-- Check generated profiles:
SELECT sa2_name, length(profile), generated_at
FROM area_profiles WHERE ta_name = 'Wellington City'
ORDER BY sa2_name;

-- Read a sample profile:
SELECT sa2_name, profile FROM area_profiles WHERE sa2_name = 'Mount Victoria';
```

```bash
# Report with AI summary:
curl http://localhost:8000/api/v1/property/1753062/report | python -m json.tool | grep -A5 ai_summary
# Expected: "ai_summary": "Vivian West sits in the heart of Wellington's..."
# If Azure OpenAI not configured: "ai_summary": null
```

"""
Generate SEO suburb guide pages for every NZ SA2 suburb using a LOCAL LLM
(Qwen via Ollama). Designed to run unattended overnight.

Reads data from: sa2_boundaries, mv_sa2_comparisons, mv_ta_comparisons,
mv_rental_market, mv_rental_trends, mv_crime_ta, area_profiles.
Writes to: suburb_guide_pages (one row per SA2).

RESUMABLE: uses data_hash to detect changes; skips unchanged suburbs unless
--force is passed. Safe to re-run after a crash.

USAGE:
  py -3.14 scripts/generate_suburb_guides.py                  # generate all
  py -3.14 scripts/generate_suburb_guides.py --limit 10       # just 10 (smoke test)
  py -3.14 scripts/generate_suburb_guides.py --ta "Wellington City"  # one TA
  py -3.14 scripts/generate_suburb_guides.py --sa2 100100      # one suburb
  py -3.14 scripts/generate_suburb_guides.py --force           # regenerate all
  py -3.14 scripts/generate_suburb_guides.py --publish         # mark as published

REQUIRES:
  pip install psycopg[binary] requests
  Ollama running locally: `ollama serve` (default http://localhost:11434)
  Model pulled:          `ollama pull qwen2.5:14b-instruct`  (or qwen2.5:7b-instruct on low-RAM boxes)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Optional

import psycopg
import requests

# ---------- Config ----------------------------------------------------------
DB_URL = "postgresql://postgres:postgres@localhost:5433/wharescore"  # SSH tunnel to prod
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "qwen3.5:9b"                     # local Ollama model
OLLAMA_TIMEOUT = 300                      # seconds per section call
OLLAMA_OPTIONS = {
    "temperature": 0.4,                   # low-ish for factual SEO copy
    "top_p": 0.9,
    "num_ctx": 8192,
    "num_predict": 500,                     # keep sections short
}
# Qwen3.5 uses <think>...</think> reasoning by default. Add /no_think to prompts
# to suppress it, otherwise we get thinking tags in the output.
DISABLE_THINKING = True
MAX_RETRIES = 3
SLEEP_BETWEEN_SUBURBS = 0.5               # be nice to local box

SECTIONS = [
    ("overview", (
        "Write 80-100 words. Open with the suburb's character, NOT a statistic. "
        "What does it feel like? Who lives here? Weave in area size and property count naturally. "
        "Compare the deprivation index to the city average for context. Draw from the area_profile_description."
    )),
    ("housing_and_rent", (
        "Write 80-120 words. Lead with the most common dwelling type and median rent in a natural sentence. "
        "Show the rent range (quartiles). Only quote year-on-year changes for types with 10+ bonds. "
        "If a category has fewer than 5 bonds, call the sample 'very small'. "
        "Is this area expensive, mid-range, or affordable? Say it directly."
    )),
    ("who_lives_here", (
        "Write 80-100 words about the community character from the area_profile_description. "
        "Interpret NZDep plainly: 1-3 = higher income, 4-6 = middle, 7-10 = lower income. "
        "Explain what it means for daily life. Do NOT repeat area size, property count, or school/transit counts."
    )),
    ("schools_and_amenities", (
        "Write 80-100 words. Compare the suburb's school count (1.5km) and transit stops (400m) "
        "to the city average — above or below? If earthquake-prone buildings exist, mention it. "
        "Do NOT repeat deprivation, crime, or rent data."
    )),
    ("safety_and_environment", (
        "Write 60-80 words. Crime data is city-level, NOT suburb-level — say this clearly. "
        "Quote the city offence rate per 10k. Mention noise only if data exists. "
        "Skip missing metrics silently. Be calm, not alarmist."
    )),
    ("is_it_right_for_you", (
        "Write 80-120 words directly to 'you'. 2-3 types of people this suburb suits well, "
        "1-2 types who should look elsewhere. Ground every claim in data. "
        "Don't summarise — add perspective. End with a clear verdict."
    )),
]

FAQ_PROMPTS = [
    "What is the median rent in {suburb}?",
    "Is {suburb} a safe place to live?",
    "How many schools are near {suburb}?",
    "What is the NZDep index for {suburb}?",
]

# ---------- Logging ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("suburb_guides.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("suburb_guides")


# ---------- Data fetching ---------------------------------------------------
@dataclass
class SuburbData:
    sa2_code: str
    sa2_name: str
    ta_name: Optional[str]
    region_name: Optional[str]
    area_hectares: Optional[float]
    property_count: int
    comparisons: Optional[dict]
    city_averages: Optional[dict]
    crime: Optional[dict]
    area_profile: Optional[dict]
    rental_overview: list[dict]
    rental_trends: list[dict]


def list_suburbs(conn, ta: Optional[str], sa2: Optional[str], limit: Optional[int]) -> list[tuple[str, str, str]]:
    """Return (sa2_code, sa2_name, ta_name) for suburbs to process."""
    sql = """
        SELECT sa2_code, sa2_name, ta_name
        FROM sa2_boundaries
        WHERE sa2_code IS NOT NULL
          AND sa2_name IS NOT NULL
          AND sa2_name NOT ILIKE 'Inlet %%'
          AND sa2_name NOT ILIKE 'Oceanic %%'
          AND sa2_name NOT ILIKE 'Inland water %%'
    """
    params: list[Any] = []
    if ta:
        sql += " AND ta_name = %s"
        params.append(ta)
    if sa2:
        sql += " AND sa2_code = %s"
        params.append(sa2)
    sql += " ORDER BY ta_name NULLS LAST, sa2_name"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    cur = conn.execute(sql, params)
    return [(r[0], r[1], r[2]) for r in cur.fetchall()]


def fetch_suburb_data(conn, sa2_code: str) -> Optional[SuburbData]:
    """Fetch all the facts we need to feed into the LLM."""
    row = conn.execute(
        """
        SELECT sa2_code, sa2_name, ta_name,
               ST_Area(geom::geography) / 10000 AS area_hectares
        FROM sa2_boundaries
        WHERE sa2_code = %s
        LIMIT 1
        """,
        [sa2_code],
    ).fetchone()
    if not row:
        return None
    sa2_code_v, sa2_name, ta_name, area_hectares = row

    property_count = conn.execute(
        """
        SELECT COUNT(*) FROM addresses a
        JOIN sa2_boundaries s ON ST_Within(a.geom, s.geom)
        WHERE s.sa2_code = %s AND a.address_lifecycle = 'Current'
        """,
        [sa2_code],
    ).fetchone()[0] or 0

    comp = conn.execute(
        "SELECT * FROM mv_sa2_comparisons WHERE sa2_code = %s LIMIT 1",
        [sa2_code],
    ).fetchone()
    comp_cols = [d[0] for d in conn.execute("SELECT * FROM mv_sa2_comparisons LIMIT 0").description] if comp else []
    comparisons = dict(zip(comp_cols, comp)) if comp else None

    city_averages = None
    if ta_name:
        city_row = conn.execute(
            """
            SELECT ta_name, avg_nzdep,
                   avg_school_count_1500m, avg_transit_count_400m,
                   avg_noise_db, avg_epb_count_300m
            FROM mv_ta_comparisons WHERE ta_name = %s LIMIT 1
            """,
            [ta_name],
        ).fetchone()
        if city_row:
            city_averages = {
                "ta_name": city_row[0],
                "avg_nzdep": city_row[1],
                "avg_school_count_1500m": city_row[2],
                "avg_transit_count_400m": city_row[3],
                "avg_noise_db": city_row[4],
                "avg_epb_count_300m": city_row[5],
            }

    crime = None
    if ta_name:
        c = conn.execute(
            "SELECT ta, victimisations_3yr, avg_victimisations_per_au FROM mv_crime_ta WHERE ta = %s LIMIT 1",
            [ta_name],
        ).fetchone()
        if c:
            crime = {
                "ta_name": c[0],
                "total_offences": c[1],
                "offence_rate_per_10k": round(float(c[2] or 0), 1),
            }

    area_profile_row = conn.execute(
        "SELECT profile FROM area_profiles WHERE sa2_code = %s LIMIT 1",
        [sa2_code],
    ).fetchone()
    area_profile = area_profile_row[0] if area_profile_row else None

    rentals = conn.execute(
        """
        SELECT dwelling_type, number_of_beds, median_rent,
               total_bonds, lower_quartile_rent, upper_quartile_rent
        FROM mv_rental_market WHERE sa2_code = %s
        ORDER BY dwelling_type, number_of_beds
        """,
        [sa2_code],
    ).fetchall()
    rental_overview = [
        {
            "dwelling_type": r[0], "bedrooms": r[1], "median_rent": r[2],
            "bond_count": r[3], "lower_quartile": r[4], "upper_quartile": r[5],
        }
        for r in rentals
    ]

    trends = conn.execute(
        """
        SELECT dwelling_type, number_of_beds, yoy_pct, cagr_5yr, cagr_10yr
        FROM mv_rental_trends WHERE sa2_code = %s
        ORDER BY dwelling_type, number_of_beds
        """,
        [sa2_code],
    ).fetchall()
    rental_trends = [
        {
            "dwelling_type": r[0], "bedrooms": r[1],
            "yoy_pct": r[2], "cagr_5yr": r[3], "cagr_10yr": r[4],
        }
        for r in trends
    ]

    # region inference
    region_map = {
        "Auckland": "Auckland",
        "Wellington City": "Wellington",
        "Lower Hutt City": "Wellington",
        "Upper Hutt City": "Wellington",
        "Porirua City": "Wellington",
        "Kapiti Coast District": "Wellington",
        "Christchurch City": "Canterbury",
        "Dunedin City": "Otago",
        "Queenstown-Lakes District": "Otago",
        "Hamilton City": "Waikato",
        "Tauranga City": "Bay of Plenty",
        "Palmerston North City": "Manawatu-Whanganui",
        "Nelson City": "Nelson",
        "New Plymouth District": "Taranaki",
    }
    region_name = region_map.get(ta_name or "")

    return SuburbData(
        sa2_code=sa2_code, sa2_name=sa2_name, ta_name=ta_name, region_name=region_name,
        area_hectares=float(area_hectares) if area_hectares else None,
        property_count=int(property_count),
        comparisons=comparisons, city_averages=city_averages, crime=crime,
        area_profile=area_profile, rental_overview=rental_overview, rental_trends=rental_trends,
    )


# ---------- Slug + hash -----------------------------------------------------
def slugify(name: str, ta_name: Optional[str]) -> str:
    base = name
    if ta_name:
        city = ta_name.replace(" City", "").replace(" District", "")
        if city and city.lower() not in name.lower():
            base = f"{name}-{city}"
    s = re.sub(r"[^\w\s-]", "", base.lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s


def compute_data_hash(data: SuburbData) -> str:
    payload = json.dumps(
        {
            "sa2": data.sa2_code, "name": data.sa2_name, "ta": data.ta_name,
            "area": data.area_hectares, "count": data.property_count,
            "comp": data.comparisons, "city": data.city_averages, "crime": data.crime,
            "profile": data.area_profile, "rentals": data.rental_overview, "trends": data.rental_trends,
        },
        sort_keys=True, default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def existing_hash(conn, sa2_code: str) -> Optional[str]:
    r = conn.execute("SELECT data_hash FROM suburb_guide_pages WHERE sa2_code = %s", [sa2_code]).fetchone()
    return r[0] if r else None


# ---------- Ollama call -----------------------------------------------------
def _strip_think_tags(text: str) -> str:
    """Remove Qwen3's <think>...</think> reasoning blocks from output."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def call_ollama(prompt: str) -> str:
    """Call Ollama chat endpoint. Retries on transient failure."""
    last_err: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "think": False,
                    "options": OLLAMA_OPTIONS,
                },
                timeout=OLLAMA_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            msg = data.get("message") or {}
            text = (msg.get("content") or "").strip()
            text = _strip_think_tags(text)
            if not text:
                raise RuntimeError("empty response from model")
            return text
        except (requests.RequestException, RuntimeError) as e:
            last_err = e
            log.warning("Ollama attempt %d/%d failed: %s", attempt, MAX_RETRIES, e)
            time.sleep(2 * attempt)
    raise RuntimeError(f"Ollama failed after {MAX_RETRIES} retries: {last_err}")


# ---------- Prompt building -------------------------------------------------
SYSTEM_PREAMBLE = (
    "You are a local property journalist writing a suburb profile for a New Zealand "
    "audience. Write as a knowledgeable local would explain the area to a friend who is "
    "thinking of moving there. Be warm but honest. Use plain, conversational NZ English.\n\n"
    "STRICT RULES:\n"
    "- Only use facts from the DATA block. NEVER invent street names, school names, "
    "park names, landmarks, or any detail not in the data.\n"
    "- Weave numbers naturally into sentences. NEVER open with a list of statistics.\n"
    "- NEVER repeat a fact, phrase, or description that was already stated in a previous section. "
    "Each section must add NEW information only. If the area_profile mentions 'steep streets' "
    "or 'green-belt access' and you already used that phrase, do NOT use it again — find a "
    "different angle or skip it. Repeating yourself is the worst mistake you can make.\n"
    "- BANNED words/phrases: vibrant, thriving, hidden gem, booming, charming, bustling, "
    "up-and-coming, nestled, picturesque, heart of, hub, oasis, haven, idyllic.\n"
    "- epb_count_300m = earthquake-prone buildings within 300m (NOT electric pole boxes).\n"
    "- Write like a real person, not a brochure. Vary sentence length. Use occasional "
    "contractions (it's, you'll, there's). Address the reader as 'you' where natural.\n"
    "- BE CONCISE. Say it in as few words as possible. Cut filler. No padding. Every "
    "sentence must add new information. If you can say it in 10 words, don't use 20."
)


def _humanise_comparisons(comp: Optional[dict]) -> Optional[dict]:
    """Rename cryptic DB columns to plain English for the model."""
    if not comp:
        return None
    return {
        "nz_deprivation_index (1=least deprived, 10=most)": comp.get("avg_nzdep"),
        "schools_within_1.5km": comp.get("school_count_1500m"),
        "public_transport_stops_within_400m": comp.get("transit_count_400m"),
        "max_road_noise_db": comp.get("max_noise_db"),
        "earthquake_prone_buildings_within_300m": comp.get("epb_count_300m"),
    }


def _humanise_city_avg(city: Optional[dict]) -> Optional[dict]:
    if not city:
        return None
    return {
        "city": city.get("ta_name"),
        "city_avg_deprivation_index": city.get("avg_nzdep"),
        "city_avg_schools_within_1.5km": city.get("avg_school_count_1500m"),
        "city_avg_transit_stops_within_400m": city.get("avg_transit_count_400m"),
        "city_avg_noise_db": city.get("avg_noise_db"),
        "city_avg_earthquake_prone_buildings_300m": city.get("avg_epb_count_300m"),
    }


def _humanise_rentals(rentals: list[dict]) -> list[dict]:
    out = []
    for r in rentals:
        out.append({
            "type": r.get("dwelling_type"),
            "bedrooms": r.get("bedrooms"),
            "median_weekly_rent": r.get("median_rent"),
            "number_of_bonds (sample size)": r.get("bond_count"),
            "lower_quartile_rent": r.get("lower_quartile"),
            "upper_quartile_rent": r.get("upper_quartile"),
        })
    return out


def _humanise_trends(trends: list[dict]) -> list[dict]:
    out = []
    for t in trends:
        out.append({
            "type": t.get("dwelling_type"),
            "bedrooms": t.get("bedrooms"),
            "rent_change_year_on_year_pct": t.get("yoy_pct"),
            "rent_growth_5yr_annualised_pct": t.get("cagr_5yr"),
            "rent_growth_10yr_annualised_pct": t.get("cagr_10yr"),
        })
    return out


def build_data_block(data: SuburbData) -> str:
    """Format the suburb data with human-readable field names so the model understands context."""
    block = {
        "suburb_name": data.sa2_name,
        "city_council": data.ta_name,
        "region": data.region_name,
        "area_km2": round(data.area_hectares / 100, 2) if data.area_hectares else None,
        "number_of_properties": data.property_count,
        "suburb_indicators": _humanise_comparisons(data.comparisons),
        "city_averages_for_comparison": _humanise_city_avg(data.city_averages),
        "crime_stats (territorial authority level, not suburb)": data.crime,
        "area_profile_description": data.area_profile,
        "current_rental_market": _humanise_rentals(data.rental_overview),
        "rental_trends": _humanise_trends(data.rental_trends),
    }
    return json.dumps(block, default=str, indent=2)


def build_section_prompt(section_key: str, instruction: str, data: SuburbData,
                         previous_sections: list[dict] | None = None) -> str:
    prev_block = ""
    if previous_sections:
        prev_lines = []
        for s in previous_sections:
            prev_lines.append(f"[{s['heading']}]: {s['body']}")
        prev_block = (
            "\n\nALREADY WRITTEN (DO NOT repeat ANY phrase, fact, or description from these):\n"
            + "\n".join(prev_lines)
        )
    return f"""{SYSTEM_PREAMBLE}

DATA:
{build_data_block(data)}{prev_block}

TASK: Write the '{section_key}' section for a page about {data.sa2_name}, {data.ta_name or 'New Zealand'}.

{instruction}

Return ONLY the section body as 1-3 short paragraphs. No headings, no lists, no markdown, no preamble. Be concise. Do NOT reuse any phrase from the ALREADY WRITTEN sections above."""


def build_meta_prompt(data: SuburbData) -> str:
    return f"""{SYSTEM_PREAMBLE}

DATA:
{build_data_block(data)}

TASK: Write SEO metadata for a guide page about {data.sa2_name}, {data.ta_name or 'New Zealand'}.

The intro paragraph should read like the opening of a magazine article — draw the reader in
with a sense of what the suburb feels like, not a list of numbers. Mention one or two
concrete facts (rent, schools, or deprivation index) woven naturally into prose.

Return STRICT JSON only (no markdown, no code fences):
{{
  "title": "<50-60 chars. Format: '{data.sa2_name} — Living, Rent & Schools Guide | WhareScore'>",
  "meta_description": "<150-160 chars. Write a sentence that would make someone click from Google. Include a specific number (e.g. median rent or school count).>",
  "h1": "<Clear heading. Format: 'Living in {data.sa2_name}: What You Need to Know'>",
  "intro": "<40-60 word opening paragraph. Start with character, not statistics. One or two data points woven in.>"
}}"""


def build_faq_prompt(data: SuburbData, question: str) -> str:
    return f"""{SYSTEM_PREAMBLE}

DATA:
{build_data_block(data)}

QUESTION: {question}

Write a 40-80 word answer that a normal person would find helpful. Lead with the direct
answer, then add one sentence of context (e.g. how it compares to the city average).
Use natural language, not "the data shows" or "according to the data".
If the data doesn't support an answer, say so in one sentence. Return only the answer text."""


# ---------- JSON rescue -----------------------------------------------------
def parse_meta_json(text: str) -> dict:
    """Extract JSON even if the model wrapped it in code fences or added chatter."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError(f"no JSON object in response: {text[:200]}")
    return json.loads(m.group(0))


# ---------- Generation pipeline --------------------------------------------
def generate_for_suburb(data: SuburbData) -> dict:
    log.info("Generating meta for %s (%s)", data.sa2_name, data.sa2_code)
    meta_raw = call_ollama(build_meta_prompt(data))
    try:
        meta = parse_meta_json(meta_raw)
    except Exception as e:
        log.warning("meta JSON parse failed, using fallback: %s", e)
        meta = {
            "title": f"{data.sa2_name} Suburb Guide | {data.ta_name or 'NZ'} | WhareScore",
            "meta_description": f"Independent data on {data.sa2_name} — rent, schools, safety, and more. Powered by WhareScore.",
            "h1": f"{data.sa2_name} Suburb Guide",
            "intro": f"{data.sa2_name} is a suburb in {data.ta_name or 'New Zealand'}.",
        }

    sections = []
    for key, instruction in SECTIONS:
        log.info("  section: %s", key)
        body = call_ollama(build_section_prompt(key, instruction, data, previous_sections=sections))
        sections.append({"key": key, "heading": key.replace("_", " ").title(), "body": body})

    faqs = []
    for q in FAQ_PROMPTS:
        question = q.format(suburb=data.sa2_name)
        log.info("  faq: %s", question)
        answer = call_ollama(build_faq_prompt(data, question))
        faqs.append({"question": question, "answer": answer})

    word_count = sum(len((s.get("body") or "").split()) for s in sections)

    key_stats = {
        "area_km2": round(data.area_hectares / 100, 2) if data.area_hectares else None,
        "property_count": data.property_count,
        "nzdep": data.comparisons.get("avg_nzdep") if data.comparisons else None,
        "schools_within_1.5km": data.comparisons.get("school_count_1500m") if data.comparisons else None,
        "transit_stops_within_400m": data.comparisons.get("transit_count_400m") if data.comparisons else None,
        "crime_per_10k": data.crime.get("offence_rate_per_10k") if data.crime else None,
        "median_rent_primary": (data.rental_overview[0].get("median_rent") if data.rental_overview else None),
    }

    return {
        "title": meta["title"][:180],
        "meta_description": meta["meta_description"][:250],
        "h1": meta["h1"][:180],
        "intro": meta["intro"],
        "sections": sections,
        "faqs": faqs,
        "key_stats": key_stats,
        "word_count": word_count,
    }


# ---------- Related links ---------------------------------------------------
def fetch_related_slugs(conn, data: SuburbData, limit: int = 6) -> list[dict]:
    """Find up to N other suburbs in the same TA that already have a guide."""
    if not data.ta_name:
        return []
    rows = conn.execute(
        """
        SELECT slug, suburb_name
        FROM suburb_guide_pages
        WHERE ta_name = %s AND sa2_code <> %s AND status = 'published'
        ORDER BY random()
        LIMIT %s
        """,
        [data.ta_name, data.sa2_code, limit],
    ).fetchall()
    return [{"slug": r[0], "name": r[1]} for r in rows]


# ---------- DB upsert -------------------------------------------------------
def upsert_guide(conn, data: SuburbData, generated: dict, data_hash: str, publish: bool):
    slug = slugify(data.sa2_name, data.ta_name)
    internal_links = fetch_related_slugs(conn, data)
    conn.execute(
        """
        INSERT INTO suburb_guide_pages (
            sa2_code, slug, suburb_name, ta_name, region_name,
            title, meta_description, h1, intro,
            sections, faqs, key_stats, internal_links,
            model_used, data_hash, word_count, status,
            generated_at, published_at
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            now(), %s
        )
        ON CONFLICT (sa2_code) DO UPDATE SET
            slug = EXCLUDED.slug,
            suburb_name = EXCLUDED.suburb_name,
            ta_name = EXCLUDED.ta_name,
            region_name = EXCLUDED.region_name,
            title = EXCLUDED.title,
            meta_description = EXCLUDED.meta_description,
            h1 = EXCLUDED.h1,
            intro = EXCLUDED.intro,
            sections = EXCLUDED.sections,
            faqs = EXCLUDED.faqs,
            key_stats = EXCLUDED.key_stats,
            internal_links = EXCLUDED.internal_links,
            model_used = EXCLUDED.model_used,
            data_hash = EXCLUDED.data_hash,
            word_count = EXCLUDED.word_count,
            status = EXCLUDED.status,
            generated_at = now(),
            published_at = CASE
                WHEN EXCLUDED.status = 'published' AND suburb_guide_pages.published_at IS NULL
                    THEN now()
                ELSE suburb_guide_pages.published_at
            END
        """,
        [
            data.sa2_code, slug, data.sa2_name, data.ta_name, data.region_name,
            generated["title"], generated["meta_description"], generated["h1"], generated["intro"],
            json.dumps(generated["sections"]), json.dumps(generated["faqs"]),
            json.dumps(generated["key_stats"], default=str), json.dumps(internal_links),
            MODEL, data_hash, generated["word_count"],
            "published" if publish else "draft",
            "now()" if publish else None,
        ],
    )
    conn.commit()
    return slug


# ---------- Main loop -------------------------------------------------------
def main():
    global MODEL
    parser = argparse.ArgumentParser(description="Generate SEO suburb guides with local Qwen")
    parser.add_argument("--ta", help="Only generate for this territorial authority")
    parser.add_argument("--sa2", help="Only generate for this SA2 code")
    parser.add_argument("--limit", type=int, help="Max suburbs to process this run")
    parser.add_argument("--force", action="store_true", help="Regenerate even if data hash unchanged")
    parser.add_argument("--publish", action="store_true", help="Mark generated rows as published")
    parser.add_argument("--db", default=DB_URL, help="Postgres URL")
    parser.add_argument("--model", default=MODEL, help="Ollama model tag")
    args = parser.parse_args()

    MODEL = args.model

    log.info("Connecting to %s", args.db)
    with psycopg.connect(args.db) as conn:
        # quick Ollama sanity check
        log.info("Checking Ollama at %s (model=%s)...", OLLAMA_URL, MODEL)
        try:
            probe = call_ollama("Reply with the single word OK.")
            log.info("Ollama OK: %s", probe[:60])
        except Exception as e:
            log.error("Ollama check failed: %s", e)
            sys.exit(1)

        suburbs = list_suburbs(conn, args.ta, args.sa2, args.limit)
        log.info("Processing %d suburbs", len(suburbs))

        ok = skipped = failed = 0
        start = time.time()

        for i, (sa2_code, sa2_name, ta_name) in enumerate(suburbs, 1):
            try:
                data = fetch_suburb_data(conn, sa2_code)
                if not data:
                    log.warning("[%d/%d] %s missing data, skipping", i, len(suburbs), sa2_code)
                    skipped += 1
                    continue

                new_hash = compute_data_hash(data)
                old_hash = existing_hash(conn, sa2_code)
                if old_hash == new_hash and not args.force:
                    log.info("[%d/%d] %s unchanged, skipping (hash=%s)", i, len(suburbs), sa2_name, new_hash)
                    skipped += 1
                    continue

                log.info("[%d/%d] GENERATING %s (%s)", i, len(suburbs), sa2_name, ta_name or "-")
                generated = generate_for_suburb(data)
                slug = upsert_guide(conn, data, generated, new_hash, args.publish)
                log.info("  wrote /suburbs/%s  (%d words)", slug, generated["word_count"])
                ok += 1

                # periodic progress line
                elapsed = time.time() - start
                rate = ok / elapsed if elapsed > 0 else 0
                remaining = (len(suburbs) - i) / rate if rate > 0 else 0
                log.info("  progress: %d ok / %d skipped / %d failed — eta %.1f min",
                         ok, skipped, failed, remaining / 60)

                time.sleep(SLEEP_BETWEEN_SUBURBS)
            except KeyboardInterrupt:
                log.warning("Interrupted by user")
                break
            except Exception as e:
                log.exception("[%d/%d] FAILED %s: %s", i, len(suburbs), sa2_code, e)
                failed += 1
                conn.rollback()
                continue

        log.info("DONE — ok=%d skipped=%d failed=%d total=%d time=%.1f min",
                 ok, skipped, failed, len(suburbs), (time.time() - start) / 60)


if __name__ == "__main__":
    main()

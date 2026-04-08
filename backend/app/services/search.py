from __future__ import annotations
import re
# backend/app/services/search.py
from .. import db
from .abbreviations import build_tsquery

# Columns returned for every search result
_RESULT_COLUMNS = """
    a.address_id, a.full_address, a.road_name, a.road_type_name,
    a.suburb_locality, a.town_city,
    a.gd2000_xcoord AS lng, a.gd2000_ycoord AS lat
"""

# Road type words — used to extract road name from query
_ROAD_TYPES = {
    "street", "road", "avenue", "drive", "place", "crescent", "terrace",
    "court", "lane", "highway", "esplanade", "parade", "square", "grove",
    "close", "way", "boulevard", "circuit", "quay", "mews", "rise",
    "track", "path", "row", "wharf", "walk",
}


def _extract_road_name(query: str) -> str | None:
    """Extract the probable road name from a search query.
    E.g. '14 Aro Street Wellington' → 'Aro'
         '100 Ponsonby Road Auckland' → 'Ponsonby'
         '1 Devon Street West New Plymouth' → 'Devon'
    Returns None if no road type word found."""
    words = query.strip().split()
    for i, w in enumerate(words):
        if w.lower() in _ROAD_TYPES and i >= 2:
            # Road name is between the number and the road type
            # Skip leading number tokens
            name_start = 0
            for j, tok in enumerate(words[:i]):
                if re.match(r"^\d+[A-Za-z]?/?$", tok):
                    name_start = j + 1
                else:
                    break
            if name_start < i:
                return " ".join(words[name_start:i])
    return None


async def search(query: str, limit: int) -> list[dict]:
    """Three-tier search: B-tree prefix → tsvector → trigram fallback.
    Each tier is progressively slower but handles more query types."""

    # Tier 1: B-tree prefix (< 0.2ms) — matches when user types start of address
    results = await _btree_prefix(query, limit)
    if len(results) >= limit:
        return results

    # Tier 2: tsvector full-text (3-35ms) — word-order independent, partial last token
    exclude_ids = [r["address_id"] for r in results]
    ts_results = await _tsvector_search(query, limit - len(results), exclude_ids)
    results.extend(ts_results)

    # Filter: if query contains a clear road name, drop results that don't match it.
    # Prevents "14 Aro Street Wellington" returning "14 Allen Street, Te Aro".
    if results:
        road_name = _extract_road_name(query)
        if road_name:
            road_lower = road_name.lower()
            matched = [r for r in results if road_lower in (r.get("road_name") or "").lower()]
            if matched:
                return matched
            # No road name match — fall through to trigram for better fuzzy matching

    if results:
        return results

    # Tier 3: trigram similarity (26ms-2s) — typo correction, only when tiers 1+2 fail
    return await _trigram_fallback(query, limit)


async def _btree_prefix(query: str, limit: int) -> list[dict]:
    """B-tree index scan on full_address_ascii with LIKE prefix.
    Fastest path — works for '162 Cuba', '10 The Terr'."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            f"""
            SELECT {_RESULT_COLUMNS}
            FROM addresses a
            WHERE lower(a.full_address_ascii) LIKE lower(%s)
              AND a.address_lifecycle = 'Current'
            ORDER BY a.full_address
            LIMIT %s
            """,
            [f"{query}%", limit],
        )
        return cur.fetchall()


async def _tsvector_search(
    query: str, limit: int, exclude_ids: list[int]
) -> list[dict]:
    """Full-text search using search_vector GIN index.
    Handles word reordering and partial last token ('cuba str' → Cuba Street)."""
    tsquery = build_tsquery(query)
    if not tsquery:
        return []

    async with db.pool.connection() as conn:
        cur = await conn.execute(
            f"""
            SELECT {_RESULT_COLUMNS},
                   ts_rank_cd(a.search_vector, to_tsquery('simple', %s)) AS rank
            FROM addresses a
            WHERE a.search_vector @@ to_tsquery('simple', %s)
              AND a.address_lifecycle = 'Current'
              AND a.address_id != ALL(%s)
            ORDER BY rank DESC, a.full_address
            LIMIT %s
            """,
            [tsquery, tsquery, exclude_ids, limit],
        )
        return cur.fetchall()


async def _trigram_fallback(query: str, limit: int) -> list[dict]:
    """Fuzzy fallback for typos. pg_trgm similarity — slowest tier.
    Only reached when prefix + tsvector both return 0 results.
    Uses a higher similarity threshold (0.4) and statement timeout (3s)
    to avoid slow scans on 2M rows."""
    async with db.pool.connection() as conn:
        await conn.execute("SET LOCAL statement_timeout = '3s'")
        await conn.execute("SET LOCAL pg_trgm.similarity_threshold = 0.4")
        try:
            cur = await conn.execute(
                f"""
                SELECT {_RESULT_COLUMNS},
                       similarity(a.full_address_ascii, %s) AS sim
                FROM addresses a
                WHERE a.full_address_ascii %% %s
                  AND a.address_lifecycle = 'Current'
                ORDER BY sim DESC
                LIMIT %s
                """,
                [query, query, limit],
            )
            return cur.fetchall()
        except Exception:
            # Timeout or other error — return empty rather than slow response
            return []

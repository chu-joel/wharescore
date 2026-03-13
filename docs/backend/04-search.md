# Backend — Search Endpoint (Phase 2B)

**Creates:** Three-tier address search, abbreviation expansion service
**Prerequisites:** `02-project-setup.md` complete. Search indexes exist (verify with Step 0).
**Reference:** `SEARCH-GEOCODING-RESEARCH.md` for full design rationale

---

## Files to Create

```
backend/app/
├── routers/
│   └── search.py           # GET /search/address
└── services/
    ├── search.py            # Three-tier search logic
    └── abbreviations.py     # Diacritics stripping + abbreviation expansion
```

---

## Step 0: Verify Search Indexes Exist

Run in psql to confirm indexes were created during data loading:

```sql
-- Should return 3 rows:
SELECT indexname FROM pg_indexes WHERE tablename = 'addresses'
  AND indexname IN (
    'idx_addresses_full_address_btree',
    'idx_addresses_search_vector',
    'idx_addresses_full_address_trgm'
  );
```

If missing, create them:
```sql
-- 1. B-tree prefix (primary autocomplete, <0.2ms)
CREATE INDEX IF NOT EXISTS idx_addresses_full_address_btree
ON addresses (lower(full_address_ascii) text_pattern_ops);

-- 2. tsvector GIN (multi-token search, 3-35ms)
-- search_vector column exists as a generated column on addresses table
CREATE INDEX IF NOT EXISTS idx_addresses_search_vector
ON addresses USING GIN (search_vector);

-- 3. GIN trigram (fuzzy fallback, 26ms-2s)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_addresses_full_address_trgm
ON addresses USING GIN (full_address_ascii gin_trgm_ops);
```

---

## Step 1: Abbreviation Expansion Service

Full implementation from `SEARCH-GEOCODING-RESEARCH.md` "Application-Layer Input Processing" section.

```python
# backend/app/services/abbreviations.py
import re
import unicodedata

# Road type abbreviations — only expand when preceded by another word
# to avoid "St Heliers" → "Street Heliers"
ROAD_ABBREVS = {
    "st": "street", "rd": "road", "ave": "avenue", "dr": "drive",
    "pl": "place", "cres": "crescent", "tce": "terrace", "ct": "court",
    "ln": "lane", "hwy": "highway", "esp": "esplanade", "pde": "parade",
    "sq": "square", "gr": "grove", "cl": "close", "way": "way",
    "bvd": "boulevard", "blvd": "boulevard", "cct": "circuit",
}

# Suburb/city abbreviations — always expand
GENERAL_ABBREVS = {
    "wgtn": "wellington", "wlg": "wellington", "welly": "wellington",
    "chch": "christchurch", "akl": "auckland", "dn": "dunedin",
    "hb": "hawkes bay", "bop": "bay of plenty",
    "nth": "north", "sth": "south", "mt": "mount",
}


def strip_diacritics(text: str) -> str:
    """Remove macrons and other diacritics: 'Māori' → 'Maori'."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def expand_abbreviations(query: str) -> str:
    """Expand common NZ address abbreviations.
    Road types only expand when preceded by another word."""
    words = query.strip().split()
    if not words:
        return query

    result = []
    for i, word in enumerate(words):
        lower = word.lower().rstrip(".,")
        # Road type abbreviation — only expand if not first word
        if i > 0 and lower in ROAD_ABBREVS:
            result.append(ROAD_ABBREVS[lower])
        # General abbreviation — always expand
        elif lower in GENERAL_ABBREVS:
            result.append(GENERAL_ABBREVS[lower])
        else:
            result.append(word)

    return " ".join(result)


def sanitize_tsquery_token(token: str) -> str:
    """Strip characters that break to_tsquery. Keep only alphanumeric + hyphens."""
    cleaned = re.sub(r"[^a-zA-Z0-9\-]", "", token)
    return cleaned


def build_tsquery(query: str) -> str:
    """Build a tsquery string for PostgreSQL full-text search.
    All tokens joined with & (AND). Last token gets :* (prefix match).
    Example: 'cuba str' → 'cuba & str:*'
    """
    stripped = strip_diacritics(query)
    tokens = stripped.strip().split()
    sanitized = [sanitize_tsquery_token(t) for t in tokens]
    sanitized = [t for t in sanitized if t]  # remove empties

    if not sanitized:
        return ""
    if len(sanitized) == 1:
        return f"{sanitized[0]}:*"

    # All tokens except last are exact, last gets prefix
    parts = [t for t in sanitized[:-1]]
    parts.append(f"{sanitized[-1]}:*")
    return " & ".join(parts)
```

---

## Step 2: Search Service — Three-Tier Strategy

```python
# backend/app/services/search.py
from ..db import pool
from .abbreviations import build_tsquery

# Columns returned for every search result
_RESULT_COLUMNS = """
    a.address_id, a.full_address, a.road_name, a.road_type_name,
    a.suburb_locality, a.town_city,
    a.gd2000_xcoord AS lng, a.gd2000_ycoord AS lat
"""


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
    if results:
        return results

    # Tier 3: trigram similarity (26ms-2s) — typo correction, only when tiers 1+2 fail
    return await _trigram_fallback(query, limit)


async def _btree_prefix(query: str, limit: int) -> list[dict]:
    """B-tree index scan on full_address_ascii with LIKE prefix.
    Fastest path — works for '162 Cuba', '10 The Terr'."""
    async with pool.connection() as conn:
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
        return await cur.fetchall()


async def _tsvector_search(
    query: str, limit: int, exclude_ids: list[int]
) -> list[dict]:
    """Full-text search using search_vector GIN index.
    Handles word reordering and partial last token ('cuba str' → Cuba Street)."""
    tsquery = build_tsquery(query)
    if not tsquery:
        return []

    async with pool.connection() as conn:
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
        return await cur.fetchall()


async def _trigram_fallback(query: str, limit: int) -> list[dict]:
    """Fuzzy fallback for typos. pg_trgm similarity — slowest tier.
    Only reached when prefix + tsvector both return 0 results."""
    async with pool.connection() as conn:
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
        return await cur.fetchall()
```

**Key column names (verified against actual schema):**
- `full_address_ascii` — ASCII-folded address (no macrons), used for B-tree + trigram
- `search_vector` — tsvector generated column, used for GIN full-text search
- `address_lifecycle` — filter to `'Current'` to exclude retired addresses

---

## Step 3: Search Router

```python
# backend/app/routers/search.py
from fastapi import APIRouter, Query, Request

from ..deps import limiter
from ..services.abbreviations import expand_abbreviations
from ..services.search import search as search_service

router = APIRouter()


@router.get("/search/address")
@limiter.limit("30/minute")
async def search_address(
    request: Request,
    q: str = Query(..., min_length=3, max_length=200),
    limit: int = Query(8, le=20),
):
    """Search NZ addresses. Three-tier: prefix → full-text → fuzzy.
    Returns up to `limit` results sorted by relevance."""
    expanded = expand_abbreviations(q)
    results = await search_service(expanded, limit)
    return {"results": results}
```

---

## Register in main.py

```python
from .routers import search
app.include_router(search.router, prefix="/api/v1")
```

---

## Verification

```bash
# Prefix search (Tier 1):
curl "http://localhost:8000/api/v1/search/address?q=162%20Cuba"
# Expected: 162 Cuba Street, Te Aro, Wellington as first result

# Full-text search (Tier 2):
curl "http://localhost:8000/api/v1/search/address?q=cuba%20street%20wellington"
# Expected: Cuba Street addresses

# Abbreviation expansion:
curl "http://localhost:8000/api/v1/search/address?q=162%20cuba%20st%20wgtn"
# Expected: expands to "162 cuba street wellington", finds results

# Typo correction (Tier 3):
curl "http://localhost:8000/api/v1/search/address?q=162%20Cuab%20Stret"
# Expected: trigram similarity catches the typo

# Rate limit check:
# Rapid 31+ requests → 429 Too Many Requests
```

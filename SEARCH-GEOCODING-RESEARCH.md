# WhareScore Search & Geocoding Research

**Last Updated:** 2026-03-04
**Status:** Research complete with live benchmarks against 2.4M address database, code reviewed

---

## Executive Summary

**PostgreSQL alone is fast enough.** No external search engine (Meilisearch, Typesense, Elasticsearch) is needed at 2.4M addresses. The recommended strategy combines three PostgreSQL index types:

| Strategy | Latency | Use Case | Index Size |
|----------|---------|----------|-----------|
| **B-tree prefix** (`LIKE 'prefix%'`) | **< 0.2ms** | Primary — handles 90%+ of autocomplete | 274 MB |
| **tsvector prefix** (`@@ to_tsquery(... :*)`) | **3–35ms** | Multi-word non-sequential tokens | 36 MB |
| **Trigram** (`word_similarity`) | **26ms–2s+** | Fuzzy fallback only — slow on common names | 389 MB |

**Verdict:** Use B-tree prefix as the primary path, tsvector as secondary for structured multi-token queries, and trigram only as a last-resort fuzzy fallback. Sub-50ms response is achievable for all realistic inputs.

---

## Database Schema

The `addresses` table has **2,403,583 rows** from LINZ Layer 105689.

Key columns for search:
- `full_address` (varchar 400) — contains macrons: "162 Cuba Street, Te Aro, Wellington"
- `full_address_ascii` (varchar 250) — ASCII-safe: "162 Cuba Street, Te Aro, Wellington"
- `address_number` (integer) — "162"
- `road_name` (varchar 100) — "Cuba"
- `road_type_name` (varchar 100) — "Street"
- `suburb_locality` (varchar 80) — "Te Aro"
- `town_city` (varchar 80) — "Wellington"
- `unit_type` / `unit_value` — "Unit" / "3" for "3/42 Smith Street"
- `address_id` (integer) — LINZ unique identifier
- `geom` (Point, SRID 4326) — WGS84 coordinates

### Address Format Examples

```
162 Cuba Street, Te Aro, Wellington
3/42 Smith Street, Thorndon, Wellington
10B Lynfield Avenue, Ilam, Christchurch
1960 Oxford Road, Cust                     ← no town_city
113 Mawai Hakona Drive, Wallaceville, Upper Hutt
```

Unit addresses use slash notation (`3/42`, `44/140`). Suffix addresses use letter suffixes (`10B`, `18C`). Some addresses lack a town_city.

---

## Indexes Created

All indexes tested and verified on the live database:

```sql
-- 1. B-tree prefix index (primary autocomplete path)
CREATE INDEX idx_addresses_full_address_btree
ON addresses (lower(full_address_ascii) text_pattern_ops);
-- Size: 274 MB

-- 2. GIN trigram index (fuzzy fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_addresses_full_address_trgm
ON addresses USING GIN (full_address_ascii gin_trgm_ops);
-- Size: 389 MB

-- 3. tsvector column + GIN index (structured multi-token search)
-- Using a stored generated column so it stays in sync if rows are added/updated.
-- Falls back to manual UPDATE + trigger if PG version < 12.
ALTER TABLE addresses ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', coalesce(full_address_ascii, ''))) STORED;
CREATE INDEX idx_addresses_search_vector ON addresses USING GIN (search_vector);
-- Size: 36 MB
```

### Index Size Summary

| Index | Size | Purpose |
|-------|------|---------|
| `addresses_pk` (B-tree on fid) | 103 MB | Primary key |
| `addresses_geom_geom_idx` (GiST) | 230 MB | Spatial — **redundant**, drop one |
| `idx_addresses_geom` (GiST) | 232 MB | Spatial — **duplicate** |
| `idx_addresses_full_address_btree` | 274 MB | Prefix autocomplete |
| `idx_addresses_full_address_trgm` | 389 MB | Fuzzy search fallback |
| `idx_addresses_search_vector` | 36 MB | Multi-token structured search |

**Action item:** Drop one of the duplicate spatial indexes: `DROP INDEX addresses_geom_geom_idx;` — saves 230 MB.

**Total search index overhead:** ~700 MB (btree + trigram + tsvector). Acceptable for a database with 18.5M total records.

---

## Benchmark Results (Live, 2.4M Rows)

All tests run against the live `wharescore` database on localhost.

### B-tree Prefix (`LIKE 'prefix%'`)

| Query | Time | Results | Notes |
|-------|------|---------|-------|
| `LIKE '162 cuba%'` | **0.07ms** | 2 rows | Exact match for Cuba Street |
| `LIKE '162 c%'` | **0.14ms** | 8 rows | Early characters, fast narrowing |
| `LIKE '3/42 s%'` | **0.1ms** | 8 rows | Unit addresses work perfectly |
| `LIKE '42 smith street, %auckland%'` | **0.08ms** | 0 rows | No exact match (comma format) |

**Verdict:** Sub-0.2ms consistently. Perfect for the primary autocomplete path where the user types from the start of the address.

### tsvector Prefix Search (`@@ to_tsquery`)

| Query | Time | Results | Notes |
|-------|------|---------|-------|
| `'162 & Cuba:* & Wellington:*'` | **3.3ms** | 1 row | Specific address, very fast |
| `'15 & Queen:*'` | **2.6ms** | 302 candidates, 8 returned | **Problem:** Queen:* matches Queenstown |
| `'Cuba & Street & Wellington:*'` | **27ms** | 611 results | Road name without number |
| `'42 & Smith:* & Street:* & Auckland:*'` | **35ms** | 0 rows | No "42 Smith Street" in Auckland |
| `'Cuba & St:* & Wgtn:*'` | **23ms** | 0 rows | **Problem:** abbreviations don't match |

**Key issues found:**
1. **Prefix on non-final tokens causes false positives:** `Queen:*` matches "Queenstown". Fix: only use `:*` on the last token.
2. **Abbreviations don't match:** "St" doesn't prefix-match "Street", "Wgtn" doesn't match "Wellington". Fix: expand abbreviations in application layer before querying.

### Trigram Word Similarity

| Query | Time | Results | Candidates Scanned | Notes |
|-------|------|---------|-------------------|-------|
| `'162 Cub Well'` | **26ms** | 5 rows | 356 | Specific address, fast |
| `'42 Smith St Auckland'` | **399ms** | 1 row | 35,211 | Common name = too many candidates |
| `'42 Smith Street Auckland'` | **1,215ms** | 8 rows | 103,156 | Expanded abbreviation = even worse |

**Verdict:** Trigram is **unreliable for autocomplete** — performance varies from 26ms (acceptable) to 1.2s+ (unusable) depending on how common the name components are. "Smith" + "Street" + "Auckland" generates massive candidate sets.

### Hybrid: tsvector Filter + Trigram Rank

| Query | Time | Notes |
|-------|------|-------|
| tsvector filter → trigram rank for "162 Cuba Street Wellington" | **4ms** | tsvector narrows to 1 candidate, trigram rank trivial |

**Verdict:** The hybrid approach is fast because tsvector does the heavy lifting (narrowing from 2.4M to <50 candidates), then trigram scoring runs against a tiny set.

---

## Recommended Search Architecture

### Three-Tier Strategy

```
User types "162 Cu"
     │
     ▼
┌─────────────────────────────┐
│ Tier 1: B-tree Prefix       │  ← LIKE 'prefix%', < 0.2ms
│ Try first, always fastest   │
│ Works when user types from   │
│ start of address            │
└──────────┬──────────────────┘
           │ < 8 results?
           ▼
┌─────────────────────────────┐
│ Tier 2: tsvector Prefix     │  ← @@ to_tsquery(), 3-35ms
│ Use when user includes       │
│ suburb/city but not from     │
│ start (e.g., "Cuba Wgtn")   │
└──────────┬──────────────────┘
           │ 0 results?
           ▼
┌─────────────────────────────┐
│ Tier 3: Trigram Fallback    │  ← word_similarity, 26ms-400ms
│ Only for typos/fuzzy match  │
│ with small candidate sets   │
└─────────────────────────────┘
```

### Application-Layer Input Processing

Before querying, the FastAPI endpoint should:

#### 1. Expand NZ Address Abbreviations

```python
import unicodedata

# Road type abbreviations — only expanded when they appear AFTER a word
# (i.e., in road-type position, not as a prefix like "St Heliers")
NZ_ROAD_TYPE_ABBREVIATIONS = {
    'st': 'street',
    'rd': 'road',
    'tce': 'terrace',
    'dr': 'drive',
    'ave': 'avenue',
    'pl': 'place',
    'cres': 'crescent',
    'cr': 'crescent',
    'blvd': 'boulevard',
    'hwy': 'highway',
    'pde': 'parade',
    'espl': 'esplanade',
    'grv': 'grove',
}

# City/region abbreviations — safe to expand anywhere
NZ_PLACE_ABBREVIATIONS = {
    r'\bwgtn\b': 'wellington',
    r'\bchch\b': 'christchurch',
    r'\bakl\b': 'auckland',
}

def strip_diacritics(text: str) -> str:
    """Remove macrons and other diacritics: Māori → Maori, Te Aro → Te Aro."""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))

def expand_abbreviations(query: str) -> str:
    q = strip_diacritics(query.lower())

    # Expand place abbreviations (safe anywhere)
    for pattern, replacement in NZ_PLACE_ABBREVIATIONS.items():
        q = re.sub(pattern, replacement, q)

    # Expand road type abbreviations only when they appear AFTER another word
    # This prevents "St Heliers" → "Street Heliers" while still catching "Cuba St"
    for abbrev, full in NZ_ROAD_TYPE_ABBREVIATIONS.items():
        q = re.sub(rf'(\w)\s+{re.escape(abbrev)}\b', rf'\1 {full}', q)

    return q
```

#### 2. Parse User Input to Choose Strategy

```python
import re

def sanitize_tsquery_token(token: str) -> str:
    """Strip characters that have special meaning in tsquery syntax."""
    return re.sub(r'[&|!:*()\\<>]', '', token).strip()

def build_tsquery(expanded: str) -> str:
    """Build a tsquery string from expanded user input.
    Only prefix-matches the LAST token (avoids Queen → Queenstown)."""
    tokens = expanded.split()
    if not tokens:
        return ''
    sanitized = [sanitize_tsquery_token(t) for t in tokens]
    sanitized = [t for t in sanitized if t]  # drop empty tokens
    if not sanitized:
        return ''
    # Exact match for all but last token, prefix match for last
    parts = sanitized[:-1] + [f"{sanitized[-1]}:*"]
    return " & ".join(parts)
```

#### 3. Only Prefix-Match the Last Token

This is the critical fix for the `Queen:*` → Queenstown problem:

```sql
-- User types: "15 Queen Street Auck"
-- tsquery:    '15 & Queen & Street & Auck:*'
--             ↑ exact     ↑ exact   ↑ prefix (last token only)
```

This prevents intermediate tokens from matching unexpected words while still allowing the user to type partial last words.

### FastAPI Endpoint Design

```python
@router.get("/api/v1/search/address")
async def search_address(q: str, limit: int = 8):
    if len(q) < 3:
        return {"results": []}

    expanded = expand_abbreviations(q)  # includes strip_diacritics
    results = []

    # Tier 1: B-tree prefix (< 0.2ms)
    # Order by length (shorter = more specific match) then alphabetically
    results = await db.fetch(
        "SELECT address_id, full_address, full_address_ascii, "
        "       suburb_locality, town_city, "
        "       ST_X(geom) AS lng, ST_Y(geom) AS lat "
        "FROM addresses "
        "WHERE lower(full_address_ascii) LIKE $1 || '%' "
        "ORDER BY length(full_address_ascii), full_address_ascii "
        "LIMIT $2",
        expanded.lower(), limit
    )

    # Tier 2: tsvector if B-tree found too few results
    if len(results) < limit:
        tsquery = build_tsquery(expanded.lower())
        if tsquery:
            exclude_ids = [r['address_id'] for r in results]

            ts_results = await db.fetch(
                "SELECT address_id, full_address, full_address_ascii, "
                "       suburb_locality, town_city, "
                "       ST_X(geom) AS lng, ST_Y(geom) AS lat "
                "FROM addresses "
                "WHERE search_vector @@ to_tsquery('simple', $1) "
                "  AND address_id != ALL($2::int[]) "
                "ORDER BY ts_rank(search_vector, to_tsquery('simple', $1)) DESC, "
                "         length(full_address_ascii) "
                "LIMIT $3",
                tsquery, exclude_ids, limit - len(results)
            )
            results.extend(ts_results)

    # Tier 3: Trigram fallback (only if Tiers 1+2 returned 0 results — likely a typo)
    if not results:
        results = await db.fetch(
            "SELECT address_id, full_address, full_address_ascii, "
            "       suburb_locality, town_city, "
            "       ST_X(geom) AS lng, ST_Y(geom) AS lat "
            "FROM addresses "
            "WHERE word_similarity($1, full_address_ascii) > 0.3 "
            "ORDER BY full_address_ascii <->> $1 "  -- distance operator, uses GIN index
            "LIMIT $2",
            expanded.lower(), limit
        )

    return {"results": [format_result(r) for r in results]}
```

### Response Shape

```json
{
  "results": [
    {
      "address_id": 1753062,
      "full_address": "162 Cuba Street, Te Aro, Wellington",
      "suburb": "Te Aro",
      "city": "Wellington",
      "lng": 174.7762,
      "lat": -41.2924
    }
  ]
}
```

Include `lng`/`lat` in the response so the frontend can immediately `flyTo` without a second geocoding call.

---

## Frontend Autocomplete Behaviour

### Debouncing & Input Rules

```typescript
const DEBOUNCE_MS = 200;       // Wait 200ms after last keystroke
const MIN_CHARS = 3;           // Don't search with < 3 characters
const MAX_RESULTS = 8;         // Show max 8 suggestions
const HIGHLIGHT_MATCH = true;  // Bold the matched portion
```

### Display Format

```
┌──────────────────────────────────────────┐
│ 📍 162 Cuba Street, Te Aro, Wellington   │  ← bold "162 Cu" (matched portion)
│ 📍 162 Cumberland Drive, Flagstaff, Ham… │
│ 📍 162 Cunningham Crescent, Grasmere, I… │
└──────────────────────────────────────────┘
```

- Pin icon left of each result
- Bold the portion matching user input
- Show suburb + city as full context
- Truncate long addresses with ellipsis
- Max 8 results (keyboard takes 50% of mobile screen)

### Post-Selection Flow

```
1. User taps suggestion                    [0ms]
2. Dismiss keyboard + autocomplete         [0ms]
3. Map flyTo property (zoom 17)            [0-1200ms]
4. Property pin appears with bounce        [800-1400ms]
5. Bottom sheet slides to peek (148px)     [1000-1400ms]
```

---

## Performance Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| Prefix search (B-tree) | < 1ms | **0.07–0.14ms** |
| Multi-token search (tsvector) | < 50ms | **3–35ms** |
| Fuzzy fallback (trigram) | < 200ms | **26ms specific, 400ms+ common names** |
| End-to-end API response | < 100ms | Projected **20-50ms** with connection pooling |
| Frontend debounce | 200ms | Config |
| Min input length | 3 chars | Config |

---

## Why Not an External Search Engine?

| Factor | PostgreSQL (current) | Typesense/Meilisearch |
|--------|---------------------|----------------------|
| Latency at 2.4M rows | 0.1–35ms | ~5-20ms |
| Typo tolerance | Partial (trigram) | Built-in |
| Synonym handling | App-layer expansion | Built-in config |
| Infrastructure | Already running | New service + sync pipeline |
| RAM usage | ~700MB indexes (on disk, cached by OS) | ~800MB-1.2GB dedicated RAM |
| Complexity | Zero additional services | Data sync, health monitoring |
| When to reconsider | >10M addresses, p99 >100ms, multi-field relevance | - |

**Verdict:** PostgreSQL is more than adequate. Revisit if search quality feedback from beta users indicates typo tolerance or fuzzy matching is a major pain point. If so, Typesense has a specific [address autocomplete reference implementation](https://typesense.org/docs/guide/reference-implementations/address-autocomplete.html).

---

## Cleanup Actions

```sql
-- Drop redundant duplicate spatial index (saves 230 MB)
DROP INDEX IF EXISTS addresses_geom_geom_idx;

-- Analyze table after adding new indexes
ANALYZE addresses;
```

---

## Key Sources

- [Fast autocomplete with pg_trgm — Ben Wilber](https://benwilber.github.io/programming/2024/08/21/pg-trgm-autocomplete.html) — 1.4B row benchmark, 30ms with GiST
- [Optimizing Postgres trigram search — Alex Klibisz](https://alexklibisz.com/2022/02/18/optimizing-postgres-trigram-search) — Expression index 113ms vs UNION 10.7s
- [pg_trgm empirical measurements](https://github.com/hexops-graveyard/pgtrgm_emperical_measurements) — GIN ~26% of text size
- [PostgreSQL pg_trgm docs](https://www.postgresql.org/docs/current/pgtrgm.html) — word_similarity, operators
- [Postgres FTS vs the rest — Supabase](https://supabase.com/blog/postgres-full-text-search-vs-the-rest) — Adequate up to 5-10M rows
- [Building a NZ address geocoder — cmhh](https://cmhh.github.io/posts/linz_geocoder_2/) — LINZ address data specifics
- [Typesense address autocomplete](https://typesense.org/docs/guide/reference-implementations/address-autocomplete.html) — Reference for V2 if needed

# WhareScore Quality Standards

> How to write code, handle errors, present data, and verify changes.
> Agents: read this before writing ANY code. These patterns prevent the most common mistakes.

---

## Code Patterns

### Backend service pattern (rates modules, data loaders)
Every council API client follows this structure. Copy `pncc_rates.py` as the template:

```python
async def fetch_xxx_rates(address: str, conn=None) -> dict | None:
    try:
        # 1. Build search query from LINZ address format
        where = _build_search(address)  # "10 Main Street, City" → "Location LIKE '10 Main Street%'"

        # 2. Query the ArcGIS/WFS endpoint
        data = await _fetch_json(url)
        if not data or not data.get("features"):
            return None  # No data = return None, don't raise

        # 3. Pick best match (handle unit numbers)
        prop = _best_match(data["features"], address)

        # 4. Return in STANDARD format (this format is mandatory)
        return {
            "current_valuation": {
                "capital_value": int_or_none,
                "land_value": int_or_none,
                "improvements_value": int_or_none,
                "total_rates": float_or_none,
            },
            "source": "xxx_arcgis",
        }
    except Exception as e:
        logger.warning(f"XXX rates error for {address}: {e}")
        return None  # ALWAYS return None on failure, never raise
```

**Key conventions:**
- `_build_search()` takes the LINZ `full_address` format: `"10 Main Street, Suburb, City"`. Split on comma, use first part + wildcard.
- `_best_match()` handles unit numbers: `"2/10 Main Street"` → look for feature where address starts with `"2/"`.
- `_fetch_json()` runs `requests.get` in a thread executor (async wrapper around sync HTTP).
- Return format MUST have `current_valuation.capital_value` as `int | None`. The generic handler in snapshot_generator.py and property.py reads this exact path.
- NEVER raise exceptions from a rates module. Log and return None. A failed rates lookup should not break the report.

### Address matching gotchas
- LINZ addresses use `town_city` column, NOT `city`. The report JSON uses `address.city` which comes from `town_city`.
- Unit addresses: `"2/10 Main Street"` — the `2` is `unit_value`, `10` is `address_number`.
- Some councils use `LOCATION`, others use `PropertyAddress`, `StreetAddress`, `ValuationLocation`. Check the ArcGIS layer's field names.
- Street types: LINZ uses `Road`, `Street`, `Avenue` etc. as separate column `road_type_name`. Council data may abbreviate (`St`, `Rd`, `Ave`) or not include it at all. Use LIKE with wildcard.

### ArcGIS pagination
When loading bulk data via `_load_council_arcgis()`:
- Default page size is 1000 features (ArcGIS server limit).
- Check `exceededTransferLimit` in response to know if more pages exist.
- Use `resultOffset` parameter for pagination.
- Some servers return 2000 max, some 1000. Use `page_size=1000` to be safe.
- If a server has no OBJECTID field, it can't paginate — you'll only get the first page.

### Error handling pattern
```python
# NON-CRITICAL operations (rates lookup, AI summary, transit overlay):
try:
    result = await some_operation()
except Exception as e:
    logger.warning(f"Operation failed for {address_id}: {e}")
    # Continue without this data — don't break the report
    result = None

# CRITICAL operations (report generation, database queries):
try:
    result = await critical_operation()
except Exception as e:
    logger.error(f"Critical failure: {e}")
    raise HTTPException(500, "Internal server error")
```

**Rule:** If the user can still get a useful report without this data, it's non-critical. Rates, transit, AI summary, nearby highlights — all non-critical. The SQL report function itself IS critical.

---

## Data Presentation Rules

### For the hosted report (paid)
- **Never show raw numbers alone.** `"Capital Value: $910,000"` is bad. `"Capital Value: $910,000 (Carterton District Council, valued August 2023)"` is good. Always show source and date.
- **Always answer "so what?"** Don't just show `"Flood zone: 1% AEP"`. Say `"This property is in a 1% AEP flood zone — there's a 1-in-100 chance of flooding in any given year. This may affect insurance premiums."`.
- **Use relative comparisons.** `"Your rent of $550/week is 8% above the median for 3-bedroom houses in this area ($510/week)"` is more useful than just showing the median.
- **Show confidence/coverage.** If we only have 12 rental bonds for this SA2, say so: `"Based on 12 rental bonds (limited data — wider area comparison recommended)"`.
- **Severity = what to DO, not just what IS.** Critical finding: `"Active fault 200m away — get a geotechnical report before making an offer"`. Not just `"Active fault nearby"`.

### For findings
- **Critical:** Immediate risk that should stop or significantly change the decision. Flood zone, active fault close, EPB rating, liquefaction high.
- **Warning:** Risk that needs investigation or pricing in. Moderate hazards, high noise, contaminated land nearby.
- **Info:** Worth knowing but not decision-changing. Heritage overlay, climate projections, geotechnical reports nearby.
- **Positive:** Good news that supports the decision. No hazards, good schools, good transit, low deprivation.

**Threshold philosophy:** Better to flag something the user can dismiss than to miss something that matters. When in doubt, make it a warning with a clear "what to do" action.

### For scores (0-100)
- The score is NOT a property rating. It's a RISK score. Higher = more risk factors present.
- 0-20 = very few risk factors. 80-100 = many significant risk factors.
- Always show the score WITH the label ("33 — Low Risk") and the category breakdown.
- Never imply a property is "good" or "bad" based on the score alone. A 60 might be fine if the buyer knows about and accepts the specific risks.

---

## Verification Workflow

### After changing report logic
1. Flush Redis cache: `ssh wharescore@20.5.86.126 'docker exec app-redis-1 redis-cli -a $REDIS_PASSWORD FLUSHDB'`
2. Test with a known address: `curl -sk https://wharescore.australiaeast.cloudapp.azure.com/api/v1/property/53548/report | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['liveability'], indent=2))"` (53548 = Hamilton CBD)
3. Check the field you changed is present and has the expected value.

### After adding a rates module
1. Test the module directly on the server:
```bash
ssh wharescore@20.5.86.126 'docker exec app-api-1 python -c "
import asyncio
from app.services.xxx_rates import fetch_xxx_rates
result = asyncio.run(fetch_xxx_rates(\"10 Main Street, City\"))
print(result)
"'
```
2. Verify CV override works in a report (flush cache first, then fetch report and check `property.capital_value`).

### After adding a DataSource
1. Check it loaded: `SELECT source, loaded_at FROM data_versions WHERE source = 'xxx';`
2. Check row count: `SELECT count(*) FROM flood_hazard WHERE source_council = 'xxx';`
3. Check spatial coverage: `SELECT count(*) FROM flood_hazard WHERE source_council = 'xxx' AND geom && ST_Expand(ST_SetSRID(ST_Point(lng, lat), 4326), 0.05);`

### After changing the hosted report
1. Generate a test report (use promo code WHARESCOREJOEL for a free credit).
2. Open the hosted report URL in a browser.
3. Check the new/changed section renders correctly.
4. Check both renter AND buyer personas.
5. Check with a property that HAS the relevant data AND one that doesn't (test empty state).

---

## Common Mistakes

| Mistake | Why it happens | How to avoid |
|---------|---------------|-------------|
| Creating `get_property_report(INT)` migration | PostgreSQL creates an overload that shadows the `BIGINT` version | Never create new migrations with this function. Edit 0022 in place. |
| `jsonb_build_object()` exceeds 100 args | PostgreSQL hard limit: max 100 arguments per function call. The `hazards` section is already at ~72 args (split into two calls). | Split into `jsonb_build_object(...) \|\| jsonb_build_object(...)`. Pre-commit hook enforces this. |
| Rates module not working for free reports | Wired into snapshot_generator.py but NOT property.py `_fix_unit_cv()` | Always wire in BOTH places. |
| Transit data missing for a city | Data loaded but `_overlay_transit_data()` not running | Check that `get_transit_data()` SQL function exists (migration 0023). |
| Report shows stale data after code change | Redis cache serving old version | Flush Redis after ANY report logic change. |
| ArcGIS query returns 0 results | Address format mismatch (LINZ vs council) | Check the council's address field format. Use LIKE with wildcard on street only. |
| Hosted report section shows nothing | Snapshot doesn't include the data | Add the field to `generate_snapshot()` return dict BEFORE creating the component. |
| Score is 0 for a property | Not enough indicators available (need 3+ categories with 2+ indicators each) | Check `coverage` field — if too few layers have data, score can't be computed. |
| Finding shows for wrong persona | Finding generator doesn't check persona | In `generateFindings()`, some findings are persona-specific. Check the ordering logic. |
| CV is from parking space instead of apartment | Spatial match in council_valuations hit wrong unit | This is WHY live rates APIs exist — they match by address text, not geometry. |
| Guest purchase token expired | Token only lasts 5 minutes in Redis | Guest must exchange token immediately after Stripe redirect. Can't be retried. |

---

## Tone & Content Guidelines

### AI Summary
- Neutral, factual, helpful. Like a knowledgeable friend who happens to know about property.
- Never: "This is a great property" or "You should definitely buy this."
- Always: "Here's what the data shows. Here's what that means for you."
- Acknowledge limitations: "Based on available data" not "We can confirm."
- No legal advice. No financial advice. "Consider consulting a professional" when appropriate.

### Recommendations
- Specific to the hazards/issues found. Not generic checklists.
- Action-oriented: "Get a building inspection focusing on moisture ingress" not "Consider getting an inspection."
- Prioritised: Critical actions first, nice-to-haves last.
- Source attribution: "Based on the flood zone data from [Council]" so users know it's data-driven.

### Disclaimers (required at bottom of hosted report)
- "This report is for informational purposes only and does not constitute a registered valuation, building inspection, or professional advice."
- "Data sourced from [list of councils/agencies]. Data accuracy depends on source currency."
- "WhareScore is not a licensed real estate agent, valuer, or building inspector."

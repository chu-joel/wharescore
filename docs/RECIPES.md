# WhareScore — Agent Recipes

> Step-by-step playbooks for common changes. Each recipe is self-contained.
> Read CLAUDE.md first for architecture context.
> **Every recipe ends with docs to update. This is mandatory.**

---

## Recipe: Add hazard data for a new council

**When:** A council has flood/tsunami/liquefaction/landslide GIS data you want to load.

1. Find the council's ArcGIS REST endpoint (usually `gis.{council}.govt.nz/server/rest/services/`)
2. Open `backend/app/services/data_loader.py`
3. Find the region section (ctrl-F for the council name or nearby council)
4. Add a `DataSource(...)` entry. Target table is almost always `flood_hazard`:
```python
DataSource("councilname_flood", "Council Name Flood Hazard",
    ["flood_hazard"],
    lambda conn, log=None: _load_council_arcgis(conn, log,
        "https://gis.council.govt.nz/.../MapServer/0",
        "flood_hazard", "councilname",
        ["hazard_ranking", "hazard_type"],
        lambda a: (a.get("HazardRanking"), a.get("HazardType")))),
```
5. The `_load_council_arcgis()` helper handles pagination, geometry extraction, and insertion
6. Deploy (push to main) — the data sync runs automatically after deploy
7. No migration needed — `flood_hazard` table already exists with `source_council` column
8. Clear Redis cache on server to see changes in reports

9. **Update docs:** Add row to `docs/DATA-CATALOG.md` § DataSources-by-region under the appropriate region

**Common target tables by hazard type:**
- Flood, ponding, overland flow → `flood_hazard`
- Coastal erosion → `coastal_erosion`
- Coastal inundation, sea level rise, storm surge → `coastal_inundation`
- Tsunami → `tsunami_hazard`
- Heritage → `heritage_sites` or `historic_heritage_overlay`
- District plan zones → `district_plan_zones`
- Notable trees → `notable_trees`
- Contaminated land → `contaminated_land`

---

## Recipe: Add a new council rates API

**When:** You want live CV/LV/IV data for a council that doesn't have it yet.

1. Find the council's property search endpoint (ArcGIS FeatureServer with valuation fields)
2. Create `backend/app/services/{council}_rates.py` — copy `pncc_rates.py` as template:
   - Change the URL constant
   - Change the field names (e.g., `LOCATION` → `PropertyAddress`, `CURR_CAPITAL_VALUE` → `CapitalValue`)
   - Change the `_build_search()` address parsing
   - Keep the response format identical: `{"current_valuation": {"capital_value": int, "land_value": int, "improvements_value": int}}`
3. Wire into `backend/app/services/snapshot_generator.py` (~line 310-470):
   - Add an `elif` matching the city name(s)
   - Import and call your fetch function
   - The generic CV override handler at the bottom (~line 460) applies the result
4. Wire into `backend/app/routers/property.py` `_fix_unit_cv()` (~line 47-165):
   - Add the same `elif` block (this makes it work for free reports too)
5. Verify: `python -c "import py_compile; py_compile.compile('backend/app/services/{council}_rates.py', doraise=True)"`
6. Deploy and test with a known address from that council
7. **Update docs:** Add row to `docs/DATA-CATALOG.md` § Live-rates-APIs table

**City matching:** Both wiring points match on `city.lower()` from `report.address.city`. Check what `town_city` value your council's addresses use in the `addresses` table.

---

## Recipe: Add transit (GTFS) for a new city

**When:** A city has a public GTFS feed and you want travel time data.

1. Find the GTFS zip URL (check Trillium Transit, council website, or Transitland)
2. Verify it has `stop_times.txt` (needed for travel time computation)
3. Add destinations to `REGIONAL_DESTINATIONS` dict in `data_loader.py` (~line 2413):
```python
"cityname": {
    "City CBD": (lng, lat),
    "City Hospital": (lng, lat),
    "University": (lng, lat),
    # ... 5-10 destinations within 400m of a transit stop
},
```
4. Add DataSource entry (~line 4577):
```python
DataSource("cityname_gtfs", "City Name GTFS + Travel Times",
    ["transit_stops", "transit_travel_times", "transit_stop_frequency"],
    lambda conn, log=None: _load_regional_gtfs(conn, log,
        "https://gtfs-url.zip", "cityname")),
```
5. Deploy, then trigger load on server:
```bash
ssh wharescore@20.5.86.126 'docker exec -d app-api-1 python -c "
from app.services.data_loader import _load_regional_gtfs, _db_url_to_sync
import psycopg
conn = psycopg.connect(_db_url_to_sync())
_load_regional_gtfs(conn, print, \"https://gtfs-url.zip\", \"cityname\")
conn.close()
"'
```
6. Transit data auto-flows to reports via `get_transit_data()` SQL → `_overlay_transit_data()` Python
7. No migration needed
8. **Update docs:** Add row to `docs/DATA-CATALOG.md` § GTFS-transit table

**Stop ID format:** Regional stops are prefixed: `cityname_12345`. Travel times join on this prefixed ID.

---

## Recipe: Add a field to the property report

**When:** You want the report JSON to include new data.

### If the data comes from an existing table:
1. Edit `migrations/0022_report_missing_layers.sql` — add a LEFT JOIN LATERAL in the appropriate section (hazards/liveability/planning)
2. Add the field to the `jsonb_build_object(...)` for that section
3. Re-apply on production: `cat migrations/0022_report_missing_layers.sql | docker exec -i app-postgres-1 psql -U postgres -d wharescore`
4. Flush Redis cache
5. **DO NOT** create a new migration that calls `CREATE OR REPLACE FUNCTION get_property_report` — this creates an `(INT)` overload that shadows the `(BIGINT)` version. Always edit 0022 in place.

### If the data comes from a Python service:
1. Add the computation in the appropriate `_fix_*()` or `_overlay_*()` function in `property.py`
2. Set the field on `report["section"]["field_name"]` after the SQL report returns
3. Flush Redis cache

### If you want it in the hosted report snapshot too:
1. Add it to the `generate_snapshot()` return dict in `snapshot_generator.py` (~line 1077)
2. Create a new frontend component in `frontend/src/components/report/Hosted*.tsx`
3. Render it in `HostedReport.tsx`

---

## Recipe: Add a section to the hosted report

1. Create `frontend/src/components/report/Hosted{SectionName}.tsx`
2. Accept `snapshot` prop (type from `useReportSnapshot` hook)
3. Read the data from `snapshot.{key}` — check `docs/FRONTEND-WIRING.md` for the full snapshot structure
4. Add it to `frontend/src/components/report/HostedReport.tsx` in the desired position
5. If the data doesn't exist in the snapshot yet, add it to `generate_snapshot()` in `snapshot_generator.py`

---

## Recipe: Debug a report showing wrong data

1. Check if it's cached: `ssh wharescore@20.5.86.126 'docker exec app-redis-1 redis-cli -a $REDIS_PASSWORD GET report:{address_id}'`
2. If cached, flush: `DEL report:{address_id}`
3. Check the raw SQL output: `docker exec app-postgres-1 psql -U postgres -d wharescore -c "SELECT get_property_report({address_id}::bigint)"`
4. If SQL is wrong, check the data tables — the report function does spatial joins within specific radii (400m for transit, 800m for bus stops, 300m for crashes, 500m for heritage, etc.)
5. If CV is wrong, check if the council has a live rates API in `_fix_unit_cv()` — the live API overrides the SQL result
6. If transit is wrong, check `get_transit_data({address_id})` — it tries metlink → AT → regional transit_stops

---

## Recipe: Deploy changes

**Automatic (preferred):**
```bash
git add . && git commit -m "description" && git push origin main
# GitHub Actions runs: pull → docker build --no-cache → restart all services
# Takes ~3-5 minutes. Health check verifies API is responsive.
```

**Manual (if Actions fails or for urgent fixes):**
```bash
ssh wharescore@20.5.86.126
cd /home/wharescore/app
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache api
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

**Run a migration manually:**
```bash
cat migrations/0023_universal_transit.sql | docker exec -i app-postgres-1 psql -U postgres -d wharescore
```

**Check container health:**
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker logs app-api-1 --tail=30
```

---

## Recipe: Load a new DataSource on production

```bash
ssh wharescore@20.5.86.126
docker exec -d app-api-1 python -c "
from app.services.data_loader import run_loader
result = run_loader('source_key_here', print)
print(result)
"
# Monitor: docker logs app-api-1 --tail=20
```

**Check what's loaded:** `docker exec app-postgres-1 psql -U postgres -d wharescore -c "SELECT source, loaded_at FROM data_versions WHERE source = 'source_key'"`

**Force reload (if already loaded):** Delete from `data_versions` first:
```sql
DELETE FROM data_versions WHERE source = 'source_key';
```

---

## Recipe: Fix payment/checkout issues

**Key files:**
- `backend/app/routers/checkout.py` — Stripe session creation, webhook handling
- `frontend/src/components/property/UpgradeModal.tsx` — Purchase modal UI
- `frontend/src/stores/downloadGateStore.ts` — Credit tracking + paywall logic

**Stripe test mode:** All Stripe operations use test keys. Webhook events:
- `checkout.session.completed` → adds credits or fulfills guest purchase
- `invoice.paid` → extends Pro subscription
- `customer.subscription.deleted` → downgrades to free

**Promo codes:** Hardcoded in `account.py` `_PROMO_CODES` dict. Currently: `WHARESCOREJOEL` (1 credit, 999 max uses).

**Guest checkout flow:**
1. User clicks "Continue without account — $4.99"
2. `POST /checkout/guest-session` creates Stripe session + `guest_purchases` DB row
3. After payment, Stripe redirects to `/guest/download?session_id=...`
4. Frontend calls `GET /checkout/guest-token?session_id=...` to get one-time download token
5. Token used to start PDF generation via `POST /property/{id}/export/pdf/guest-start?token=...`

---

## Recipe: Generate SEO suburb guide pages (local LLM)

**When:** You want to populate / refresh the ~2,200 SEO landing pages at `/suburbs/{slug}`.

**Moving parts:**
- Table: `suburb_guide_pages` (migration `backend/migrations/0041_suburb_guide_pages.sql`)
- Generator: `scripts/generate_suburb_guides.py` (calls Ollama + Qwen)
- API: `GET /api/v1/suburbs/guides`, `GET /api/v1/suburbs/guide/{slug}` (`backend/app/routers/suburb_guides.py`)
- Frontend: `frontend/src/app/suburbs/page.tsx`, `frontend/src/app/suburbs/[slug]/page.tsx`
- Sitemap: `frontend/src/app/sitemap.ts`

**Prereqs:**
- Ollama installed, `qwen2.5:14b-instruct` (or `:7b-instruct` on low RAM) pulled
- Migration 0041 applied (auto-runs on backend startup)
- Python 3.14 + `psycopg[binary]` + `requests` installed

**Steps:**
1. Smoke test: `py -3.14 scripts/generate_suburb_guides.py --limit 3 --publish`
2. Read 2-3 generated rows for hallucinations and marketing clichés
3. Full run by TA (resumable via data_hash): `py -3.14 scripts/generate_suburb_guides.py --ta "Wellington City" --publish`
4. Verify: `SELECT status, COUNT(*) FROM suburb_guide_pages GROUP BY status;`
5. Spot-check a page: `curl http://localhost:8000/api/v1/suburbs/guide/<slug>` and `http://localhost:3000/suburbs/<slug>`
6. Submit sitemap in Google Search Console

**Regenerate when:** `mv_rental_market`, `mv_rental_trends`, `mv_crime_ta`, `area_profiles` are refreshed. Hash-based skip ensures only changed suburbs are re-processed.

**Full runbook:** `scripts/RUN-SUBURB-GUIDES.md`

**Docs to update:** `DATA-CATALOG.md` § Major-database-tables (done), `FRONTEND-WIRING.md` § API-endpoints (done).

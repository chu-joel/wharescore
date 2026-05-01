# WhareScore Data Catalog

> Source of truth for all datasets, tables, and data integrations.
> Agents: search by table name, council name, or category. Update this file when adding/changing data.
>
> **Operational view** (where each loader fetches from, cadence class, change-detection method) lives in `DATA-LOADERS.md` — auto-generated from the `DATA_SOURCES` registry by `scripts/dump_data_loaders.py`. Don't duplicate that information here; this doc owns *what tables exist and what they store*, not *how loaders run*.
>
> Cadence: 566 DataSources are now 100% classified. 281 `revisable` (flood, plan zones, heritage, contaminated land — re-check on cadence), 223 `static` (peer-reviewed studies, fault zones, tsunami zones, liquefaction susceptibility — do NOT auto-refresh), 46 `continuous` (rates APIs as lazy-fetch placeholders), 16 `periodic` (GTFS, REINZ HPI). Pattern rules + per-key overrides live in `data_loader.py` `_PATTERN_RULES` / `_NATIONAL_DEFAULTS`. To re-classify a single loader, set the field explicitly on its `DataSource(...)` registration — explicit values always win.
>
> Scheduled refresh is wired up. Daily GH Actions cron (`.github/workflows/data-refresh.yml`) hits `POST /admin/data-sources/refresh-due` → polls upstream metadata → reloads only on change. Validation gate (`loader_freshness.validate_row_count`) refuses reloads where new row count is < 50% of previous (prevents "DELETE 35k INSERT 0" on transient upstream failures). Per-source health tracked in `data_source_health` table (migration 0061). See `SYSTEM-FLOWS.md` § Scheduled Data Refresh for the full flow.
>
> **Op runbook for the scheduler:** before the first auto-run, set `ADMIN_API_TOKEN` in GitHub secrets + `.env.prod`, then trigger `data-refresh.yml` manually with `dry_run=true` to confirm the upstream metadata polls succeed without touching data. Audit `GET /admin/data-sources/health?only_problems=true` afterwards to surface any classification mistakes.
>
> **Upsert-capable loader path** (`_load_council_arcgis_upsert` in `data_loader.py`): an alternative to the default truncate-and-reinsert pattern. When a target table has a `feature_stable_id` column (added per-table by migration — `flood_hazard` is the first, see migration 0063) and a loader is wired to extract a stable ID from the upstream feature, rows are upserted in place: inserts add new features, updates touch only changed rows, deletes remove vanished features, all in one transaction. Per-row diffs land in `data_change_log` with before+after attribute snapshots. No DELETE-then-INSERT inconsistency window. The `auckland_flood` worked example is the first user.
>
> **Safe-migration flag.** New `auto_load_enabled: bool = True` field on `DataSource`. When `False`, the source is registered for inventory but excluded from `load-new`, `reload-all` (without explicit `keys=`), and the cron's `refresh-due`. The single-source `POST /admin/data-sources/{key}/load` endpoint still runs it — operators can fire explicitly. Use `False` for newly-migrated script-based loaders that need verification on prod before they're trusted unattended; flip to `True` once confirmed end-to-end.
>
> **Cron eligibility gate.** `_apply_pattern_defaults` automatically sets `auto_load_enabled=False` on any DataSource where `upstream_url is None` — without a URL, the freshness check has nothing to poll, so the cron would fall through to a full reload every run. **As of 2026-05-01 this leaves only `auckland_flood` and `auckland_flood_sensitive` cron-eligible** — the only two with explicit URLs. To bring more sources online: extract the upstream URL from each loader function, pass it as `upstream_url=...` on the `DataSource(...)` call, and the gate auto-flips.

---

## Live Rates APIs
<!-- UPDATE: When adding a new council rates module, add a row here. -->

25 councils. Live rates are now fetched lazily via `GET /property/{id}/rates` (unified router in `routers/rates.py`). CV no longer blocks the report endpoint — DB value shown first, live value updates inline. `snapshot_generator.py` (~line 309-470) still calls rates directly for snapshot generation.

| # | Council | Module file | City match (lowercase) | Endpoint type | CV | LV | IV | Rates | Floor |
|---|---------|------------|----------------------|--------------|:--:|:--:|:--:|:-----:|:-----:|
| 1 | Wellington | `rates.py` | wellington | WCC API + wcc_rates_cache | Y | Y | Y | Y | - |
| 2 | Auckland | `auckland_rates.py` | auckland | AC rates API. `_best_match()` order: (1) suburb match **macron-folded** via `_fold()` (NFKD strip) — "Tōtara Vale" == "Totara Vale"; (2) exact leading street-number via `_leading_number()` — AC search returns partial-number hits so `pageSize=20` (AC API hard max) + number-equality are both required to avoid "52 Clarence" matching "12 Clarence"; (3) coordinate distance if `addresses.geom` present (note: `db.py` wraps psycopg3 in `_CursorLike` — `fetchone()` is **synchronous**, do NOT `await` it); (4) word-overlap fallback. | Y | Y | Y | Y | Y |
| 3 | Lower Hutt | `hcc_rates.py` | lower hutt | ArcGIS MapServer | Y | Y | Y | Y | - |
| 4 | Upper Hutt | `uhcc_rates.py` | upper hutt | ArcGIS Online | Y | - | - | Y | - |
| 5 | Porirua | `pcc_rates.py` | porirua | ArcGIS MapServer | Y | Y | Y | - | - |
| 6 | Kapiti Coast | `kcdc_rates.py` | kapiti, paraparaumu, waikanae, otaki | ArcGIS MapServer | Y | Y | Y | - | - |
| 7 | Horowhenua | `hdc_rates.py` | horowhenua, levin, foxton | ArcGIS MapServer | Y | Y | Y | - | - |
| 8 | Hamilton | `hamilton_rates.py` | hamilton | ArcGIS FeatureServer | Y | Y | Y | - | - |
| 9 | Dunedin | `dcc_rates.py` | dunedin | ArcGIS MapServer | Y | - | - | - | - |
| 10 | Christchurch | `ccc_rates.py` | christchurch | CCC API + cache | Y | Y | Y | Y | - |
| 11 | New Plymouth | `taranaki_rates.py` | new plymouth | ArcGIS FeatureServer | Y | Y | Y | - | - |
| 12 | Tasman | `tasman_rates.py` | richmond, motueka, takaka, mapua | ArcGIS MapServer | Y | Y | Y | - | - |
| 13 | Tauranga | `tcc_rates.py` | tauranga, mount maunganui | ArcGIS 2-step | Y | Y | Y | Y | - |
| 14 | Western BOP | `wbop_rates.py` | katikati, te puke, waihi beach, ōmokoroa, paengaroa, western bay | ArcGIS 3-layer | Y | Y | Y | - | - |
| 15 | Palmerston Nth | `pncc_rates.py` | palmerston | ArcGIS Online | Y | Y | - | Y | - |
| 16 | Whangarei | `wdc_rates.py` | whangarei, whangārei | ArcGIS MapServer | Y | Y | Y | - | Y |
| 17 | Queenstown | `qldc_rates.py` | queenstown, wanaka, arrowtown, frankton, cromwell, alexandra | ArcGIS FeatureServer | Y | Y | Y | - | - |
| 18 | Invercargill | `icc_rates.py` | invercargill | ArcGIS MapServer | Y | Y | Y | - | Y |
| 19 | Hastings | `hastings_rates.py` | hastings, havelock north, flaxmere | ArcGIS MapServer | Y | Y | Y | - | - |
| 20 | Gisborne | `gdc_rates.py` | gisborne | ArcGIS Online | Y | Y | Y | Y | - |
| 21 | Nelson | `ncc_rates.py` | nelson | MagiqCloud scraping | Y | Y | Y | Y | - |
| 22 | Rotorua | `rlc_rates.py` | rotorua | ArcGIS Online | Y | Y | Y | Y | - |
| 23 | Timaru | `timaru_rates.py` | timaru, temuka, geraldine | ArcGIS MapServer | Y | Y | Y | - | - |
| 24 | Marlborough | `mdc_rates.py` | blenheim, marlborough, picton, renwick | ArcGIS MapServer | Y | Y | Y | - | - |
| 25 | Whanganui | `wdc_whanganui_rates.py` | whanganui, wanganui | GeoServer WFS 2-step — WDC renamed `address` → `full_address` AND dropped `prop_no` from property_addresses (both fixed 2026-04-21). Step 2 now does a bbox spatial intersect on property_values.geom (~20m tolerance) because there's no explicit join key left. DescribeFeatureType is the canonical schema probe if WDC shifts things again. | Y | Y | Y | - | - |

**Floor area column** — `Y` means the rates API returns per-unit valued floor area and the module surfaces it as `total_floor_area_sqm` in the response dict. `_fix_unit_cv()` and `snapshot_generator.py` write that back to `report.property.floor_area_sqm`, which the frontend `resolveFloorArea()` helper prefers over the shared LINZ `footprint_sqm` polygon. Essential for cross-lease / semi-detached addresses - without it, every unit shows the same whole-building footprint. Schemas introspected on all 25 councils 2026-04-21; only AKCC / WDC / ICC expose the field.

**Not covered:** Napier (no public API — uses bulk council_valuations fallback)

---

## GTFS Transit
<!-- UPDATE: When adding a new GTFS city, add a row here and update REGIONAL_DESTINATIONS in data_loader.py. -->

12 cities. Data in `transit_stops` + `transit_travel_times` + `transit_stop_frequency` (regional), `at_stops/*` (Auckland), `metlink_stops` (Wellington). Query chain: `get_property_report()` SQL → metlink only → `_overlay_transit_data()` Python → `get_transit_data()` SQL → metlink → AT → regional.

| City | DataSource key | GTFS URL | Stops | Destinations | Travel times |
|------|---------------|----------|-------|-------------|-------------|
| Auckland | `at_gtfs` | `https://gtfs.at.govt.nz/gtfs.zip` | 7,023 | 11 | ~6,800 |
| Wellington | `metlink_gtfs` | `https://static.opendata.metlink.org.nz/v1/gtfs/full.zip` | 3,154 | 12 | ~7,200 |
| Hamilton | `hamilton_gtfs` | `https://wrcscheduledata.blob.core.windows.net/wrcgtfs/busit-nz-public.zip` | 1,570 | 9 | 2,568 |
| Tauranga/BOP | `tauranga_bop_gtfs` | `https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip` | 1,198 | 10 | 1,130 |
| Dunedin | `dunedin_gtfs` | `https://www.orc.govt.nz/transit/google_transit.zip` | 907 | 8 | 2,374 |
| Hawke's Bay | `hawkes_bay_gtfs` | `https://data.trilliumtransit.com/gtfs/hbrc-nz/hbrc-nz.zip` | 461 | 8 | 868 |
| Palmerston Nth | `palmerston_north_gtfs` | `https://www.horizons.govt.nz/HRC/media/Data/files/tranzit/HRC_GTFS_Production.zip` | 885 | 6 | 808 |
| Nelson | `nelson_gtfs` | `https://data.trilliumtransit.com/gtfs/nsn-nz/nsn-nz.zip` | 231 | 6 | 580 |
| Rotorua | `rotorua_gtfs` | `https://data.trilliumtransit.com/gtfs/boprc-nz/boprc-nz.zip` | 1,198 | 6 | 376 |
| Whangarei | `whangarei_gtfs` | `https://data.trilliumtransit.com/gtfs/nrc-nz/nrc-nz.zip` | 273 | 6 | 354 |
| Taranaki | `taranaki_gtfs` | `https://data.trilliumtransit.com/gtfs/trc-nz/trc-nz.zip` | 386 | 6 | 326 |
| Queenstown | `queenstown_gtfs` | `https://www.orc.govt.nz/transit/google_transit.zip` | 907 | 7 | 248 |

**Not covered:** Christchurch (GTFS needs API key from apidevelopers.metroinfo.co.nz), Invercargill (no GTFS feed)

---

## Major Database Tables
<!-- UPDATE: When creating a new table, add it here with columns and source. -->

**126 tables total.** Only tables with >100 rows or referenced by report function listed. Full schema: `docs/table_schemas.txt`. Note: `_fetch_url()` returns bytes — decode with `utf-8-sig` for CSV sources (BOM handling). Martin tile functions use `ST_TileEnvelope` (EPSG:3857) — filter with `ST_Transform(bounds, 4326)` and output with `ST_Transform(geom, 3857)` since our tables store 4326. Functions are `CREATE OR REPLACE` — editing the migration file alone won't update prod. Must re-run the SQL manually or restart after re-applying. Notable places limits cafes/restaurants to 15 per tile. Includes schools from `schools` table (2,568), museums, galleries, cinemas, theatres, fuel, banks, fitness centres. Priority tiers: essentials(1) > health(2) > culture/green(3) > community(4) > services(5) > food(6).

| Table | ~Rows | Key columns | Populated by | Queried by |
|-------|-------|------------|-------------|-----------|
| addresses | 2.4M | address_id, full_address, suburb_locality, town_city, geom, search_vector | LINZ bulk | Everything (PK for all spatial) |
| flood_hazard | 6.1M | hazard_type, hazard_ranking, source_council, geom | 63 council DataSources | `get_property_report()` → hazards.council_flood_* |
| parcels | 4.3M | geom | LINZ Parcels | Parcel boundary rendering |
| building_outlines | 3.2M | use, geom (footprint) | LINZ Building Outlines | `get_property_report()` → property.footprint_sqm |
| climate_projections | 2.6M | 61 climate variables per grid cell | NIWA | `get_property_report()` → environment.climate_* |
| property_titles | 2.4M | title_no, estate_description, geom | LINZ Titles | `get_property_report()` → property.title_* |
| council_valuations | 1.7M | capital_value, land_value, improvements_value, geom | 40+ council DataSources | `get_property_report()` → property.capital_value (base, before live API override) |
| bonds_detailed | 1.2M | sa2_code, dwelling_type, bedrooms, median_rent, quarter_end | MBIE Tenancy Bonds | Market endpoint, rent advisor, snapshot rent_baselines |
| crime | 1.2M | year_month, meshblock, anzsoc_*, victimisations | NZ Police | `get_property_report()` → liveability.crime_*, crime-trend |
| crashes | 904K | crash_year, crash_severity, geom | Waka Kotahi CAS | `get_property_report()` → liveability.crashes_300m |
| slope_failure | 470K | lskey, severity, source_council, geom | GWRC + ~6 council DataSources | `get_property_report()` → hazards.council_slope_severity (all cities) + hazards.gwrc_slope_severity (Wellington) |
| liquefaction_detail | ~50K | liquefaction, simplified, source_council, geom | GWRC + ~16 council DataSources | `get_property_report()` → hazards.council_liquefaction (all cities) + hazards.gwrc_liquefaction (Wellington) |
| tsunami_hazard | ~10K | name, hazard_ranking, scenario, return_period, layer_id, source_council, geom | WCC + ~12 council DataSources | `get_property_report()` → hazards.council_tsunami_ranking (all cities) + hazards.wcc_tsunami_return_period (Wellington) |
| landslide_susceptibility | ~5K | accuracy, type, source_council, geom | GWRC + Auckland DataSources | `get_property_report()` → hazards.landslide_susceptibility_rating (worst rating) |
| district_plan_zones | 198K | zone_name, zone_code, category, source_council, geom | 20+ council DataSources. `category` is either supplied directly by the loader (Auckland uses GROUPZONE coded-value domain) or derived from `zone_name` text by `_derive_zone_category()` in `data_loader.py` (CHC, QLDC, etc.). QLDC's ArcGIS feed has no distinct short code so `zone_code` is NULL for queenstown_lakes rows. | `get_property_report()` → planning.zone_* (subquery prefers rows with non-null name, code, then category) |
| noise_contours | ~222K | laeq24h, geom | Waka Kotahi NZTA | `get_property_report()` → liveability.noise_db. Migration 0050 DELETEs the ~6k rows where `ST_IsValid(geom)` is false — ST_MakeValid itself segfaults postgres on a subset (one polygon near Auckland airport crashed the `mv_sa2_comparisons` rebuild). Statistical impact on max_noise_db per SA2 is negligible. |
| osm_amenities | 95K | name, subcategory, brand, geom | OpenStreetMap | nearby/highlights, snapshot nearby_highlights |
| schools | 2,568 | name, type, decile, eqi_rating, roll, geom | MoE | `get_property_report()` → liveability.school_count |
| active_faults | 10.3K | fault_name, fault_class, slip_rate, geom | GNS Science | `get_property_report()` → hazards.active_fault_nearest |
| heritage_sites | 7,360 | name, category, geom | Heritage NZ + councils | `get_property_report()` → planning.heritage_count |
| transit_stops | 11.1K | stop_id, stop_name, mode_type, source, geom | Regional GTFS | `get_transit_data()` → liveability.bus/rail/ferry_stops |
| transit_travel_times | 16.2K | stop_id, destination, min_minutes, route_names, peak_window | Regional GTFS | `get_transit_data()` → liveability.transit_travel_times |
| metlink_stops | 3,154 | stop_id, route_types[], geom | Metlink GTFS | `get_property_report()` SQL (Wellington direct) |
| census_demographics | ~2,400 | sa2_code, population_2023, median_age, ethnicity_*, born_* | Stats NZ Census 2023 ArcGIS | `prefetch_property_data()` → snapshot.census_demographics |
| census_households | ~2,400 | sa2_code, income_median, tenure_*, vehicles_*, internet_*, rent_median | Stats NZ Census 2023 ArcGIS | `prefetch_property_data()` → snapshot.census_households |
| census_commute | ~2,300 | sa2_code, work_at_home, drive_private, public_bus, train, bicycle, walk_or_jog | Stats NZ Census 2023 CSV | `prefetch_property_data()` → snapshot.census_commute |
| climate_normals | ~720 | location_name, ta_name, month, temp_mean/max/min, precipitation_mm, rain_days, wind_speed_mean | Open-Meteo Climate API (2010-2019 daily → monthly avg). sunshine_hours not available. | `prefetch_property_data()` → snapshot.climate_normals |
| business_demography | ~2,300 | sa2_code, employee_count_2024, business_count_2024, employee_growth_pct | Stats NZ Business Demography 2024 ArcGIS | `prefetch_property_data()` → snapshot.business_demography |
| fibre_coverage | ~2,360 | sfa_name, provider, geom (MultiPolygon 4326) | Commerce Commission SFA 2025 GPKG. **SRID fix applied 2026-04-08** — original load had NZTM (2193) coords stored as 4326, causing all spatial queries to return empty. Migration 0043 auto-fixes if not already corrected. | `community_facilities` snapshot → fibre_available, fibre_provider |
| sa2_concordance | ~2,117 | census_sa2_code, census_sa2_name, boundary_sa2_code, match_type | Migration 0042. Maps 2023 census SA2 codes to 2018 boundary SA2 codes via code/name/fuzzy match (91.6% coverage). **Hotfix 2026-04-08:** corrected column names (age_under_15 not age_0_14, age_15_to_29 not age_15_29, age_30_to_64 not age_30_64). | Used by v_census_by_boundary, v_census_households_by_boundary, v_census_commute_by_boundary views. Snapshot generator falls back to these views. |
| cycleways | ~TBD | name, surface, geom (linestring) | OSM Overpass API (16 cities). WKT uses comma-separated coords. Uses SAVEPOINT per insert for error isolation. | `community_facilities` snapshot → cycleway_km_2km |
| at_stops | 7,023 | stop_id, route_types[], geom | AT GTFS | `get_transit_data()` (Auckland fallback) |
| report_snapshots | per-report | snapshot_json (JSONB), share_token_hash, inputs_at_purchase, report_tier ('quick'/'full') | `create_report_snapshot()` | `/report/{token}` endpoint, `POST /report/{token}/upgrade` |
| user_rent_reports | growing | address_id, building_address, sa2_code, dwelling_type, bedrooms, reported_rent, is_outlier, ip_hash, bathrooms, finish_tier, has_parking, is_furnished, is_partially_furnished, has_outdoor_space, is_character_property, shared_kitchen, utilities_included, not_insulated, source_context, notice_version, reported_at | `POST /rent-reports` via `RentComparisonFlow` (core trio) and `RentAdvisorCard` (richer details). Upserts within 24h (ip_hash, address_id) window — same user enriches one row rather than creating duplicates. 20/day per IP rate limit. 5-layer validation (hard bounds, SA2 deviation outlier, bedroom coherence, rate limit, progressive-merge). Migration 0059 added the richer fields. | `GET /rent-reports/{id}` for community building averages (3+ non-outlier threshold); future rent advisor enrichment. Privacy: no identity stored — hashed IP only. First-visit `RentDataNotice` banner informs users. |
| mbie_epb_history | ~8,400 (~5,940 active + ~2,460 historical delistings) | id (UUID PK), earthquake_rating, completion_deadline, construction_type, design_date, seismic_risk_area, region, geom, first_seen_at, last_seen_at, removed_at, has_been_removed, raw_json | `data_loader.py::load_mbie_epb_national` (DataSource key `epb_mbie`, triggered via admin UI button, `POST /admin/data-sources/epb_mbie/load`, or the bulk `POST /admin/data-sources/reload-all`). Fetches `https://epbr.building.govt.nz/api/public/buildings?export=all&filter.hideRemoved=false` — single ~13MB call, no auth. **Do NOT use `?page=N` — the paginated endpoint is broken unless you use dot-notation `paging.index` / `paging.size`; see `docs/WELLINGTON-DATA-SOURCES.md`.** UPSERT on id; `has_been_removed` set when `noticeStatus == "Removed"` (export shape) or `hasBeenRemoved==true` (paginated shape). `raw_json` captures the full payload. Removed buildings retain full detail fields (constructionType etc.) because the export includes them. Migration 0057 added the soft-delete columns and renamed the old `mbie_epb` table. Loader guard: raises if fetch returns <7,000 rows. | `mbie_epb` **view** (rows WHERE removed_at IS NULL AND has_been_removed = FALSE) queried by `get_property_report()` → `hazards.epb_count_300m`, `hazards.epb_nearest`. `_overlay_former_epb_data()` in `routers/property.py` queries `mbie_epb_history` WHERE `has_been_removed = TRUE` to produce `hazards.former_epb_at_property` and `hazards.former_epb_count_300m`. |
| hpi_national | 143 | quarter_end, house_price_index, house_sales | RBNZ M10 | Report market section (charts only — no longer used by price_advisor) |
| rbnz_housing | 143 | quarter_end, house_price_index, house_sales, housing_stock_value_m | RBNZ M10 | Source for hpi_national. No longer queried by price_advisor — see reinz_hpi_ta. |
| reinz_hpi_ta | 73 rows per month | ta_name, month_end, hpi, change_1m_pct, change_3m_pct, change_1y_pct, change_5y_cgr_pct, calculated | REINZ Monthly HPI Report PDF (manual upload per month) | `price_advisor.py` — 5yr-CGR back-calculation from reval date. Replaces `rbnz_housing` national series which misrepresented regional markets (national -0.6%/5yr vs Chch +4.7%/5yr). Seeded with Mar 2026; upload new months via admin. TAs without movement columns fall back to 1yr change or skip HPI step. |
| data_versions | 366 | source, loaded_at | data_loader.py | Track which DataSources loaded |
| srtm_elevation | 0 (until loaded via `load_srtm_postgis.py`) | rast (raster), rid | SRTM 30m tiles (68 .hgt files) | `walking_isochrone.py` → snapshot terrain |
| app_events | growing | event_type, created_at, user_id, session_id, ip_hash, properties (JSONB) | `event_writer.py` | Admin analytics dashboard (90-day retention) |
| perf_metrics | growing | method, path, path_template, status_code, duration_ms, request_id | `request_metrics.py` middleware | Admin performance dashboard (30-day retention) |
| error_log | growing | category, level, message, traceback, request_id, path, properties (JSONB) | `event_writer.py` log_error() | Admin error tracking (90-day retention) |
| daily_metrics | growing | day (PK), metric_name (PK), metric_value, properties (JSONB) | `event_writer.py` midnight aggregation | Pre-aggregated rollups for admin dashboard (2-year retention) |
| suburb_guide_pages | ~2,200 | sa2_code (UK), slug (UK), suburb_name, ta_name, title, meta_description, h1, intro, sections (JSONB), faqs (JSONB), key_stats (JSONB), internal_links (JSONB), data_hash, status | `scripts/generate_suburb_guides.py` (local Qwen via Ollama) | `GET /suburbs/guide/{slug}`, `GET /suburbs/guides`, `sitemap.ts` |

---

## Seeded service accounts
<!-- UPDATE: When adding a service account for tooling (verify, iterate, smoke tests, etc.), add a row here. -->

Service accounts are seeded rows in `users` + `report_credits` used by automated tooling to exercise authenticated endpoints without Stripe. Each is documented here so the row's intent is legible and revocable.

| user_id | plan | credit_type | daily_limit | monthly_limit | Purpose | Seeded by |
|---------|------|-------------|-------------|---------------|---------|-----------|
| `verify-dev-service-account` | pro | pro | 20 | 200 | `/verify` + `/iterate` skills use this account via `backend/scripts/mint-dev-jwt.py` to mint 1-hour HS256 JWTs against `AUTH_SECRET`. Bypasses Stripe, exercises authed endpoints, generates test reports. Caps protect against runaway generation. | migration `0053_verify_dev_user.sql` |

**Revoke:** a follow-up migration can `UPDATE users SET plan='free' WHERE user_id='verify-dev-service-account'` — or set `daily_limit=0` in `report_credits`. Rotating `AUTH_SECRET` invalidates every user's JWT; don't use that as a revocation mechanism.

**Column name — users.user_id, not clerk_id.** Migration 0008 renamed `clerk_id → user_id` across `users`, `report_credits`, and `saved_reports` when auth moved from Clerk to Auth.js. Any new migration that seeds rows into these tables MUST use `user_id`. Migration 0053 was originally written against the pre-0008 schema and crashed `migrate.py` on boot with `column "clerk_id" of relation "users" does not exist` until it was fixed.

**report_credits schema reminders for new migrations:**
- `credits_remaining INT NOT NULL DEFAULT 0` — never insert `NULL`. Pro plans use daily/monthly caps, not a balance; use `0`.
- `report_tier TEXT NOT NULL DEFAULT 'full'` (added in 0026, check constraint `report_tier IN ('quick','full')`) — set explicitly when you want a specific tier; relying on the default locks you to `'full'`.
- Any seeded row also carries `purchased_at` (DEFAULT `now()`), `cancelled_at` (nullable), and `stripe_subscription_id` (use `'verify-dev-none'` sentinel for service accounts — not a real Stripe ID).

Both of these bit 0053 in sequence: the initial version used `clerk_id`, the first fix used `user_id` but forgot `credits_remaining NOT NULL` + the 0026-added `report_tier` column. Future seed migrations: enumerate EVERY non-null column of the target table and set it explicitly.

---

## DataSources by Region
<!-- UPDATE: When adding a DataSource to data_loader.py, add it to the appropriate region section below. -->

530 total in `data_loader.py`. Full machine-readable list: `docs/datasources_raw.txt`. Below grouped by region with target table.

### National
| Key | Description | Target table(s) |
|-----|------------|----------------|
| linz_waterways | LINZ NZ Waterways (Topo50 rivers, streams, drains) | nz_waterways |
| gns_active_faults | GNS Active Faults 1:250K | active_faults, fault_avoidance_zones |
| gns_landslides | GNS Landslide Database | landslide_events, landslide_areas |
| epb_mbie | MBIE National EPB Register (active + historical delistings) | mbie_epb_history |
| nzta_noise_contours | Waka Kotahi road noise | noise_contours |
| school_zones | MoE enrolment schemes | school_zones |
| coastal_elevation | Coastal elevation grid | coastal_elevation |
| erosion_prone_land | GWRC erosion prone | erosion_prone_land |
| corrosion_zones | Corrosion zone map | corrosion_zones |
| coastal_inundation | National coastal inundation | coastal_inundation |

### Wellington Region (~25 DataSources)
| Key | Target table |
|-----|-------------|
| wcc_hazards | fault_zones, flood_hazard, tsunami_hazard |
| wcc_solar | wcc_solar_radiation |
| contaminated_land | contaminated_land |
| epb_wcc | earthquake_prone_buildings |
| district_plan | district_plan_zones (WCC ArcGIS `Category` field returns the literal string "Zone" for MRZ — loader now falls back to `_derive_zone_category(zone_name)` when the feed value is missing, equals the zone name, or is "Zone", so DB rows land as "Residential" / "Business" / etc.) |
| height_controls | height_controls |
| gwrc_earthquake | earthquake_hazard, ground_shaking, liquefaction_detail, slope_failure |
| gwrc_landslide | landslide_susceptibility |
| gwrc_flood_extents | flood_extent |
| gwrc_flood_1pct | flood_hazard |
| gwrc_tsunami | tsunami_hazard |
| gwrc_storm_surge_* | coastal_inundation |
| viewshafts | viewshafts |
| character_precincts | character_precincts |
| rail_vibration | rail_vibration |
| metlink_gtfs | metlink_stops, transit_travel_times, transit_stop_frequency |
| wcc_heritage, wcc_heritage_areas | heritage_sites |
| wcc_notable_trees | notable_trees |
| kapiti_*, porirua_* | flood_hazard, district_plan_zones, heritage_sites |

### Auckland (~30 DataSources)
| Key | Target table |
|-----|-------------|
| auckland_flood | flood_hazard (hazard_type='1%', depth-tiered ranking — authoritative 1% AEP / 1-in-100yr). Endpoint: AC `Flood_Prone_Areas` FeatureServer/0. Tagging is set in `data_loader.py::load_auckland_flood`. |
| auckland_flood_sensitive | flood_hazard (hazard_type='Flood Sensitive', ranking='Low' — modelled future-scenario screening, NOT a validated flood zone; capped at `low` tier in `getFloodTier`). Endpoint: AC `Flood_Sensitive_Areas` FeatureServer/0. Re-running this loader on prod is required after deploy to re-tag pre-existing rows. |
| auckland_coastal | coastal_inundation |
| auckland_liquefaction | liquefaction_detail |
| auckland_landslide | landslide_susceptibility |
| auckland_tsunami | tsunami_hazard |
| auckland_plan_zones | district_plan_zones |
| auckland_heritage, auckland_heritage_extent | historic_heritage_overlay, heritage_extent |
| auckland_aircraft_noise | aircraft_noise_overlay |
| auckland_notable_trees | notable_trees |
| auckland_ecological | significant_ecological_areas |
| auckland_special_character | special_character_areas |
| auckland_overland_flow | overland_flow_paths |
| auckland_stormwater | stormwater_management_area |
| auckland_parks | park_extents |
| auckland_mana_whenua | mana_whenua_sites |
| auckland_geotech | geotechnical_reports |
| auckland_coastal_erosion | coastal_erosion |
| at_gtfs | at_stops, at_travel_times, at_stop_frequency |

### Canterbury/Christchurch (~25 DataSources)
Keys: `chch_*`, `ecan_*`, `waimakariri_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, heritage_sites, notable_trees, liquefaction (9 district-level), tsunami_hazard.

`chch_tsunami` uses the CCC Civil Defence **evacuation-zone** layer (`WaterCharacteristic/FeatureServer/43`), not the district-plan modelled-inundation layer. ZoneType maps Red→High, Orange→Medium, Yellow→Low; "No Zone" features are skipped. Previous wiring used `GCSP/FeatureServer/23` and hard-coded every feature as `hazard_ranking='High'`, producing false tsunami warnings for properties officially designated "No Zone".

`ecan_tsunami` (regional ECan layer for wider Canterbury) had the same bug — Status field's raw Red/Orange/Yellow/No Zone values were landing verbatim in `hazard_ranking`. Now mapped the same way: Red→High, Orange→Medium, Yellow→Low; "No Zone"/"Nil"/empty skipped. When re-running after the fix, `_load_council_arcgis` deletes the orphan `source_council='canterbury'` rows before re-inserting.

### Waikato/Hamilton (~15 DataSources)
Keys: `hamilton_*`, `waikato_*`, `waipa_*`. Tables: flood_hazard, district_plan_zones, heritage_sites, notable_trees, liquefaction.

### Bay of Plenty/Tauranga (~12 DataSources)
Keys: `tauranga_*`, `bop_*`. Tables: flood_hazard, coastal_erosion, district_plan_zones, heritage_sites, liquefaction, tsunami_hazard, contaminated_land.

### Otago/Dunedin/Queenstown (~17 DataSources)
Keys: `dunedin_*`, `qldc_*`, `orc_*`, `otago_*`. Tables: flood_hazard, coastal_erosion, district_plan_zones, heritage_sites, liquefaction_detail (`orc_liquefaction_otago`), avalanche, debris, tsunami_zones.

### Hawke's Bay (~20 DataSources)
Keys: `hbrc_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, liquefaction_detail, tsunami_hazard, contaminated_land, earthquake amplification, earthflow, gully, landslide.

### Nelson/Tasman (~20 DataSources)
Keys: `nelson_*`, `tasman_*`. Tables: flood_hazard, coastal_inundation, district_plan_zones, heritage_sites, liquefaction_detail, slope_failure, notable_trees, tsunami_hazard.

### Southland/Invercargill (~12 DataSources)
Keys: `southland_*`, `invercargill_*`. Tables: flood_hazard, coastal_erosion, coastal_inundation, district_plan_zones, heritage_sites, liquefaction_detail (`invercargill_liquefaction`), tsunami_zones.

### Marlborough/Blenheim (~12 DataSources)
Keys: `marlborough_*`. Tables: flood_hazard, liquefaction_detail (zones A-F), tsunami_hazard, coastal_inundation, district_plan_zones (`marlborough_plan_zones`), notable_trees (`marlborough_notable_trees`), slope_failure (`marlborough_steep_erosion`).

### Whanganui (~16 DataSources, via GeoServer WFS)
Keys: `whanganui_*`. Base: `https://data.whanganui.govt.nz/geoserver/ows`. Tables: flood_hazard (risk areas A/B), liquefaction_detail (high/moderate/low), tsunami_hazard (red/orange/yellow zones), slope_failure (land stability A/B), district_plan_zones, heritage_sites, notable_trees, coastal_erosion. Uses `_load_council_wfs()` helper (not ArcGIS).

### Horizons/Manawatu (~10 DataSources)
Keys: `horizons_*`, `pncc_*`. Tables: flood_hazard (200yr modelled + observed + floodways + lahar), coastal_erosion, liquefaction_detail, tsunami_hazard. Covers Whanganui + Palmerston North + surrounding region.

### Other Regions
Northland/Whangarei (~10), Gisborne (~7), Taranaki (~8), West Coast (~5). Each follows same pattern → flood_hazard + district_plan_zones + heritage + regional hazards.

### Rates/Valuations (~45 DataSources)
Keys: `*_rates`. All write to `council_valuations` table. Separate from live rates APIs above — these are bulk-loaded spatial datasets used as fallback when no live API exists.

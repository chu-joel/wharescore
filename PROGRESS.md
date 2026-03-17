# WhareScore POC — Progress & Continuation Guide

**Last Updated:** 2026-03-17 (session 37 — PDF premium overhaul + GNS landslide data + renter/buyer insights)
**Purpose:** Resume the proof-of-concept setup in a new context window.

---

## What This Project Is

A NZ property intelligence platform — "Everything the listing doesn't tell you." Enter any NZ address, get hazard exposure, deprivation scoring, flood zone status, crime data, school quality, commute times, and fair price analysis. Built entirely from free NZ government open data.

**Full product vision and 100 prioritised ideas:** `D:\Projects\Experiments\_bmad-output\brainstorming\brainstorming-session-2026-02-11.md`

---

## Current Status

**Session 37 (2026-03-17) — PDF premium overhaul + GNS landslide data + renter/buyer insights.**

### What Was Done This Session

**(A) PDF Report — Premium Overhaul (10 phases from PDF-REPORT-PLAN.md):**

1. **Renter/Buyer Perspective System** — `_build_audience_callouts()` function generates audience-specific insight callouts across all 5 sections. Buyers get teal-bordered boxes (🏠), renters get blue-bordered boxes (🔑). Rules cover: flood zones, liquefaction, slope failure, tsunami, EPBs, noise, contamination, schools, crime, NZDep, rental yield, CAGR trends, consents, infrastructure, heritage, EPB listing.

2. **Property & Valuation** — SVG donut chart showing land/improvements CV split + 2-column fact grid (land value, improvements, land area, footprint, title type, title number).

3. **Score Overview** — "What This Means" contextual summary box with 5-tier interpretation based on composite score.

4. **Environment Sub-sections** — Air quality trend indicator card (colored circle + arrow), water quality A-E grade bar (SVG), contamination proximity card (distance circle with color coding).

5. **Road Safety** — Crash dot SVG visualization (red=fatal, orange=serious, gray=minor) with legend and summary text.

6. **Amenities** — Horizontal bar chart (inline SVG) sorted by count, replacing plain table.

7. **Infrastructure** — Timeline cards with colored sector dots (Transport=blue, Water=cyan, Healthcare=green, Education=purple), status badges, value ranges.

8. **Key Questions** — Numbered badge cards with contextual fallback questions based on property data (flood, EPB, noise, body corporate).

9. **Methodology** — Stacked weight bar SVG (5 colored segments: Hazards 30%, Liveability 25%, Environment/Market/Planning 15% each) + score interpretation gradient scale with property marker.

10. **Global Polish** — Section dividers, break-inside-avoid on all cards, print CSS.

**(B) GNS Landslide Database — Full Stack Integration:**

- **Data downloaded:** 628 landslide point events + 157 polygon outlines from GNS WFS (`maps.gns.cri.nz`) for Wellington region. 331 rainfall-triggered (53%), 78 earthquake, 215 unknown.
- **Database:** `landslide_events` + `landslide_areas` tables with GIST indexes. SQL: `sql/11-landslides.sql`, loader: `scripts/load_landslides.py`.
- **Report function:** `sql/07-report-function.sql` — 3 new LATERAL subqueries: `landslide_count_500m`, `landslide_nearest` (with trigger, severity, damage, distance), `landslide_in_area` (boolean).
- **Frontend types + transform:** `landslide_count_500m`, `landslide_nearest`, `landslide_in_area` on HazardData.
- **Frontend findings:** `FindingCard.tsx` generates warnings for nearby landslides (with trigger type context) and critical for properties within mapped areas.
- **PDF report:** Landslide History row in hazards table + detail card + warning card. Insights for 1+ and 3+ events.
- **Map:** `landslide_events` (orange points) + `landslide_areas` (orange polygons) in Hazards group. Martin configs updated (all 3 environments). Layer styles in `layerStyles.ts`.
- **Test results:** Address 1671902: 3 landslides within 500m. Address 1753062: 1 landslide (earthquake, 293m).

**(C) Bug Fixes:**
- Fixed Jinja2 `| default(0)` not handling None values — `default` only works for undefined variables, not None. Changed to explicit `if is not none else 0` pattern in crime percentile and contamination distance.
- Fixed `_score_to_rating()` crash when score is None — added None guard.
- Added safe numeric conversion helpers (`_safe_int`, `_safe_float_val`) for all computed values in the render function.

**(D) New files created:**
- `sql/11-landslides.sql` — landslide table schema
- `scripts/load_landslides.py` — GNS data loader (psycopg3)
- `data/landslides/landslide_points_wellington.geojson` — 628 events (469KB)
- `data/landslides/landslide_polygons_wellington.geojson` — 157 areas (153KB)

**(E) Tables now: 46 + 5 materialized views. ~19.4M+ records.**

### What Needs To Be Done Next

- **Area profiles batch generation** — `area_profiles` table exists (0 records), needs Azure OpenAI batch job for ~2,171 SA2 descriptions
- **Additional landslide sources** — GNS SLIDE Project (rainfall probability surfaces, requires email to GNS), SlideNZ/EIL (earthquake probability at return periods)
- **National landslide coverage** — current data is Wellington region only. Could pull national data from same GNS WFS
- **Comparisons backend** — suburb/city average computation endpoint still needed for full ComparisonBars functionality
- **Docker/deployment** — rebuild images with new tables and report function

---

**Session 36 (2026-03-16) — Massive visual premium overhaul across frontend + PDF.**

### What Was Done In Session 36

**(A) Frontend — Smart Report Ordering:**
- `sectionRelevance.ts` — scores 5 accordion sections (0-100) by data interest, sorts descending
- `ReportAccordion.tsx` — reorders by relevance, auto-opens top section, "Most relevant" badge
- `PropertyReport.tsx` — computes + passes relevance

**(B) Frontend — Score Component Visual Upgrades:**
- `ScoreGauge.tsx` — rating color arc, glow effect, outer dashed ring, "56 Moderate Risk" label
- `ScoreStrip.tsx` — true circles, connecting line, ring + shadow, hover scale
- `IndicatorCard.tsx` — gradient bars (teal → rating color), endpoint dot, risk-level icons
- `globals.css` — fade-in-up animations with stagger, card hover translateY, gradient section dividers

**(C) Frontend — Charts + Section Upgrades:**
- `RentHistoryChart.tsx` — dashed grid, 1200ms animation, active dot, current median ReferenceLine
- `HPITrendChart.tsx` — dashed grid, animation, peak ring effect
- `RiskHazardsSection.tsx` — thicker critical borders, pulsing dot for score ≥80, green no-risk banner
- `FindingCard.tsx` — fade-in-up stagger, critical gradient background
- `NearbyHighlights.tsx` — fade-in-up stagger, rounded-full icons

**(D) Frontend — New Data Visualizations:**
- `CategoryRadar.tsx` — Recharts radar chart of 5 category scores
- `MarketHeatBadge.tsx` — thermometer pill badge (cold→hot)
- `CrimeCard.tsx` — percentile gauge, severity label, victimisation stats, city comparison
- `NoiseLevelGauge.tsx` — 5-zone dB meter with marker
- `ClimateForecastCard.tsx` — temp change + precip change cards
- `SolarPotentialCard.tsx` — kWh/yr display with progress bar
- `CoverageRing.tsx` — SVG donut replacing plain coverage text
- `EarthquakeDetailCard.tsx` — seismic profile with hazard grade, fault zone, gauge

**(E) Frontend — Freemium Gating:**
- `ReportUpsell.tsx` — teaser cards for gated content (findings, AI, comparisons, checklist, sections)
- `FloatingReportButton.tsx` — sticky bottom-left FAB via createPortal, 3 states (Get/Generating/Open)
- `KeyFindings.tsx` — shows first 2 findings free, gates the rest with severity count teaser
- `ReportAccordion.tsx` — shows 4 free indicators per section, blurs rest with gradient overlay + upsell
- `PropertyReport.tsx` — AI summary, comparisons, checklist gated with upsell cards
- Removed `PdfReadyModal` from 4 components (only floating button handles PDF now)
- Removed toast notifications from `usePdfExport` hook

**(F) Frontend — Data Pipeline Fixes:**
- `transformReport.ts` — synthesizes `transport` and `market` categories from indicators when backend doesn't provide them (fixes radar chart showing only 3 axes)
- `types.ts` — added `crime_victimisations`, `crime_city_median`, `transit_travel_times`, `peak_trips_per_hour`, `nearest_stop_name` to LiveabilityData

**(G) PDF Report — Charts & Visualizations:**
- Radar/spider chart (SVG) of 5 category scores with polygon, grid, dots, labels
- Hazard risk bars — horizontal bar chart of all risk indicators, color-coded
- Comparison bars — property vs suburb vs city with contextual insight sentences
- Rent trend SVG bar chart (last 5 periods)
- NZDep 10-segment visual bar (SVG)
- Crime percentile gradient gauge with marker + stats boxes
- Noise level 5-zone gauge with marker
- Transit mode breakdown bars (Bus/Rail/Ferry/Cable Car)
- Score overview horizontal progress bars (replacing plain table)
- Solar potential card with gradient bar
- EPB nearest building detail card (name, rating, deadline, construction type)
- Wildfire detail with VHE days + trend indicator
- School EQI color-coded quality indicators

**(H) PDF Report — Styling Overhaul:**
- Redesigned color system with documented purpose per color
- Executive dashboard gradient background
- Professional section headers with gradient backgrounds
- Consistent border-radius, spacing, shadows across all elements
- `@page` numbering, page breaks, break-inside-avoid
- Methodology and data quality sections
- Pre-purchase printable checklist

**(I) New files created this session (14 frontend, 0 backend):**
- `frontend/src/lib/sectionRelevance.ts`
- `frontend/src/components/property/CategoryRadar.tsx`
- `frontend/src/components/property/MarketHeatBadge.tsx`
- `frontend/src/components/property/CrimeCard.tsx`
- `frontend/src/components/property/NoiseLevelGauge.tsx`
- `frontend/src/components/property/ClimateForecastCard.tsx`
- `frontend/src/components/property/SolarPotentialCard.tsx`
- `frontend/src/components/property/CoverageRing.tsx`
- `frontend/src/components/property/EarthquakeDetailCard.tsx`
- `frontend/src/components/property/ReportUpsell.tsx`
- `frontend/src/components/property/FloatingReportButton.tsx`

**(J) TypeScript verified:** `tsc --noEmit` clean (pre-existing errors in SuburbSummaryPage/layerStyles only).

### What Needs To Be Done Next

**PDF Report Premium Overhaul (plan saved to `PDF-REPORT-PLAN.md`):**
1. **Renter/Buyer perspective system** — audience-specific callout boxes throughout all sections
2. **Property & Valuation** — donut chart (land vs improvements split) + icon fact grid
3. **Score Overview** — contextual one-liners per category + "What This Means" summary
4. **Environment sub-sections** — Air quality grade card, water quality grade bar, contamination proximity ring
5. **Road Safety** — crash dot visualization (gray/orange/red dots)
6. **Amenities** — horizontal bar chart replacing plain table
7. **Infrastructure** — timeline cards with sector color dots and value ranges
8. **Key Questions** — categorized card layout replacing plain list
9. **Methodology** — stacked weight bar + gradient score scale
10. **Global polish** — section dividers, print optimization, data freshness badges

---

**Session 35 (2026-03-16) — UX key features (FindingCards, ActionCards, ComparisonBars) + report styling overhaul.**

**(A) Three new UX feature components implemented (from UX spec priorities):**

1. **FindingCard + KeyFindings** (`FindingCard.tsx`, `KeyFindings.tsx`) — The "holy shit moment" component. `generateFindings()` analyses the property report and produces plain English findings covering: flood zones, tsunami, liquefaction, slope failure, coastal erosion, EPBs, contamination, noise, NZDep + positive findings (no hazards, good schools, transit, low deprivation). Each finding has: headline, interpretation, severity (critical/warning/info/positive), source attribution. Cards use colour-coded borders/icons. Sorted critical-first, max 5 shown. **Moved UP in report order** — now appears immediately after Score Strip, before AI Summary.

2. **ActionCard + DueDiligenceChecklist** (`ActionCard.tsx`) — Personalised "what to do" checklist. `generateActions()` builds actions based on specific risks: LIM report (always), flood insurance, tsunami evacuation, foundation inspection, geotech assessment, retaining walls, EPB review, SLUR check, noise glazing, heritage restrictions, zone info. Each action has title, description, priority (essential/recommended/optional), optional external link. Sorted by priority with coloured dots.

3. **ComparisonBar + ComparisonSection** (`ComparisonBar.tsx`) — Horizontal bar chart comparing property value vs suburb avg vs city avg. Contextual labels ("Higher than average", "Typical for the area"). Respects `lowerIsBetter` flag. Wired for: NZDep, schools, transit stops, road noise, EPBs. **User updated PropertyReport.tsx to wire comparison data from `report.comparisons?.suburb` and `report.comparisons?.city` — needs `comparisons` field added to types.ts and backend.**

**(B) Report information hierarchy restructured (matching UX spec):**
```
1. Summary Card (address, CV, links)
2. Score Gauge + Score Strip + Coverage Badge
3. KEY FINDINGS (NEW — moved UP)  ← "holy shit" moment
4. AI Summary
5. DUE DILIGENCE CHECKLIST (NEW)  ← "what to do"
6. COMPARISON BARS (NEW)          ← "vs suburb/city"
7. CTA Banner
8. Nearby Highlights
9. Accordion Sections (detail)
10. Key Takeaways (Share/PDF/Search)
11. Disclaimer
```
Section dividers with uppercase headings ("What to do next", "Nearby essentials", "Detailed breakdown") added between major groups for scanability.

**(C) Report styling overhaul across 16 files:**
- **Global CSS:** 3-tier card elevation system (`.card-elevated` with shadows + hover), `.section-divider`, `.section-heading` uppercase labels
- **PropertySummaryCard:** Shadow + overflow-hidden, score circle `rounded-2xl` with `ring-4` glow, property info as pill badges, bold tracking-tight address
- **ScoreStrip:** Larger `w-11 h-11 rounded-xl` circles, hover scale micro-interaction
- **IndicatorCard:** `rounded-xl card-elevated`, smoother `duration-700` score bar animation, subtler source text
- **NearbyHighlights:** Replaced hardcoded pink/green/orange with design system (rose/emerald/amber), added icon container circles, `card-elevated`
- **ReportAccordion:** Each item `rounded-xl card-elevated`, icon background circles per category (red/emerald/teal), wider padding
- **AISummaryCard:** Added `border-piq-primary/15` + `dark:bg-piq-primary/10` for dark mode visibility
- **BetaBanner:** Subtle border, icon container, split bold/muted text
- **ReportCTABanner:** Stronger gradient, primary border, `text-base font-bold`, `size="lg"` button
- **TransportSection:** Side-by-side distance cards with icon containers instead of flat list
- **RiskHazardsSection:** Critical findings get `bg-red-50/50 dark:bg-red-950/20` tinted background
- **All section components** (Neighbourhood, Market, Planning): `rounded-xl bg-card card-elevated` + `gap-2.5`
- **ActionCard, ComparisonBar:** `card-elevated`, icon containers, better spacing

**(D) TypeScript verified:** `tsc --noEmit` clean after all changes.

**(E) INCOMPLETE — needs follow-up:**
- `report.comparisons` field referenced in PropertyReport.tsx but not yet in `types.ts` or backend — **TypeScript may error until this is added**
- Need to add `comparisons` interface to `types.ts` with `suburb` and `city` sub-objects containing `avg_nzdep`, `school_count_1500m`, `transit_count_400m`, `max_noise_db`, `epb_count_300m`
- Need backend SQL/endpoint to compute suburb and city averages for comparison bars
- Real suburb averages not yet wired (comparison bars will show "This place" vs "City" only until backend is done)

**New files (4):**
- `frontend/src/components/property/FindingCard.tsx` — Finding card component + `generateFindings()` logic
- `frontend/src/components/property/KeyFindings.tsx` — Wrapper that renders top 5 findings
- `frontend/src/components/property/ActionCard.tsx` — Action item component + `DueDiligenceChecklist` + `generateActions()` logic
- `frontend/src/components/common/ComparisonBar.tsx` — Horizontal comparison bar + `ComparisonSection` wrapper

**Modified files (16):**
- `frontend/src/app/globals.css` — card-elevated, section-divider, section-heading CSS
- `frontend/src/components/property/PropertyReport.tsx` — New report order + section dividers + imports
- `frontend/src/components/property/PropertySummaryCard.tsx` — Score circle, pill badges, shadow
- `frontend/src/components/property/ScoreStrip.tsx` — Larger rounded-xl circles, hover
- `frontend/src/components/property/ReportAccordion.tsx` — Icon backgrounds, card-elevated
- `frontend/src/components/property/AISummaryCard.tsx` — Border + dark mode bg
- `frontend/src/components/property/BetaBanner.tsx` — Icon container, border
- `frontend/src/components/property/ReportCTABanner.tsx` — Stronger CTA styling
- `frontend/src/components/property/NearbyHighlights.tsx` — Design system colors, icon containers
- `frontend/src/components/property/sections/RiskHazardsSection.tsx` — Tinted critical bg
- `frontend/src/components/property/sections/NeighbourhoodSection.tsx` — rounded-xl, card-elevated
- `frontend/src/components/property/sections/MarketSection.tsx` — rounded-xl, card-elevated
- `frontend/src/components/property/sections/TransportSection.tsx` — Side-by-side distance cards
- `frontend/src/components/property/sections/PlanningSection.tsx` — rounded-xl, card-elevated
- `frontend/src/components/common/IndicatorCard.tsx` — rounded-xl, card-elevated, smoother animation

**Session 34 (2026-03-12) — Severity gradient map styling + Azure deployment + rainfall landslide research.**

**(A) Data-driven severity color gradients on map layers.** 6 hazard layers now use MapLibre data-driven styling — polygons are colored by severity/intensity with both fill color and opacity scaling (bolder = more risk):
- **slope_failure_zones:** `susceptibility` column (Very Low→Very High), 5-stop color ramp (green→blue→amber→orange→red), opacity 0.12→0.50
- **liquefaction_zones:** `liquefaction` column (Low→Very High), 4-stop ramp
- **tsunami_zones:** `zone_class` column (3→1, inverted — 1=highest risk), 3-stop ramp
- **wind_zones:** `zone_name` column (M→EH/SED), 4-stop ramp
- **noise_contours:** `laeq24h` column (45–65 dB), continuous interpolation
- **coastal_erosion:** `csi_in` column (0–100 CSI index), continuous interpolation
- **Legend:** Gradient swatches with range labels (e.g., "0 → 100") replace flat-color squares for severity layers
- **Hover tooltips:** Show severity info (e.g., "Slope failure · High", "Tsunami zone · Zone 1 · Red", "Wind zone · Very High")
- **Flood zones** keep flat color (no numeric severity field)
- `tsc --noEmit` clean.

**(B) Azure deployment to `rg-joel-test` COMPLETE.** Deployed full stack to existing `wharescore-vm` (B2ms, 20.5.86.126):
- **Slope failure data loaded on VM:** 4,682 polygons from `GW/Emergencies_P/MapServer/11` (note: API moved from `GW/NaturalHazards_P` → `GW/Emergencies_P`). Loaded via ogr2ogr in postgres container with 5 batches (1000/batch limit). Susceptibility column mapped, GIST index created.
- **Report function updated:** `07-report-function.sql` re-applied — property reports now include `slope_failure` field
- **Frontend + Backend rebuilt:** Docker images rebuilt with severity gradient code, risk engine updates
- **Martin auto-discovery:** Martin running with direct connection string (auto_publish) — discovered all tables including slope_failure_zones. Tiles served correctly.
- **Nginx .pbf fix:** Martin v0.15.0 doesn't accept `.pbf` extension in URLs. Fixed nginx rewrite: `^/tiles/(.*?)(?:\.pbf)?$` strips the extension. Tiles now serve 200 with data.
- **All services healthy:** API `{"status":"ok","db":true,"redis":true}`, Frontend HTTP 200, Martin serving tiles, property report returns `slope_failure: Very Low` for address 1753062
- **Deployment findings:**
  - Martin v0.15.0 does NOT support `${ENV_VAR}` substitution in YAML config files — use direct connection string in docker-compose command instead
  - GWRC API endpoint changed: `GW/NaturalHazards_P/MapServer` → `GW/Emergencies_P/MapServer` (layer 11 = Slope failure, layer 21 = Landslide)
  - ArcGIS REST API caps at 1000 features per request (not 2000) — need 5 paginated requests for 4,682 features
  - Martin healthcheck not configured in docker-compose — shows "unhealthy" but works fine. Need to add `healthcheck: test: ["CMD", "curl", "-f", "http://localhost:3000/health"]`
  - `pg_dump`/`psql` not available on Windows host — use `ogr2ogr` inside postgres container for data loads
- **URL:** `https://wharescore.australiaeast.cloudapp.azure.com/`

**(C) Research: Rainfall & general landslide data sources.** Current `slope_failure` layer is GWRC earthquake-only. Rainfall-triggered slips are more common in Wellington. Key data sources identified:
1. **GNS NZ Landslide Database (NZLD)** — 500,000+ landslides nationally, all trigger types (rain, earthquake, etc.). Free registration at `data.gns.cri.nz/landslides/` gives polygon access + shapefiles. WFS at `maps.gns.cri.nz/gns/ows?service=wfs&version=1.0.0&request=GetCapabilities`. Also on ArcGIS Hub. **Best immediate option.**
2. **GNS SLIDE Project** — Models landslide probability under 100-year & 200-year rainfall return periods for central Wellington. Includes 1,600+ fill bodies, 3,000+ cut slopes. Viewable via WCC web viewer. Raw data may need request to `landslide.database@gns.cri.nz`. **Ideal Wellington rainfall landslide layer.**
3. **NIWA PRILHM** — National probabilistic rainfall-induced landslide hazard model. Wellington was trial region. Being integrated into GeoNet RIL forecast. Public API access unclear.
4. **SlideNZ / EIL** — Earthquake-induced landslide probability maps at 100/250/500/1000-year return periods. Higher fidelity than GWRC. Free shapefiles from `slidenz.net/data-tools/webmap/`.
5. **GeoNet** — Real-time landslide monitoring + reports (`geonet.org.nz/landslide/reports`). API at `api.geonet.org.nz/`. Better for real-time alerts than static scoring.
6. **GWRC API note:** Layer 21 on `GW/Emergencies_P/MapServer` = "Landslide" (separate from layer 11 = earthquake slope failure). Worth investigating as potential general landslide layer.
- **Action items:** (a) Register at GNS NZLD for polygon access, (b) email GNS re: SLIDE rainfall surfaces as WMS/WFS, (c) test GNS GeoServer WFS, (d) check GWRC layer 21 for general landslide data.

**Session 33 (2026-03-12) — Slope Failure / Landslide hazard added as 9th hazard indicator (full stack).**

**(A) Slope Failure full-stack implementation COMPLETE (code only — data not yet loaded).** Added GWRC Earthquake-Induced Slope Failure as 9th hazard indicator across all layers:
- **SQL:** `07-report-function.sql` — new `slope_failure` field in hazards JSON + LATERAL join on `slope_failure_zones`. `03-create-indexes-views.sql` — GIST index.
- **Backend risk engine:** `risk_score.py` — `SEVERITY_SLOPE_FAILURE` mapping (Very Low→Very High, 5→90), rebalanced `WEIGHTS_HAZARDS` (9 indicators), updated `CATEGORY_INDICATOR_COUNTS` to 9, added indicator extraction.
- **Backend PDF report:** `report_html.py` — 9th humanized hazard row (Slope Stability) with 5 severity tiers + actionable detail text. Insight rules for Very High/High/Medium. Recommendation triggers for high/moderate. `slope_failure_class` added to template context.
- **Backend recommendations:** `admin.py` — 2 new `DEFAULT_RECOMMENDATIONS` templates: `slope_failure_high` (critical, 6 actions incl. geotech assessment, retaining walls, LIM, insurance) and `slope_failure_moderate` (advisory, 3 actions).
- **Frontend:** `types.ts` — `slope_failure` field on `HazardData`. `transformReport.ts` — mapped to risk category. `constants.ts` — `slope_failure_zones` tile layer + COVERAGE_TOTAL→28. `layerStyles.ts` — pink/mauve polygon style (#CC79A7).
- **Martin:** All 3 configs (martin.yaml, martin.local.yaml, martin.prod.yaml) — `slope_failure_zones` minzoom 10.
- **TypeScript verified:** `tsc --noEmit` clean.

**(B) Data downloaded and loaded.** GWRC Earthquake-Induced Slope Failure: 4,682 polygons from `mapping.gw.govt.nz` MapServer layer 11. SEVERITY field mapped: `1 Low`→Very Low, `2`→Low, `3 Moderate`→Medium, `4`→High, `5 High`→Very High. Distribution: Very Low (610), Low (814), Medium (1,952), High (1,262), Very High (44). GIST index created, table analyzed. Report function verified: Cuba St → Very Low, Wadestown → High, Rongotai → Very High.

**Session 32 (2026-03-11) — Backend 500 error RESOLVED. Project renamed to WhareScore.**

**(A) Project renamed from PropertyIQ → WhareScore.** 70 files updated across Python, TypeScript, SQL, config, and documentation. Database renamed (`ALTER DATABASE propertyiq RENAME TO wharescore`). Domains to register: `wharescore.co.nz` + `wharescore.com` (both confirmed available). Folder remains `propertyiq-poc` (renaming folders breaks git history).

**(B) Backend 500 error FIXED.** Root cause was likely stale Uvicorn processes from previous sessions (20+ stuck processes on port 8000). After killing all processes and starting fresh with `--log-level debug`, all endpoints work:
- Health: `{"status":"ok","db":true,"redis":false}` ✓
- Search: returns results for "162 Cuba" ✓
- Property report (1753062): returns full JSON with market, trends, scores ✓
- Nearby schools: returns GeoJSON FeatureCollection ✓
- Market: returns SA2-level rental data with trends ✓

**(C) Azure Hosting Plan created** (`AZURE-HOSTING-PLAN.md`). Covers: Microsoft for Startups credits ($5K free), single B2ms VM architecture, full setup commands, database migration, Cloudflare DNS/SSL/WAF, GitHub Actions CI/CD, monitoring, security checklist, scale path.

**(D) CLAUDE.md updated** with rename note and Azure hosting plan reference.

**45 tables, ~18.7M+ records in PostGIS.** All MVP datasets + 8 Tier 1-2 hazard/environment layers + 4 Tier 3 datasets + infrastructure pipeline + 5 Tier 4 datasets + school enrolment zones + RBNZ housing + detailed quarterly bonds + SA2 2018 boundaries loaded and validated. MBIE Market Rent API cache + WCC rates cache tables added.

**Frontend Phase 3 (Shell) COMPLETE.** Phase 4 (Report UI) COMPLETE — 40+ components built, TypeScript-verified. Phase 5 (Search) core components built. **Phase 5b (Admin Portal) COMPLETE.** Phase 6 static pages COMPLETE. **Premium PDF Report (extension of Phase 6) ~95% COMPLETE.** Remaining: Fix backend 500 errors, then test end-to-end PDF generation. Remaining: Docker Compose, deployment, pre-loaded demo, accessibility pass.

---

## Next Steps (Resume in Fresh Context)

1. **FIX: Add `comparisons` field to types + transform + backend** ← BLOCKING (TypeScript error)
   - User updated `PropertyReport.tsx` to reference `report.comparisons?.suburb` and `report.comparisons?.city`
   - Need to add `comparisons?: ComparisonData` to `PropertyReport` interface in `types.ts`
   - Need `ComparisonData` type: `{ suburb: SuburbCityAvg | null; city: SuburbCityAvg | null }` with fields: `avg_nzdep`, `school_count_1500m`, `transit_count_400m`, `max_noise_db`, `epb_count_300m`
   - Need to update `transformReport.ts` to extract comparisons from backend response
   - Need backend SQL to compute suburb/city averages (query across all addresses in same SA2/suburb for suburb avg, all Wellington for city avg)
   - Add to `get_property_report()` SQL function or as separate endpoint

2. ~~**Resolve backend 500 error blocker**~~ ✅ DONE (session 32)

3. **End-to-end PDF export test**
   - Hit `POST /api/v1/property/{id}/export/pdf/start` to get job_id
   - Poll `GET /api/v1/property/{id}/export/pdf/status/{job_id}` until completed
   - Download PDF from `GET /api/v1/property/{id}/export/pdf/download/{job_id}`
   - Verify all 12 sections render + print to PDF works in Chrome

4. **Remaining UX features** (from `feature-todos.md` + UX spec):
   - [ ] Suburb Search & Summary Page (`/suburb/[name]` route)
   - [ ] Smart report ordering (sections re-prioritise based on property type)
   - [ ] Map layer strategy (defaults, multi-layer tooltips, layer cap)
   - [ ] Score semantics fix (traffic light green/amber/red, "higher = worse" clarity)
   - [ ] User accounts + saved reports
   - [ ] PDF sales strategy (sample report, pricing page)

5. **Final verification checklist**
   - [ ] Backend health endpoint: `curl http://localhost:8000/health` → `{status: ok, db: true, redis: false}`
   - [ ] Property report: `curl http://localhost:8000/api/v1/property/1378995/report` → valid JSON with all sections
   - [ ] Frontend compiles: `cd frontend && npm run build`
   - [ ] Frontend runs: `PORT=3000 npm run dev`
   - [ ] PDF export works end-to-end via browser UI (loading modal → download button)

**Product Brief COMPLETE (2026-02-15, session 3).** Next: PRD → UX → Architecture → Epics/Stories.

**Session 31 progress (2026-03-09):** Premium PDF property report system + background PDF generation job queue. **Completed before blocker:**
**(A) Map image generation (`map_renderer.py`)** — PIL-based lightweight map (no external APIs), shows property marker + schools (in-zone + other) + supermarket/GP/pharmacy/transit stops, auto-scales bounds with 10% padding, grid background, legend. Embedded as base64 data URI in HTML.
**(B) PDF job queue (`pdf_jobs.py`)** — in-memory job store with states (pending→generating→completed/failed), 60-minute expiration, concurrent job support.
**(C) Background PDF export endpoints (`property.py`)** — `POST /export/pdf/start` returns job_id + status/download URLs, `GET /export/pdf/status/{job_id}` polls status, `GET /export/pdf/download/{job_id}` returns completed PDF. Rate limited 5/hour.
**(D) Frontend PDF export flow (`KeyTakeaways.tsx`)** — "Export PDF" button shows modal with loading spinner, polls status endpoint every 1s, shows success with "Open Report" button + download URL when ready, handles errors with retry.
**(E) Python compatibility fixes** — Added `from __future__ import annotations` + `eval_type_backport` to support Python 3.8 (union syntax `X | None` → `Optional[X]`, `list[str]` → `List[str]`). Fixed 9 files (config.py, redis.py, main.py, bot_detection.py, ai_summary.py, report_html.py, property.py).
**(F) Report HTML template (`property_report.html`)** — Jinja2 template with all 12 sections: Cover, Executive Summary, Score Overview, Natural Hazards (8 hazards with humanized labels), Environment (noise dB context, air/water quality), Liveability (NZDep, crime percentile, schools table, transit with exact names, crashes), Lifestyle Fit (personas + practical tips), Market Intelligence (rental table by type/beds, CAGR, yield), Planning (zone, height, critical flags), Disclaimer. Inline CSS for printing.
**(G) Humanized hazard rendering** — Wind zones, liquefaction, wildfire trends, tsunami class, coastal erosion all shown with human-readable labels + severity colors.
**(H) Insights inline after each subsection** — build_insights() Python function returns rules-based flags (warn/info/ok severity) with action items. Displayed in template with color-coded boxes.

All TypeScript frontend verified with `tsc --noEmit`. **BLOCKED at backend testing** — property endpoints returning 500 errors despite successful startup + working health endpoint.

**Session 30 progress:** Phase 5b (Admin Portal) + Phase 6C (Static Pages) complete — all TypeScript-verified (`tsc --noEmit` clean). **(A) Admin Portal (Phase 5b):** 6 admin hooks (`useAdminAuth`, `useAdminDashboard`, `useAdminDataHealth`, `useAdminFeedback` with status mutation, `useAdminEmails` with CSV export, `useAdminContent` with update mutation). 6 admin components: `AdminAuthGate.tsx` (password + 3-attempt lockout + 30s cooldown), `DashboardOverview.tsx` (4 stat cards: rent reports 24h/30d, feedback, email signups + unresolved alert), `DataHealthPanel.tsx` (service status badges + sortable table of all 39 DB tables with record counts), `FeedbackPanel.tsx` (type/status filters, expandable rows, inline status update buttons, pagination), `EmailSignupsPanel.tsx` (table + CSV export + pagination), `ContentPanel.tsx` (banner editor with type/active toggle, demo address ID, FAQ CRUD with add/delete/save all). Admin layout: top bar + 5-tab navigation (Dashboard, Data Health, Feedback, Emails, Content) with active tab highlight. 6 page routes under `/admin/*`. **(B) Static Pages (Phase 6C):** `StaticPageLayout.tsx` (shared wrapper: max-w-2xl prose container, back-to-map link, title). 6 pages: `/help` (7 FAQ items with `<details>` accordion), `/about` (project story + 14 data source cards with visit links), `/privacy` (what we collect/don't collect, cookies, retention), `/terms` (disclaimer, risk scores, fair rent, usage limits, liability), `/contact` (feedback button, data corrections, coverage requests), `/changelog` (versioned entries with feature lists). **(C) `useFirstUseHints.ts` hook** — localStorage-tracked onboarding hints (score, accordion, layer, showOnMap) with SSR-safe window check. **New files (21 total):** 6 hooks, 6 components, 1 layout, 1 shared component, 7 page routes. **Remaining for MVP:** Docker Compose + nginx config, pre-loaded demo property, accessibility pass (WCAG 2.2 AA), deploy to Vultr Sydney.

**Session 29 progress:** Frontend Phase 4 (Report UI) complete — all core components built and TypeScript-verified (`tsc --noEmit` clean). **Batch 1 — Core report components:** `ScoreGauge.tsx` (240° SVG arc, animated counter, prefers-reduced-motion), `ScoreStrip.tsx` (5 category circles with tooltips), `AISummaryCard.tsx` (Sparkles icon, null-safe), `ReportAccordion.tsx` (5 AccordionItems with section icons/badges), `IndicatorCard.tsx` (score bar + rating badge + source tooltip), `DataSourceBadge.tsx`, `EmptyState.tsx` (3 variants), `ErrorState.tsx` (5 variants). **Batch 2 — Charts + rent flow:** `RentDistributionBar.tsx` (LQ-Med-UQ bar with user marker), `RentComparisonFlow.tsx` (3-state: type+beds pills → compare → assessment, sendBeacon on unmount), `RentHistoryChart.tsx` (Recharts ComposedChart with Area band + Line), `HPITrendChart.tsx` (Recharts AreaChart with peak annotation), `BuildingInfoBanner.tsx` (multi-unit collapsible mini-table), `UnitComparisonTable.tsx` (sortable, current-unit pinning, responsive mobile cards), `KeyTakeaways.tsx` (auto-generated concerns/positives, Share/Export/Search Another), `BetaBanner.tsx`. **5 accordion sections:** `RiskHazardsSection.tsx`, `NeighbourhoodSection.tsx`, `MarketSection.tsx`, `TransportSection.tsx`, `PlanningSection.tsx`. **Batch 3 — Remaining components:** Map components (`MapControls.tsx`, `PropertyPin.tsx`, `MapPopup.tsx`, `MapLegend.tsx`, `MapLayerChipBar.tsx`), layout (`TabletPanel.tsx`), search (`SearchOverlay.tsx`, `RecentSearches.tsx`, `SavedProperties.tsx`), feedback (`FeedbackFAB.tsx`, `FeedbackDrawer.tsx` with 3 tabs + satisfaction + importance + cooldown), common (`OutOfCoverage.tsx`, `ReportDisclaimer.tsx`, `AnalyticsConsent.tsx`). **Hooks:** `useLayerVisibility.ts`, `useRecentSearches.ts`, `useSavedProperties.ts`, `useEmailSignup.ts`, `useFeedback.ts`, `useMobileBackButton.ts`. **Modified:** `PropertyReport.tsx` (complete rewrite with all sections), `app/layout.tsx` (added FeedbackFAB + AnalyticsConsent globally), `lib/types.ts` (added `contamination_count` to PlanningData, `cbd_distance_m`/`nearest_train_m` to LiveabilityData, `is_multi_unit` to PropertySummary). **Key finding:** This project uses `@base-ui/react` (NOT `@radix-ui`) — no `asChild` on TooltipTrigger, no `value` on AccordionItem. All components written to match base-ui API. **Remaining:** StaticPageLayout + static pages, admin portal components (Phase 6), `useFirstUseHints` hook.

**Session 28 progress:** Backend Phases 07-10 implemented + frontend plan audit + security hardening. **(A) Phase 07 — Market endpoints:** Fixed Decimal→float conversions across `market.py` (sa2_median, tla_median, quartile values, HPI values). Added `dwelling_type` and `bedrooms` enum validation via `pattern=` regex. Three endpoints: `GET /property/{id}/market` (fair price analysis with yield cross-check, percentile, purchase estimate), `GET /property/{id}/rent-history` (SA2 time series with CAGR), `GET /market/hpi` (national HPI trend). All cached in Redis. **(B) Phase 08 — AI Summary:** `ai_summary.py` (Azure OpenAI async client, 3s timeout, graceful None fallback), `generate_area_profiles.py` batch script. AI summary integrated into `/property/{id}/report` with `asyncio.wait_for(timeout=3.0)`. **(C) Phase 09 — WCC Rates:** `rates.py` service with 308 redirect handler, `_simplify_address()` for unit addresses, prefers `rateValidity=="Current"`. `GET /property/{id}/rates` endpoint (10/min). **(D) Phase 10 — Community endpoints:** `rent_reports.py` service (5-layer validation: hard bounds, SA2 deviation, bedroom coherence, IP rate limit 3/24h, dedup 7 days). `POST /rent-reports` + `GET /rent-reports/{id}`. `feedback.py` + `email_signups.py` routers with honeypot pattern. `POST /feedback` (5/hr), `POST /email-signups` (3/hr, duplicate check). **(E) Property summary + PDF export:** `GET /property/{id}/summary` (60/min, lightweight for map popups), `GET /property/{id}/export/pdf` (5/hr, printable HTML with `@media print` CSS). `report_html.py` renderer handles `rating` as dict, categories as floats, `rental_overview` as list. **(F) Frontend plan audit:** Found 5 critical + 3 moderate mismatches. Fixed: `RentReportCreate.weekly_rent` → `reported_rent`, `bedrooms: number` → `string`, `EmailSignupCreate.city` → `requested_region` (removed `source`), `FeedbackCreate.browser_info: string` → `Record<string, unknown>`, PDF export approach (printable HTML not weasyprint), added `PropertySummary` interface. Updated hook implementations in `FRONTEND-PLAN.md`. **(G) Security hardening:** Audited all 30 endpoints. Applied: `pattern=` regex on `dwelling_type`/`bedrooms` (market.py), `pattern=` on `category` (nearby.py), `EmailStr` on feedback email. All verified — invalid inputs return 422. **New files:** `app/services/ai_summary.py`, `app/services/rates.py`, `app/services/rent_reports.py`, `app/services/report_html.py`, `app/routers/rates.py`, `app/routers/rent_reports.py`, `app/routers/feedback.py`, `app/routers/email_signups.py`, `app/schemas/feedback.py`, `app/schemas/email_signups.py`, `app/schemas/rent_reports.py`, `scripts/generate_area_profiles.py`. **Modified:** `app/routers/property.py` (summary + PDF export + AI summary), `app/routers/market.py` (Decimal fixes + validation), `app/routers/nearby.py` (category validation), `app/main.py` (router registration). Phase 11 (admin + detection) deferred to separate session.

**Session 27 progress:** Subdivision/unit-level data support — end-to-end from SQL to UI, plus UX review and completeness audit. **Backend:** (1) `v_address_valuation` view updated with text-matching priority ORDER BY — unit addresses (e.g. "1/45 Cuba Street") now match unit-level valuation records ("Unit 1 45 Cuba Street") instead of building-level parent records. 3-tier priority: exact unit match → building-level match → spatial fallback. (2) Same logic applied to `get_property_report()` council_valuations LATERAL join. Added `cv_valuation_id` and `cv_address` to report output. (3) `property_detection.py` updated to return `sibling_valuations` — queries all unit-level valuations at same building (max 20) for multi-unit properties. **Data discovery:** ~19% of council_valuations (16,622/87,819) are unit-level records; ~18% of wcc_rates_cache (14,226/77,370) have unit identifiers. **Frontend types:** Added `cv_valuation_id`, `cv_address` to `PropertyInfo`; `sibling_valuations` to `PropertyDetection`; new `SiblingValuation` interface; `is_multi_unit` added to `PropertySummary`; `isMultiUnit` added to `SavedProperty`. Fixed duplicate `PropertySummary` type — renamed second definition to `PropertySummaryMeta` (for SSR/OpenGraph). **Frontend UI:** (1) `BuildingInfoBanner` messaging revised with 2-line visual hierarchy (bold unit count + secondary data scope explanation). Added inline collapsible mini-table (max 6 rows, via shadcn `Collapsible`) instead of scroll-jump link — prevents context loss. "See more" link for >6 units auto-expands MarketSection accordion then scrolls. (2) New `UnitComparisonTable` component — default sort by CV descending (comparison intent), current unit pinned to top, relative position bars (4px, accent-warm for current unit), handles edge case of current unit missing from siblings (synthetic row from PropertyInfo). Responsive cards on mobile. (3) `CouncilValuationCard` updated — full visual hierarchy spec (title + badge → values → caveat → compare link → source). "(Unit valuation)" badge inline right of title. "Compare all [N] units" link is primary path to full table. (4) `MarketSection` description updated to include UnitComparisonTable. (5) `RatesSection` clarified — rates already unit-specific via WCC API, "(This unit's rates)" qualifier for multi-unit. (6) `PropertySummaryCard` multi-unit CV display specified: "CV $380,000" + "Unit valuation" badge beside it. `BuildingInfoBanner` renders inside the card below address. (7) `usePropertyDetection` hook expanded — exposes `siblingValuations`, `hasSiblings`, `buildingAddress`. (8) PDF export updated — includes "Unit in N-unit building" note, CV labeled as unit valuation, static UnitComparisonTable snapshot. (9) MapPopup multi-unit variant clarified — loads first address_id (deterministic), building-level data identical for all units. (10) Component → design system mapping table updated. (11) `UnitComparisonTable.tsx` added to IMPLEMENTATION-PLAN.md project structure.

**Session 26 progress:** Two-pass comprehensive review + structural restructure of `FRONTEND-PLAN.md` (grew from ~1,030 to ~2,250 lines). **Pass 1 (structural restructure, 13 fixes):** **(A) Phase 3 restructure** — moved layout components from Phase 5 §5A-1 into Phase 3 as §3G. **(B) `tailwind.config.ts`** spec added as §3H. **(C) `lib/types.ts`** spec added as §3I — 140+ lines of TypeScript types mirroring backend schemas. **(D) `lib/constants.ts`** expanded as §3J — RATING_BINS, CATEGORIES, TILE_LAYERS, CHART_THEME. **(E) `PropertyReport.tsx`** wrapper added as §4A-0. **(F) `/summary` endpoint** added to BACKEND-PLAN.md §2C-1. **(G-L)** Map-tap flow §5C, URL routing §5D, rent submission clarification, useEmailSignup §5E, mock data note, build order updates. **Pass 2 (completeness audit, 22 fixes):** **(M) `searchStore.ts`** fully specified — query, overlay state, selectedAddress, clearSelection + store interaction flow diagram. **(N) `format.ts`** spec added as §3K — 10 formatting functions (formatCurrency, formatRent, formatDistance, etc.). **(O) `useLayerVisibility`** clarified — thin wrapper around mapStore with section-toggle save/restore logic (full hook implementation). **(P) ScoreGauge** expanded — SVG layout, animation lifecycle (remounts via React key, requestAnimationFrame counter, prefers-reduced-motion). **(Q) "Show on Map" toggle state management** — full useLayerVisibility hook with per-section prior-state snapshots using useRef. **(R) Accordion lazy-loading** clarified — two-tier strategy: IntersectionObserver prefetch (rootMargin 200px) + on-expand fetch, first 2 sections immediate. **(S) RentDistributionBar** full component spec — bar segments, marker positioning, low confidence warning. **(T) CrowdsourcedRentCard** spec added. **(U) CoverageBadge** tooltip content specified. **(V) OutOfCoverage** expanded — full success/error flow, supported cities list, dedup handling. **(W) Error→message mapping table** — 7 error types with user-facing messages. Section error retry: 2 retries exponential, isolated per section. **(X) SearchOverlay** full component spec — layout, keyboard handling, recent searches, cancel button, animation. **(Y) RecentSearches + SavedProperties** component specs. **(Z) Bookmark flow** — toggle behavior, Sonner toast, landing page integration. **"Search Another"** flow — 7-step state cleanup. **(AA) LoadingSkeleton + ReportSkeleton** — shape presets, shimmer keyframes, full report skeleton layout. **(AB) Layer state persistence** — saved to localStorage, persists across address changes. **(AC) PDF export architecture** — weasyprint on FastAPI, Jinja2 templates, static map image, QR code. **(AD) 6 hook specs** added in §5F: useRecentSearches, useSavedProperties, usePropertyDetection, useFirstUseHints (full trigger implementations + pulsing dot animation), useFeedback (with screenshot FormData), useAdminAuth (session check + brute-force protection). **(AE) Admin Portal Frontend** — 8 new sections (Admin-1 through Admin-8): AdminAuthGate, admin layout/tabs, DashboardOverview (stat cards + sparklines), AnalyticsPanel (4 chart types), DataHealthPanel (source freshness table + refresh), FeedbackPanel (filterable table + status PATCH + CSV export), EmailSignupsPanel (table + CSV export), ContentPanel (banner + demo address + FAQ with @dnd-kit/sortable drag-drop). Added @dnd-kit to npm install. Added 6 admin hooks to IMPLEMENTATION-PLAN.md project structure. **(AF) Map-tap when report open** — clarified desktop vs mobile behavior (dismiss to popup, don't auto-load full report). **(AG) Rent validation timing** — as-you-type, not on-blur.

**Session 25 progress:** Frontend plan review, security hardening, and cross-document alignment fixes. **(A) Frontend Security section added** to `FRONTEND-PLAN.md` (~160 lines): input validation table (7 input types with rules + error UX), XSS prevention rules (no `dangerouslySetInnerHTML`, text-only rendering for AI summaries), `api.ts` fetch wrapper with typed error classes (`RateLimitError`, `NotFoundError`, `ApiError`), `storage.ts` safe localStorage helpers with validation, external link security (`rel="noopener noreferrer"`, lat/lng validation for Street View URLs), admin portal security (brute force lockout, httpOnly/secure/sameSite cookies, CSRF protection), rate limit handling per endpoint. **(B) CSP headers** added to `next.config.ts` section — `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. **(C) Animation timing fixes** — resolved contradiction between UX spec (600-800ms flyTo) and FE plan (1200ms): standardized to 1200ms in both docs (matches wireframe sequences). Fixed score arc easing from overshoot spring to UX spec's canonical `cubic-bezier(0.25, 0.1, 0.25, 1)`. Added missing `SCORE_BAR_DURATION: 150` constant. UX spec 500ms rule clarified to exempt map flyTo (spatial transition, not UI animation). **(D) Naming fixes** — `MapLayerControl.tsx` → `MapLayerChipBar.tsx` (matches project structure). Layer chip border radius `rounded-full` → `rounded-md` (matches UX spec design system). Fixed Vaul `snapToSequentialPoint` (not a real prop) → documented correct sequential snap clamping approach. Fixed duplicate `### 4D` heading. **(E) Missing component specs added** — `MapPopup.tsx` (parcel tap mini-preview, multi-unit variant), `MapControls.tsx` (zoom/locate/satellite), `PropertyPin.tsx` (marker + bounce), `MapLegend.tsx` (desktop + mobile variants), `TabletPanel.tsx` (push layout, toggle button, closed state), `AppHeader.tsx` (desktop/mobile/tablet variants), `AppFooter.tsx` (logos + links + legal), `StaticPageLayout.tsx` (shared wrapper for 6 static pages), `ReportDisclaimer.tsx` (persistent legal disclaimer), dark mode implementation notes. **(F) Validation added** to rent input (hard bounds $50-$5000, numeric-only, inline errors), feedback forms (10-2000 chars, email regex, screenshot 5MB/image-only, rate limiting), search (max 200 chars, HTML stripping, URL param validation), out-of-coverage email (format + length). **(G) "Show on Map" toggle mapping** added — table defining which layers activate per accordion section. **(H) Pre-loaded demo** implementation note added. **(I) Missing items added to project structure** — `useMobileBackButton.ts` hook, `storage.ts` lib, `StaticPageLayout.tsx` component. **(J) UX spec Icon Registry updated** — added 11 missing icons: `Loader2`, `MapPinOff`, `AlertCircle`, `Gift`, `Lock`, `Frown`/`Meh`/`Smile`/`Laugh`/`Heart`. FE plan grew from ~756 to ~1,030 lines.

**Session 24 progress:** Full alignment pass between `ux-design-specification.md` (2,950 lines) and `IMPLEMENTATION-PLAN.md`, plus security hardening, backend expansion, UX/research gap filling, and file split. **(A) UX ↔ Implementation alignment:** Gap analysis found 13 missing features + 2 discrepancies. Added all missing build phases (2I-2L, 4E-4O, 6C, 6E), 11 new components, 6 admin components, 4 hooks, backend files. Added Free vs Premium tier design to UX spec with beta period messaging. RatesSection (3b) discrepancy resolved — added full wireframe + component spec to UX spec as Wellington-only accordion section. **(B) Security & Hardening section** added — comprehensive OWASP Top 10 coverage: middleware stack (TrustedHost, security headers, CORS, slowapi, bot detection), per-endpoint rate limit table (14 routes), bot detection (UA filtering, Redis sliding window), OWASP Top 10 mapping, error leakage prevention, input validation summary, Cloudflare WAF config, abuse logging service. Added `slowapi>=0.1.9` + `bcrypt>=4.2`, security env vars. **(C) Backend phases 2I-2L expanded** to full implementation code — rent reports (5-layer validation), feedback (Pydantic schema), admin (bcrypt auth + sessions + 8-endpoint table), multi-unit detection (SQL + rules). **(D) Research & UX gap audit** — two Explore agents found 15 UX gaps and 43 research gaps; triaged to ~12 high-impact items and added: yield table (6 regions), CV uncertainty function, log-normal percentile estimation (`math.erf`), SA2-TLA blending formula, market confidence 5-star system, animation timing constants (12 timings + 5 easings), map risk patterns (5 fill patterns for colorblind-safe visualization), mobile back button (5-state popstate handler), Vaul bottom sheet config, data sources metadata table (9 seed rows), layer chip bar specs. **(E) File split** — `IMPLEMENTATION-PLAN.md` was 3,507 lines, too large for dev agent context. Split into 3 files: `IMPLEMENTATION-PLAN.md` (~381 lines, overview + project structure + Phase 6 + references), `BACKEND-PLAN.md` (~2,395 lines, Phase 1 + Phase 2 + Security & Hardening), `FRONTEND-PLAN.md` (~756 lines, Phase 3 + Phase 4 + Phase 5). Overview has Document Map table pointing to each file. **(F) DATABASE-SCHEMA.md references** added throughout — Key Document References table has "All phases" row pointing to `docs/DATABASE-SCHEMA.md`.

**Session 23 progress:** Built the complete SQL database layer — views, materialized views, report function, TOAST optimization, and index cleanup. (1) **16 spatial lookup views** (`sql/05-views.sql`): `v_address_hazards`, `v_address_earthquakes`, `v_address_wildfire`, `v_address_epb`, `v_address_noise`, `v_address_air_quality`, `v_address_water_quality`, `v_address_climate`, `v_address_nzdep`, `v_address_planning`, `v_address_contamination`, `v_address_sa2`, `v_address_valuation`, `v_address_building`, `v_address_title`, `v_address_transmission`. Each uses LATERAL JOINs hitting GIST indexes. (2) **4 materialized views** (`sql/06-materialized-views.sql`): `mv_crime_density` (1,926 rows, area_unit + TA level with percentile_rank), `mv_crime_ta` (67 rows, TA-level fallback for when SA2/suburb name doesn't match crime area_unit names — only 843/1925 match nationally), `mv_rental_market` (8,442 rows, latest quarter per SA2/type/beds with YoY), `mv_rental_trends` (26,459 rows, CAGR at 1yr/3yr/5yr/10yr). Plus `area_profiles` table for future AI-generated descriptions. (3) **`get_property_report()` PL/pgSQL function** (`sql/07-report-function.sql`): Single function, single DB round-trip, returns full 16KB JSONB report. 7 sections: address, property, hazards, environment, liveability, planning, market. Crime uses SA2 name → suburb → TA fallback. Building/title use `ST_Contains` for point-in-polygon. **Performance: ~289ms warm** (down from 1,050ms after fixing missing GIST indexes). Tested across 8 suburbs: Te Aro 490ms, Karori 287ms, Miramar 326ms, Johnsonville 315ms, Island Bay 125ms, Tawa 328ms, Newtown 355ms, Hataitai 322ms. (4) **TOAST optimization** (`sql/08-toast-and-cleanup.sql`): `SET STORAGE EXTERNAL` on 13 polygon tables, VACUUM FULL on noise_contours/flood_zones. (5) **Index fixes**: Discovered building_outlines (3.2M rows) and property_titles (2.4M rows) had NO GIST indexes — ogr2ogr duplicates were dropped in cleanup but manual replacements were never created. Adding GIST indexes dropped building from 277ms→0.2ms and title from 286ms→0.2ms. Updated cleanup script to create replacement indexes before dropping duplicates. Remaining bottleneck: noise_contours (164ms) — inherently complex polygons (up to 394K points, 6.4MB per multi-polygon). Acceptable for MVP with Redis caching.

**Session 22 progress:** Component reuse audit + design system consistency pass across `ux-design-specification.md` and `IMPLEMENTATION-PLAN.md`. (1) **Icon Registry** — canonical mapping of 40+ Lucide icons to specific UI contexts with size, color class, and semantic rationale. Every accordion section now has a dedicated icon: `ShieldAlert` (Risk, `text-accent-hot`), `TreePine` (Neighbourhood, `text-success`), `TrendingUp` (Market, `text-primary`), `TrainFront` (Transport), `Landmark` (Planning), `Receipt` (Rates). Feature icons: `Sparkles` (AI), `MapPin` (nearby), `Building2`/`TrainFront` (distances), `Bus` (transit), `CheckCircle2`/`XCircle`/`Minus` (zone status), `Bookmark`/`BookmarkCheck` (saved), `Eye` (Street View), `WifiOff`/`Clock` (errors), etc. (2) **Color Semantics table** — 14 colors each with documented semantic meaning and usage rules. Key rules: `accent-warm` ONLY for user-specific data markers, `accent-hot` ONLY for danger/critical, `success` ONLY for positive outcomes. No decorative color usage. (3) **5 shared base components** added to `common/`: `PillToggleGroup` (reused in 4 places: PropertyTypeSelector, BedroomSelector, time range, layer chips), `KeyValueCard` (reused by CouncilValuationCard + DistanceToCard), `TimeSeriesChart` (Recharts wrapper with CHART_THEME, reused by RentHistoryChart + HPITrendChart), `EmptyState` (reused by NoRiskDetected + DataNotAvailable + NoRecentSearches), `ErrorState` (reused by NetworkError + TimeoutError + SectionError + RateLimitError). (4) Updated component file maps in both docs — all components now reference their base component. (5) Updated accordion section table in implementation plan with Header Icon + Icon Color columns. (6) Component-to-design-system mapping table expanded with Lucide Icon column showing exact icons per component. (7) Crash severity colors documented as risk palette mapping (coral=fatal, vermillion=serious, amber=minor, grey=non-injury). Both docs now fully aligned on design system, icons, colors, and component reuse.

**Session 21 progress:** Reverse-engineered WCC Property Search API at `services.wellington.govt.nz/property-search/` (Next.js SPA, buildId `obQ3m7R1KCyfezsI0nnlD`). Discovered 3 key endpoints: (1) address-search → returns identifier + rate account number, (2) account-search → full rates data including valuations, levies, legal description, land area, billing code, (3) Next.js data route → same data by identifier. API returns per-property: capital value, land value, total annual rates, 13-15 individual levy breakdowns (WCC/GWRC/SMF), rating category, billing code, water meter status, historical valuations. **No bedrooms/bathrooms/floor area** in any WCC API endpoint — confirmed across ArcGIS layers, JS bundles, and all API responses. Also checked QV.co.nz and homes.co.nz APIs — both require auth, no free bedroom data. Created `wcc_rates_cache` table + `scripts/populate_wcc_rates.py` (concurrent ThreadPoolExecutor, 10 workers, ~8.4 records/sec). Test: 103 records seeded successfully, full 101K Wellington population running in background (~3.3 hours). Updated `IMPLEMENTATION-PLAN.md`: added Phase 2H (WCC Rates Integration — service, router, cache upsert, endpoint), `wcc_rates_cache` table DDL in Phase 1D, RatesSection in Phase 4D accordion (8 sections now), rates.py in project structure (router, schema, service), `useRates.ts` hook.

**Session 20 progress:** Comprehensive UX flow review + 12 feature additions across `ux-design-specification.md` and `IMPLEMENTATION-PLAN.md`. **New features designed:** (1) **Rent History Chart** (`RentHistoryChart.tsx`) — SA2-level rent time series from `bonds_detailed` (1.19M records, 1993–2025). Recharts AreaChart with median line + LQ–UQ shaded band, filterable by dwelling type and beds. CAGR badges at 1yr/5yr/10yr. Bond activity sparkline. New API: `GET /api/v1/property/{address_id}/rent-history`. (2) **NZ House Price Index Chart** (`HPITrendChart.tsx`) — national HPI from `rbnz_housing` (143 records, 1990–2025). Peak annotation, market cycle context. New API: `GET /api/v1/market/hpi`. Regional HPI NOT available — investigated RBNZ `housingdata.xlsx` (ends 2017, national only, dead end), QV/CoreLogic/REINZ/Infometrics all paywalled. (3) **Nearest Essentials** row — closest supermarket, GP, pharmacy from existing `osm_amenities`. (4) **Google Street View link** — free URL scheme in Summary Card. (5) **Council Valuation Card** (`CouncilValuationCard.tsx`) — CV/LV/IV from `council_valuations` (87,799 Wellington properties), shown in both Summary Card metadata + Market section. (6) **Bookmark/Save property** — `Bookmark` icon on Summary Card, localStorage (max 20), saved list on landing page. Scaffolds future Compare feature. (7) **School zone indicator** — `CheckCircle2`/`XCircle` "In zone" column in Schools table, via `ST_Contains(school_enrolment_zones.geom, property.geom)`. (8) **Building footprint area** — from `building_outlines` ST_Area, shown in Summary Card metadata. (9) **Distance to CBD + nearest train** (`DistanceToCard.tsx`) — straight-line distances at top of Transport section. (10) **Bedroom/property type selector** — already existed in updated Market section (3-state flow with auto-detection). **Updated files:** ux-design-specification.md (wireframes, component specs, component file map: +6 new components, +3 hooks), IMPLEMENTATION-PLAN.md (2 new API endpoints in §2G-0, school zone + distance queries in get_property_report).

**Session 19 progress:** Added AI features to `IMPLEMENTATION-PLAN.md`. (1) **Area profiles** — pre-generated suburb descriptions using Azure OpenAI GPT-4o-mini, stored in `area_profiles` table (sa2_code PK, profile text, data_snapshot JSONB, model_used). Batch script queries DB for each SA2 (wind, noise, transit, schools, crime, hazards, market, planning data), calls GPT-4o-mini, stores result. Cost: ~$0.02 for Wellington 78 SA2s, ~$0.50 national. (2) **AI property summary** — real-time per-request summary blending pre-generated area profile + property report data + scores. Integrated into `/property/{id}/report` endpoint, cached 24h with report in Redis. ~$0.0005/report. Graceful fallback if Azure OpenAI unavailable. (3) Researched Azure OpenAI API — uses standard `openai` Python library with `base_url` pointed at Azure endpoint (`https://{resource}.openai.azure.com/openai/v1/`). Added to .env (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT), requirements.txt (openai>=1.60), project structure (services/ai_summary.py, scripts/generate_area_profiles.py, sql/09-area-profiles.sql). Updated build order, key references table.

**Session 18 progress:** Loaded 2 new datasets. (1) **OSM amenities** — extracted 94,991 points from Geofabrik NZ PBF (393MB) using osmium: 60,452 amenities (restaurants, cafes, banks, etc.), 14,849 shops, 10,969 tourism, 8,535 leisure, 186 healthcare. GIST + category + subcategory indexes. Test: 500m around Cuba St → 75 restaurants, 55 cafes, 68 clothing shops, 28 bars. (2) **DOC Conservation Land** — loaded 11,025 polygons from DOC open data GeoJSON (311MB): 4,125 marginal strips, 3,494 reserves, 3,391 conservation areas, 14 national parks, 1 wildlife area. Fixed EPSG:2193→4326 reprojection (source GeoJSON had NZTM coordinates stored as WGS84). GIST + land_type indexes. Test: nearest to Cuba St → Kelburn Community Buildings Reserve (833m), Government House Reserve (1.6km). Updated IMPLEMENTATION-PLAN.md: added Martin tile config (osm_amenities minzoom 13, conservation_land minzoom 10, sa2_boundaries minzoom 8), 2 new nearby endpoints (/nearby/{id}/amenities, /nearby/{id}/conservation), get_property_report references, TOAST optimization for conservation_land.

**Session 17 progress:** Comprehensive two-pass gap review of `IMPLEMENTATION-PLAN.md` against all reference docs (`RISK-SCORE-METHODOLOGY.md`, `FAIR-PRICE-ENGINE.md`, `SEARCH-GEOCODING-RESEARCH.md`, `MOBILE-UX-RESEARCH.md`, `Plan.md`, `PROGRESS.md`). Fixed 30 issues total. Key additions: (1) 8 missing indicator SQL views (earthquakes, wildfire, EPB, noise, air quality, water quality, climate, NZDep). (2) Full normalization function suite with all expert ranges, severity mapping dictionaries for 9 categorical indicators (40+ mappings), quality-weighted school scoring, contamination scoring. (3) All 27 within-category weights + 5 cross-category composite weights. (4) Full `mv_rental_market` and `mv_rental_trends` SQL (was placeholder `...`). (5) 3 missing nearby endpoints (earthquakes, infrastructure, buildings). (6) `get_property_report` expanded to reference all 39 tables (was missing property_titles, rbnz_housing, climate, NZDep, bonds_tla/region fallback). (7) Market endpoint expanded: Methods B+C, purchase price estimation, 5-star confidence, SA2→TLA→Region fallback, legal disclaimer. (8) Martin config expanded from 13 to 24 tile layers. (9) Search index verification section added. (10) Score interval for low confidence + context signals documented. Plan grew from ~1,072 to 1,516 lines — a dev agent picking it up phase-by-phase now has every SQL view, function, constant, and endpoint defined with file references.

**Session 16 progress:** Completed two pre-build research tasks. (1) **Martin tile server research:** Install via single Windows binary from GitHub releases (`martin-x86_64-pc-windows-msvc.zip`). Zero-config auto-discovery — run `martin.exe "postgresql://postgres:postgres@localhost:5432/wharescore"` and it finds all tables with geometry + GIST index. Critical setting: `minzoom` — parcels ≥12, buildings ≥13, addresses ≥14. At zoom 14 (~1km² tiles), PostGIS serves 100-500 parcels in 10-50ms. Martin benchmarked as fastest of 6 tile servers tested. No gotchas with Windows/PostgreSQL 18/PostGIS 3.6. Cache 256-512MB in-memory, Cloudflare CDN in front for production. ~15-30 min to first working tiles. (2) **Deployment & hosting plan:** Single VPS in Sydney running all services (PostGIS + Martin + FastAPI + Redis + Next.js) via Docker Compose. Recommended: Vultr High Performance Sydney, $48/mo (4 vCPU, 8GB RAM, 180GB NVMe). All services fit in ~5-6.5GB RAM. Sydney→NZ latency 25-50ms (standard for NZ tech). Self-managed PostGIS on VPS beats managed DB at this price point (full tuning control, zero inter-service latency). CDN: Cloudflare free tier (7-day cache for PBF tiles, Sydney PoP). Frontend: Vercel free tier or same VPS. Total: ~$50/mo. No data sovereignty concerns for government open data. Scale path: upgrade VPS → separate DB → multi-server as revenue grows.

**Session 15 progress:** (1) Confirmed SA2 boundaries loaded and working (2,171 polygons, all indexes, 162 Cuba St → Vivian West 251700 in 0.6ms, full address→SA2→bonds pipeline validated). (2) Reviewed UX/design readiness — `Plan.md` already covers complete visual design (palette, typography, spacing), all screen wireframes (landing, 60/40 split, mobile bottom sheet), component tree (30+ components), risk visualization (240° gauge, Okabe-Ito colorblind palette), map design (LINZ basemap), accessibility (WCAG 2.2 AA), animations, performance targets, and 28-task phased implementation plan. **No additional UX design research needed — ready to build.** (3) Added `--warm-all` mode to `fetch_market_rent.py` to bulk-fetch all 2,171 SA2s from MBIE API into `market_rent_cache`. Running in background — ~5,400+ rows cached across 560+ SA2s so far (API averages ~14s per request). Added `--reverse` and `--skip-cached` flags to support parallel instances (run second instance backwards to halve time). (4) Decision: no need to bulk-download MBIE data separately — `bonds_detailed` (1.19M records) already has 30+ years of historical SA2 rental data. API cache adds fresh rolling 6-month snapshots + active bond counts for confidence scoring.

**Session 13 progress:** MBIE Market Rent API key obtained and tested. API confirmed working — returns SA2-level median/quartile rents, bond counts, log-normal params, active bond counts. Key findings: (1) SA2 252500 = Mount Victoria (not Te Aro). Te Aro is split: Dixon Street (251600), Vivian West (251700), Vivian East (252100). (2) `dwelling-type=ALL` and `num-bedrooms=ALL` are invalid param values — must omit params and use `include-aggregates=true` instead. (3) `period-ending` must be at least 2 months ago. (4) API data closely matches `bonds_detailed` (e.g. Mt Vic 2-bed flat: API median $573 vs DB $575). (5) API adds value over static data: rolling 6-month window (smoother), `nCurr` active bond count (183 for Mt Vic), synthetic quartiles. (6) Created `market_rent_cache` table with upsert support + `fetch_market_rent.py` script. (7) Tested: cached 92 rows for 4 Wellington SA2s (Mt Vic, Dixon St, Vivian West, Mt Cook West). Cache-on-demand pattern ready for app integration.

**Session 12 progress:** Completed fair price engine research & design. Full methodology documented in `FAIR-PRICE-ENGINE.md`. Key findings: (1) bonds_detailed uses **SA2 2018 codes** (SAU2019) — need SA2 2018 boundaries from Stats NZ datafinder (layer 92212). (2) MBIE Market Rent API v2 fully documented: SA2-level, dwelling type + beds filtering, returns median/quartiles/log-normal params, needs free API key (`Ocp-Apim-Subscription-Key` header). (3) Designed three-method fair rent estimation: direct SA2 quartile lookup (primary), yield-based cross-validation, and YoY trend analysis. (4) Designed ensemble purchase price estimation: CV + HPI adjustment (primary), yield inversion (cross-check), land value/sqm comparison. (5) Defined 5-star confidence system based on bond count + CV age + method agreement. (6) Validated data quality: 424 SA2s have 30+ bonds (high confidence), 670 have 15-29, 555 have 5-14. (7) Designed fallback hierarchy: SA2 → TLA → Region for sparse areas. (8) Wrote complete database schema (sa2_boundaries table, mv_rental_market materialized view, get_market_report() function, valuation_cache table), API design, and UX wireframes.

**Session 10 progress:** (1) Reviewed full MBIE API Access Agreement (Nov 2022, 10 pages) — commercial use permitted, royalty-free, must attribute source + timestamp. Saved to `nz-property-data-sources-research.md` section 9. (2) Completed comprehensive architecture & UX design research. Wrote full implementation plan covering: tech stack (Next.js 15 + FastAPI + Martin + MapLibre + LINZ basemaps), database layer (views + materialized views + PL/pgSQL functions), API design (modular endpoints), visual design (teal palette, Inter font, Okabe-Ito colorblind-safe risk colors), mobile UX (bottom sheet 3 snap points), first-use experience, data coverage gap handling, trust signals, feedback system, sharing/export, WCAG 2.2 AA accessibility, and phased implementation priority. Full plan saved to `D:\Projects\Experiments\wharescore-poc\Plan.md`.

**Session 8 progress:** Researched and loaded all 4 Tier 4 datasets (plus bonus height controls). Loaded 5 new tables: WCC 2024 District Plan Zones (2,683 polygons, NPS-compliant 14 zone types), WCC Height Control Areas (2,365 polygons with metre values 4m-95m), GWRC Contaminated Land SLUR (2,391 polygons, daily updates, CC BY 4.0), WCC Earthquake-Prone Buildings (544 points with MBIE register URLs), GWRC Resource Consents (26,507 points, nightly updates, CC BY-ND 4.0). All validated against Cuba St: City Centre Zone, 24m height limit, 6 contaminated sites within 200m, 10 EPBs within 300m. Full Tier 4 research documented in PROGRESS.md. Total: 32 tables in PostGIS.

**Session 4 progress:** Loaded all 8 new datasets (earthquakes, schools, crashes, bonds x2, transit stops, building outlines, property titles) + extracted crime data from Tableau workbook (1.15M records). Discovered WCC ArcGIS REST API provides free CV/LV/IV for 87,799 Wellington properties. MBIE Market Rent API key being registered. Researched all legal options for building proprietary sale price dataset — auction results from interest.co.nz are the best legal path.

**Session 7 progress:** Loaded 2 Tier 2 + 4 Tier 3 datasets. **Tier 2:** GWRC wind zones (171 polygons, all Wellington region TAs) and NZTA road noise contours (19,517 polygons, Wellington region, 50-70 dB LAeq24h). National noise = 488K polygons, Wellington subset downloaded. **Tier 3:** LAWA air quality sites (72 sites nationally, PM10/PM2.5 trends from 265K daily readings), LAWA river water quality sites (1,175 sites nationally, NPS-FM A-E state bands), Heritage NZ list (7,360 heritage-listed places with coordinates from Algolia), Stats NZ wildfire risk (30 stations × 2 fuel types with VHE fire danger trends). All validated against test addresses. Cuba St: nearest air monitor 270m (Willis St, PM10 degrading), 93 heritage sites within 500m, wildfire 12 VHE days/yr (decreasing).

**Session 6 progress:** Loaded Te Waihanga National Infrastructure Pipeline — merged 10 quarterly snapshots (Q3 2023–Q4 2025, 4 CSVs + 6 Excel files) into 13,944 unique projects (572 Wellington, 1,935 geocoded nationally), deduplicated by PrimaryKey keeping most recent quarter. Researched WCC/GWRC ArcGIS for building/resource consent data — WCC consent layers are stale (2019/2004), GWRC resource consents are current (26,507 records, nightly updates). Identified additional sources: WCC Transport Planned Works, Wellington Water embedded JSON (59 projects with lat/lng), NZTA NLTP regional funding tables, Beehive RSS. Validated proximity query: 34 infrastructure projects within 5km of Cuba St including Golden Mile ($100-250M), Town Hall ($250-500M), SH1 Improvements ($1-5B).

**Session 5 progress:** Completed council ArcGIS valuation research across NZ. Confirmed Christchurch (185,784 records, CV/LV/IV) and Taranaki (64,312 records, CV/LV/address/rates) have working free endpoints. Auckland's OpenData folder requires auth token — no public valuation endpoint found. GWRC Property folder is empty. Fully analysed interest.co.nz auction results structure. Loaded 6 new Tier 1-2 hazard datasets: tsunami zones (Wellington, Canterbury, Hawke's Bay), liquefaction zones (Wellington), transmission lines (national), coastal erosion (national), climate projections (national 5km grid + 2.6M data rows). Ran full cross-layer validation — all 20 tables passing. Identified two issues: crime meshblock version mismatch (2018 vs 2023 codes) and proximity query OOM on large tables without bounding box pre-filter.

---

## What's Done

### POC Infrastructure ✅
- **Python 3.14.3** installed (use `py -3.14` to run; old 3.8 still on PATH)
- **PostgreSQL 18.2** installed at `E:\Programs\postgresql\`
- **PostGIS 3.6.1** extension enabled
- **GDAL/ogr2ogr 3.9.2** bundled with PostGIS
- **Database `wharescore`** created with PostGIS extension

### Data Downloaded & Loaded into PostGIS ✅

| Dataset | Source | Records | Table | Status |
|---------|--------|---------|-------|--------|
| NZDep2023 scores | Otago Uni (Excel) | 56,382 | `nzdep` | Loaded |
| Meshblock 2023 boundaries | Stats NZ datafinder | 57,539 | `meshblocks` | Loaded |
| NZ Addresses | LINZ Layer 105689 | 2,403,583 | `addresses` | Loaded (full national) |
| NZ Parcels | LINZ Layer 51571 | 4,254,821 | `parcels` | Loaded (full national) |
| Wellington flood zones | GWRC ArcGIS REST API | 14 | `flood_zones` | Loaded |
| GeoNet Earthquakes (M3+) | GeoNet FDSN API | 20,029 | `earthquakes` | Loaded (2015-2026, point geom) |
| NZ Schools directory | Ministry of Education | 2,568 | `schools` | Loaded (lat/lng, EQI, rolls) |
| Crash Analysis (CAS) | Waka Kotahi NZTA | 903,973 | `crashes` | Loaded (NZTM→WGS84 reprojected) |
| Bond/rental data (TLA) | MBIE Tenancy Services | 26,417 | `bonds_tla` | Loaded (monthly, 1993-present) |
| Bond/rental data (Region) | MBIE Tenancy Services | 7,110 | `bonds_region` | Loaded (monthly, 1993-present) |
| Metlink transit stops | Greater Wellington GTFS | 3,119 | `transit_stops` | Loaded (Wellington region) |
| NZ Building Outlines | LINZ Layer 101290 | 3,228,445 | `building_outlines` | Loaded (full national) |
| NZ Property Titles | LINZ Layer 50804 | 2,436,931 | `property_titles` | Loaded (full national) |
| Crime (Victimisation) | NZ Police policedata.nz | 1,153,994 | `crime` | Loaded (meshblock-level, 2022-2025) |
| Tsunami evacuation zones | GWRC ArcGIS REST + GNS shapefiles | 60 | `tsunami_zones` | Loaded (Wellington, Canterbury, Hawke's Bay) |
| Liquefaction zones | GWRC ArcGIS REST API | 502 | `liquefaction_zones` | Loaded (Wellington region) |
| Transmission lines | Transpower ArcGIS/GeoJSON | 227 | `transmission_lines` | Loaded (national) |
| Coastal erosion (CSI) | NIWA ArcGIS/GeoJSON | 1,811 | `coastal_erosion` | Loaded (national, shore segments) |
| Climate grid points | MfE / VCSN grid | 11,491 | `climate_grid` | Loaded (national 5km grid, point geom) |
| Climate projections | MfE climate change data | 2,642,930 | `climate_projections` | Loaded (SSP scenarios, seasonal, ~40 indicators) |
| Infrastructure projects | Te Waihanga Pipeline (10 files, Q3 2023–Q4 2025) | 13,944 | `infrastructure_projects` | Loaded (national, 572 Wellington, 1,935 geocoded, deduplicated by PrimaryKey, CC BY 4.0) |
| Wind zones | GWRC ArcGIS REST API | 171 | `wind_zones` | Loaded (Wellington region, 6 TAs, polygon) |
| Road noise contours | Waka Kotahi/NZTA ArcGIS | 19,517 | `noise_contours` | Loaded (Wellington region, 50-70 dB LAeq24h, polygon) |
| Air quality sites | LAWA Excel (2016-2024) | 72 | `air_quality_sites` | Loaded (national, PM10/PM2.5 trends, point geom) |
| Water quality sites | LAWA Excel (state & trend) | 1,175 | `water_quality_sites` | Loaded (national, NPS-FM A-E bands, point geom) |
| Heritage NZ list | Heritage NZ Algolia API | 7,360 | `heritage_sites` | Loaded (national, all categories, point geom) |
| Wildfire risk | Stats NZ CSVs | 60 | `wildfire_risk` | Loaded (30 stations × 2 fuel types, VHE days + trends, point geom) |
| District plan zones | WCC 2024 District Plan ArcGIS | 2,683 | `district_plan_zones` | Loaded (Wellington City, NPS-compliant 14 zones, polygon, CC BY 4.0) |
| Height controls | WCC 2024 District Plan ArcGIS | 2,365 | `height_controls` | Loaded (Wellington City, 4m-95m height limits per parcel, polygon) |
| Contaminated land (SLUR) | GWRC ArcGIS REST API | 2,391 | `contaminated_land` | Loaded (Wellington region, ANZECC categories, polygon, CC BY 4.0) |
| Earthquake-prone buildings | WCC ForwardWorks ArcGIS | 544 | `earthquake_prone_buildings` | Loaded (Wellington City, links to MBIE EPBR, point) |
| School enrolment zones | MoE via ArcGIS FeatureServer | 1,317 | `school_zones` | Loaded (national, polygon boundaries, CC BY 3.0 NZ) |
| Resource consents | GWRC ArcGIS REST API | 26,507 | `resource_consents` | Loaded (Wellington region, nightly updates, point, CC BY-ND 4.0) |
| RBNZ M10 Housing | RBNZ / CoreLogic | 143 | `rbnz_housing` | Loaded (national quarterly, HPI + sales + stock value, 1990-2025) |
| Detailed quarterly bonds | MBIE Tenancy Services | 1,189,834 | `bonds_detailed` | Loaded (SA2-level, median/quartile rents by dwelling type & beds, 1993-2025, CC BY 3.0 NZ) |
| MBIE Market Rent API cache | MBIE API (live, on-demand) | 14,646 | `market_rent_cache` | ✅ COMPLETE — 1,842/2,171 SA2s cached (329 suppressed due to low bond counts). Cache-on-demand (SA2-level, 6-month rolling, median/quartiles/log-normal/active bonds, upsert on re-fetch) |
| SA2 2018 boundaries | Eagle Technology / Stats NZ ArcGIS | 2,171 | `sa2_boundaries` | Loaded (national, generalised polygons, CC BY 4.0, joins to bonds_detailed location_id) |
| WCC property valuations | WCC ArcGIS REST API (bulk) | 87,819 | `council_valuations` | Loaded (Wellington City, CV/LV/IV/land_area per property, polygon, CC BY-SA, valued Sep 2024) |
| SA2 valuation stats | Materialized view | 78 | `mv_sa2_valuations` | Computed (Wellington City SA2s, median CV/LV/LV-per-sqm, from council_valuations × sa2_boundaries) |
| OSM amenities | Geofabrik NZ PBF (osmium extract) | 94,991 | `osm_amenities` | Loaded (national, points, amenities/shops/tourism/leisure/healthcare, name/brand/hours/phone/website) |
| DOC Conservation Land | DOC Open Data GeoJSON | 11,025 | `conservation_land` | Loaded (national, polygons, reserves/conservation areas/national parks/marginal strips, reprojected NZTM→WGS84) |
| WCC rates data | WCC Property Search API (live) | 77,352 | `wcc_rates_cache` | Complete (Wellington City, CV/LV/rates/levies per property, live API + DB cache, 78% hit rate — 78,306 OK / 21,314 misses of 99,620 addresses, misses are non-rateable: parks, roads, reserves) |
| Slope failure zones | GWRC ArcGIS MapServer layer 11 | 4,682 | `slope_failure_zones` | Loaded (Wellington region, earthquake-induced slope failure susceptibility polygons, 5 tiers: Very Low→Very High, CC BY 4.0) |

### SQL Layer Complete ✅ (session 23)
- **16 spatial views** (`sql/05-views.sql`) — per-address LATERAL lookups for all hazard/env/liveability/planning layers
- **4 materialized views** (`sql/06-materialized-views.sql`) — crime density (area_unit + TA fallback), rental market, rental trends (CAGR)
- **`get_property_report(address_id)`** (`sql/07-report-function.sql`) — single PL/pgSQL function returning full JSONB report (16KB, ~289ms warm)
- **TOAST + index cleanup** (`sql/08-toast-and-cleanup.sql`) — EXTERNAL storage on 13 tables, 13 duplicate GIST indexes dropped, replacement indexes created
- **Performance profile**: Most queries <1ms, noise contours ~164ms (complex polygons), total report 125-490ms depending on location

### Spatial Indexes Created ✅
- GIST indexes on all geometry columns (meshblocks, parcels, addresses, flood_zones, earthquakes, schools, crashes, transit_stops, building_outlines, property_titles, tsunami_zones, liquefaction_zones, transmission_lines, coastal_erosion, climate_grid, infrastructure_projects, wind_zones, noise_contours, air_quality_sites, water_quality_sites, heritage_sites, wildfire_risk, district_plan_zones, height_controls, contaminated_land, earthquake_prone_buildings, resource_consents, sa2_boundaries, council_valuations, osm_amenities, conservation_land)
- Additional indexes: addresses(address_id unique), sa2_boundaries(sa2_code unique, ta_code, regc_code), council_valuations(suburb, full_address, valuation_id, council, capital_value), mv_sa2_valuations(sa2_code unique), earthquakes(magnitude), crashes(crash_severity, crash_year), bonds(location, time_frame), bonds_detailed(location_id, time_frame, dwelling_type), crime(meshblock, territorial_authority, year_month, anzsoc_division), climate_projections(scenario, vcsn_agent), infrastructure_projects(region, sector, status, city, suburb), noise_contours(laeq24h), heritage_sites(list_entry_type), district_plan_zones(zone_name, zone_code), height_controls(height_metres, zone_name), contaminated_land(category, local_authority), resource_consents(consent_type, status), osm_amenities(category, subcategory), conservation_land(land_type), wcc_rates_cache(lower(address), rate_account_number)
- All tables analyzed

### Full Cross-Layer Validation Passing ✅ (2026-02-18)

**Test address:** 162 Cuba Street, Te Aro, Wellington

| Layer | Query Type | Result |
|-------|-----------|--------|
| Deprivation (NZDep) | Meshblock spatial join | Score 6 (mid-range) |
| Flood zone | ST_Intersects overlay | None |
| Liquefaction | ST_Intersects overlay | None (solid ground) |
| Tsunami zone | ST_Intersects overlay | None (inland) |
| Earthquakes M4+ within 30km | ST_DWithin proximity | 14 since 2015 |
| Schools within 1.5km | ST_DWithin proximity | 10 |
| Transit stops within 400m | ST_DWithin proximity | 17 |
| Serious/fatal crashes within 300m | ST_DWithin + bbox filter | 44 |
| Transmission lines within 200m | ST_DWithin proximity | 0 |
| Buildings within 50m | ST_DWithin + bbox filter | 19 |
| Crime (area unit, since 2024) | Attribute join | 5,470 victimisations (Willis St-Cambridge Tce area) |
| Climate projections | Grid point lookup | 2.6M rows across 11,491 points |
| Coastal erosion | Shore segment data | 1,811 national segments |
| Infrastructure projects within 5km | ST_DWithin proximity | 34 (inc. Golden Mile $100-250M at 309m, Town Hall $250-500M, MRT $1B+, SH1 $1-5B) |
| Wind zone | ST_Intersects overlay | M (Medium) — WCC |
| Road noise (max dB) | ST_Intersects overlay | 64 dB LAeq(24h) |
| Nearest air quality site | KNN proximity | Willis St (270m) — PM10: Degrading, PM2.5: Indeterminate |
| Nearest water quality site | KNN proximity | Kaiwharawhara Stream at Ngaio Gorge (4km) |
| Heritage sites within 500m | ST_DWithin proximity | 93 sites (nearest: Commercial Building, 20m) |
| Wildfire risk (forest) | KNN proximity | Wellington station (4km) — 12 VHE days/yr, very likely decreasing |
| District plan zone | ST_Intersects overlay | City Centre Zone (CCZ) |
| Height control | ST_Intersects overlay | 24m maximum |
| Contaminated sites within 200m | ST_DWithin proximity | 6 (nearest: Former Shell/Z Energy Vivian St, 24m, remediated) |
| Earthquake-prone buildings within 300m | ST_DWithin + bbox | 10 (nearest: 162 Cuba St, 5m) |
| Resource consents within 300m (granted) | ST_DWithin + bbox | Multiple land use, discharge, coastal |
| SA2 area | ST_Within spatial join | Vivian West (251700) — 0.6ms |
| Rental market (2-bed flat) | SA2 → bonds_detailed join | Median $590/wk, LQ $555, UQ $658 (18 bonds, Apartment) |
| OSM amenities within 500m | ST_DWithin proximity | 75 restaurants, 55 cafes, 68 clothing shops, 28 bars |
| Conservation land within 5km | ST_DWithin proximity | Kelburn Community Buildings Reserve (833m), Government House (1.6km), Wrights Hill (2.9km) |

**Test address:** 1 Te Ara O Paetutu, Petone, Lower Hutt — deprivation 1, YES flood zone (Hutt River 2300m3/s extent), wind zone High Risk (HCC), 62 dB road noise

### Known Issues ⚠️

1. **Crime meshblock version mismatch:** Crime data uses **Census 2018 meshblock codes** (e.g., `1986000`), but our meshblocks table has **Census 2023 codes** (e.g., `4016363`). Direct `crime.meshblock = meshblocks.mb2023_code` join returns 0 rows. **Workaround:** join crime via `area_unit` name or `territorial_authority` column instead of meshblock. **Long-term fix:** load Stats NZ 2018→2023 meshblock concordance table, or load 2018 meshblock boundaries.

2. **Proximity queries crash Postgres on large tables:** `ST_DWithin(geom::geography, ...)` on crashes (904K rows) or building_outlines (3.2M rows) without a bounding box pre-filter causes OOM and server crash. **Required pattern for API layer:**
```sql
-- ALWAYS use && ST_Expand() bounding box pre-filter before ST_DWithin on large tables
SELECT COUNT(*) FROM crashes c, addr
WHERE c.geom && ST_Expand(addr.geom, 0.005)  -- fast GIST index bbox check (~500m)
  AND ST_DWithin(c.geom::geography, addr.geom::geography, 300)  -- precise distance
  AND c.crash_severity IN ('Fatal Crash','Serious Crash');
```
The `&&` operator uses the GIST spatial index to quickly eliminate distant rows before the expensive geography distance calculation runs. Use `ST_Expand` degree values: 0.001 ≈ 100m, 0.005 ≈ 500m, 0.01 ≈ 1km, 0.05 ≈ 5km.

---

## What Needs To Be Done Next

### Step 1: BMAD BMM Product Design Workflows
BMM module installed (v6.0.0-Beta.8). Run each in a **fresh context window**, in order:

1. ~~`/bmad-bmm-create-product-brief`~~ — ✅ **DONE (2026-02-15)** → `_bmad-output/planning-artifacts/product-brief-Experiments-2026-02-15.md`
2. `/bmad-bmm-create-prd` — **(Required, NEXT)** Feature specs, user stories, acceptance criteria
3. `/bmad-bmm-create-ux-design` — Map overlay design, component layout, interactions, colour palette
4. `/bmad-bmm-create-architecture` — **(Required)** API endpoints, DB schema, component tree, data flow
5. `/bmad-bmm-create-epics-and-stories` — **(Required)** Break work into buildable chunks
6. `/bmad-bmm-check-implementation-readiness` — **(Required)** Verify alignment across all docs

### Product Brief Key Decisions (session 3)
- **Positioning:** "Everything the listing doesn't tell you" — consumer advocate, not a listings platform
- **Primary users:** Renters AND buyers equally
- **MVP:** All data layers, composite risk score engine, map interface with overlays, fair price indicator, no account required
- **Monetisation:** Free tier (ad-supported) must be comprehensive. Premium = per-property deep-analysis reports ($10-25), unlockable from comparison view (V2)
- **Risk engine design:** Contextualise risks with prevalence ("72% of nearby properties share this risk"), flag outliers, normalise area-common risks
- **UX principles:** "Is this helpful?" per-section feedback, subtle data source attribution, clean component UI
- **V2 features:** Save-to-list, side-by-side comparison, user accounts, premium reports, commute calculator, Tenancy Tribunal lookup
- **North star metric:** Users who search multiple properties over multiple sessions

### Additional Datasets — Tiers 1-4
**Tier 1 — High impact, direct download:**
- ~~GNS Tsunami model~~ → ✅ Loaded as `tsunami_zones` (60 zones from Wellington, Canterbury, Hawke's Bay)
- ~~Transpower transmission lines~~ → ✅ Loaded as `transmission_lines` (227 lines, national)
- ~~MfE climate projections~~ → ✅ Loaded as `climate_grid` (11,491 points) + `climate_projections` (2.6M rows)
- ~~NIWA coastal flood maps~~ → ✅ Loaded as `coastal_erosion` (1,811 shore segments, national CSI data)
- Global Solar Atlas (national 250m GeoTIFF) — `data/solar/` directory exists but empty, not loaded

**Tier 2 — High impact, same approach as flood zones:**
- ~~Wellington liquefaction~~ → ✅ Loaded as `liquefaction_zones` (502 zones from GWRC ArcGIS REST)
- ~~Wind zones~~ → ✅ Loaded as `wind_zones` (171 polygons, GWRC ArcGIS REST, all Wellington region TAs)
- ~~Road traffic noise contours~~ → ✅ Loaded as `noise_contours` (19,517 polygons, Waka Kotahi ArcGIS, Wellington region, 50-70 dB). National: 488K polygons, API available for on-demand query.

**Tier 3 — Good signal, CSV bulk:**
- ~~LAWA air quality~~ → ✅ Loaded as `air_quality_sites` (72 sites nationally, PM10/PM2.5 10-year trends, from 265K daily readings Excel)
- ~~LAWA water quality~~ → ✅ Loaded as `water_quality_sites` (1,175 sites nationally, NPS-FM A-E state bands for E.coli/ammonia/nitrate/DRP/clarity)
- ~~Heritage NZ list~~ → ✅ Loaded as `heritage_sites` (7,360 records with coordinates from Algolia search index, all categories)
- ~~Stats NZ wildfire risk~~ → ✅ Loaded as `wildfire_risk` (30 stations × 2 fuel types, VHE fire danger days + trends 1997-2023)

**Tier 4 — Council-by-council (Wellington loaded, research complete):**
- ~~District plan zoning~~ → ✅ Loaded as `district_plan_zones` (2,683 polygons, WCC 2024 NPS-compliant). Also available: Hutt City (23 zones), Upper Hutt (18 dissolved), Porirua (10 dissolved), Kapiti (412). No national dataset exists — council-by-council only.
- ~~Height controls~~ → ✅ Loaded as `height_controls` (2,365 polygons, WCC only — 4m-95m metre values per parcel). Only WCC publishes this as spatial data in Wellington.
- ~~Resource consents~~ → ✅ Loaded as `resource_consents` (26,507 points, GWRC regional RMA consents, nightly updates). WCC building/resource consents NOT available as open data (stale 2004/2019 layers only). ECan has 115K records for Canterbury expansion.
- ~~Contaminated land (HAIL/SLUR)~~ → ✅ Loaded as `contaminated_land` (2,391 polygons, GWRC SLUR, daily updates). Also available publicly: Northland (1,812), Hawke's Bay (810), Taranaki (1,386), Southland (2,071). Auckland charges $128-228/report. Canterbury/Otago require login.
- ~~Earthquake-prone buildings~~ → ✅ Loaded as `earthquake_prone_buildings` (544 points, WCC only, links to MBIE EPBR via UUID). MBIE national register (~2,865 buildings) has NO API/bulk download — SPA architecture, CSV restricted to staff. Email info@building.govt.nz for extract. **Caveat:** EPB system being overhauled (Bill first reading Dec 2025) — removing %NBS, narrowing to 3+ storey concrete/URM only.

### Infrastructure & Development Data (Session 6 Research)

**Loaded:**
- ~~Te Waihanga Infrastructure Pipeline~~ → ✅ Loaded as `infrastructure_projects` (13,944 unique projects nationally, 572 Wellington, CC BY 4.0)
  - Merged 10 quarterly snapshots (Q3 2023–Q4 2025, 4 CSVs + 6 Excel files), deduplicated by PrimaryKey keeping most recent quarter
  - 1,935 projects geocoded with lat/lng, rest queryable by region/city/suburb
  - Covers: Transport, Water, Housing, Education, Health, Community Facilities, Energy, Defence, Justice
  - Key Wellington: LGWM ($1B+ MRT, Golden Mile, City Streets), RiverLink ($500M-1B), Transmission Gully, Omaroro Reservoir, Central Library

**Available but not yet loaded:**
- **GWRC Resource Consents** — 26,507 records, **nightly updates**, ArcGIS REST at `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Resource_Consents_P/MapServer/0`. CC BY-ND 4.0. Regional consents (land use, discharge, water, coastal). Most relevant: 11,428 Land Use consents.
- **WCC Transport Planned Works** — ArcGIS Feature Service at `https://data-wcc.opendata.arcgis.com/datasets/2e590b3d04014feb9dcc8824f6ffd5cf`. CC BY 4.0.
- **Wellington Water Projects** — 59 active projects with lat/lng, embedded as `window.allProjects` JSON at `https://www.wellingtonwater.co.nz/projects`. No formal API — would need periodic scrape.
- **NZTA NLTP Funding Tables** — $3.3B Wellington transport investment 2024-27, CSV export from `https://www.nzta.govt.nz/planning-and-investment/national-land-transport-programme/2024-27-nltp/nltp-funding/regional-and-activity-tables/`. Updated daily.
- **Stats NZ Building Consents** — Monthly aggregate by TLA via Infoshare (manual CSV download). Good for consent surge detection.
- **Beehive RSS** — Real-time government announcements at `https://www.beehive.govt.nz/rss.xml`. Filterable by infrastructure/transport/housing keywords.
- **NZ Gazette** — REST API (key required, email info@gazette.govt.nz). Resource consent notifications, compulsory acquisition notices.
- **MBIE Earthquake Prone Buildings** — 544 Wellington buildings at WCC ForwardWorks layer 20. Minimal fields (address + URL to MBIE register).

**Not available / stale:**
- WCC Building Consents (ForwardWorks layer 12) — 6,039 records but **stops at Oct 2019**. Not current.
- WCC Resource Consents (ForwardWorks layer 13) — 10,388 records but **stops at Dec 2004**. Historical only.
- Kainga Ora Pipeline — No API, web-only project cards at `https://engage.kaingaora.govt.nz/wellington-city`. Pipeline heavily cut (60% of 2025 projects axed nationally). Specified Development Projects Hub returns 403.
- LGWM — No structured spatial data published. Only WCC Reveal_POC underground utility survey layers exist.

### Market Price & Valuation Data Strategy

**MBIE Market Rent API** ✅ (free, API key obtained and tested)
- Provides aggregate rent stats down to **SA2 level** (≈ suburb) — much better than our TLA-level bond CSVs
- Endpoint: `https://api.business.govt.nz/gateway/tenancy-services/market-rent/v2/statistics`
- Auth: `Ocp-Apim-Subscription-Key` header (key stored in `.env`)
- Returns: median, LQ, UQ, mean, std_dev, log-normal params (lmean/lsd), synthetic quartiles (slq/suq), bond counts (nLodged/nClosed/nCurr), bond-rent ratio
- **Cache-on-demand pattern implemented:** `market_rent_cache` table + `fetch_market_rent.py` script. Query API when user views a property, cache for 7 days, upsert on re-fetch.
- **Gotchas:** `period-ending` must be ≥2 months ago; `dwelling-type=ALL` / `num-bedrooms=ALL` are invalid — omit params and use `include-aggregates=true` instead
- **SA2 name mapping:** API returns area names not codes. For single-SA2 queries this is unambiguous. Key Wellington mappings: 252500=Mount Victoria, 251600=Dixon Street, 251700=Vivian West, 252100=Vivian East, 252000=Mount Cook West, 251200=Aro Valley, 251400=Wellington Central

**RBNZ M10 Housing Data** (free, download now)
- House Price Index + sales volumes by council area, quarterly, from 1990
- Download: https://www.rbnz.govt.nz/-/media/project/sites/rbnz/files/statistics/key-statistics/housingdata.xlsx
- Source: CoreLogic. No commercial restrictions.

**Council RV/CV via ArcGIS REST APIs** (free, no API key needed)

- **WCC CONFIRMED WORKING:** `https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0`
  - 87,799 Wellington properties with: CapitalValue, LandValue, ImprovementsValue, Address, Title, LandArea, ValuationDate, LegalDescription
  - Query example: `?where=FullAddress+LIKE+'%259E%2530+Taranaki%25'&outFields=*&f=json&returnGeometry=false`
  - Tested: 9E/30 Taranaki St → CV $730k, LV $220k, IV $510k (valued 01/09/2024)
  - CC-BY-SA licence

- **CCC (Christchurch) CONFIRMED WORKING:** `https://gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/0`
  - **185,784 records** — CapitalValue, LandValue, ImprovementsValue, ValuationReference, RateLegalDescription
  - Point geometry in NZTM (EPSG:2193)
  - **No address field** in layer 0 — need to cross-reference with layer 1 (RatingUnit) which has StreetAddress, LocalityName
  - Layer 1 URL: `https://gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/1`
  - Query example: `MapServer/0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=3`
  - Tested: returned records with CV $7.7M, $2.65M, $3.44M (commercial/rural properties)

- **TARANAKI CONFIRMED WORKING:** `https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/Property_Rating/FeatureServer/0`
  - **64,312 records** — Capital_Value, Land_Value, Property_Address, Legal_Description, Land_Area, District_Rates, Regional_Rates, Total_Rates, Valuation_Date, Assessment
  - Polygon geometry in NZTM (EPSG:2193)
  - Covers all Taranaki district councils
  - Query example: `FeatureServer/0/query?where=Property_Address+LIKE+%27%25Devon%25%27&outFields=*&f=json&resultRecordCount=3`
  - Tested: 6 Devon St Patea → CV $350k, LV $85k (valued 01/09/2024)

- **Auckland Council: NO PUBLIC VALUATION ENDPOINT FOUND**
  - `mapspublic.aucklandcouncil.govt.nz/arcgis3/rest/services/` has folders: ElevationImage, GPTools, NonCouncil, OpenData, Utilities, Website
  - OpenData folder returns `{"error":{"code":499,"message":"Token Required"}}` — requires authentication
  - Open data portal (data-aucklandcouncil.opendata.arcgis.com) has planning/environment data but no property valuations
  - Their property lookup at aucklandcouncil.govt.nz uses a Next.js app with hidden backend API — would need browser DevTools to discover endpoint
  - **Strategy:** Would need to inspect network traffic on the Auckland property lookup page to find the underlying API

- **GWRC (Wellington Regional): EMPTY**
  - `mapping.gw.govt.nz/arcgis/rest/services/Property` folder exists but contains zero services
  - Does NOT serve as a shared property layer for Wellington-region councils

- **Other councils checked but no valuation endpoints confirmed:**
  - Hutt City, Porirua, Upper Hutt, Kapiti Coast — have ArcGIS Hub open data portals but need deeper layer exploration
  - Hamilton, Tauranga, Dunedin — no confirmed ArcGIS REST property valuation endpoints
  - **Strategy:** Query on-demand when users search + cache results. Prioritise Auckland (largest market, needs DevTools research).

- **Bulk DVR not available** — commercially licensed to CoreLogic/QV. But per-property REST queries are free.

**Public auction results via interest.co.nz** (best option for building own sale price dataset)

- **Main URL:** `https://www.interest.co.nz/property/residential-auction-results`
- **Format:** Card-based layout (not HTML table), each property has its own entry
- **Data fields per property:**
  - Property image (thumbnail)
  - Full address (region, suburb, street)
  - Bedrooms, bathrooms, parking
  - Auction result ("Sold for $X" or "passed in")
  - Rating Valuation (RV)
  - Agent names + agency
  - Auction date
  - External links: QV property report, realestate.co.nz listing
- **Navigation:** "Load more" button (infinite scroll / AJAX), region/district/suburb filters at top
- **robots.txt:** No restrictions on `/property/` paths — only `/admin/`, `/user/`, `/search/` blocked
- **Legal:** Auction prices are publicly announced facts — legally safe to collect. No database right in NZ law.
- **Volume:** ~10,000-20,000 results/year, covering ~30% of NZ property sales. Auckland dominates (60-70%).
- **Agencies covered:** Barfoot & Thompson (largest), Harcourts, Bayleys, Ray White, others
- **Example result (17 Feb 2026):** 36 Dromoland Drive, Flat Bush | 4 bed, 3 bath, 2 parking | Sold $1,300,000 | RV $1,325,000 | Ray White
- **Old format:** `/property/sales-and-auctions-auckland-residential` has older HTML table format (2014-era) with PDF links
- **Collector feasibility:** HIGH — server-rendered HTML, standard HTTP fetch, no auth, no CAPTCHAs. "Load more" likely uses AJAX endpoint (needs browser DevTools to discover exact URL/params). Build with Python requests + BeautifulSoup.
- **Recommended approach:** Start with Barfoot & Thompson (highest volume), prototype parser, then expand to other agencies

**Trade Me Property API** (free but restrictive terms)
- Has asking prices, RV, property details, lat/lng for active listings
- **Terms prohibit data aggregation and combining with other sources** — dealbreaker without written permission
- URL: https://developer.trademe.co.nz/api-reference/search-methods/residential-search

**RBNZ M10 Housing Data** — ⚠️ Files in `data/bonds/rbnz-housing-data.xlsx` and `rbnz-housing-m10.xlsx` are **HTML pages** (~7KB each), not actual Excel files — RBNZ site returned its webpage instead of the download. User needs to manually download from https://www.rbnz.govt.nz/statistics/series/economic-indicators/housing via browser and save to `data/bonds/`.

**MBIE Market Rent API** — ✅ Bulk warm COMPLETE (2026-03-08). 14,646 rows cached across 1,842/2,171 SA2s (329 suppressed — too few bonds for statistical disclosure). Key in `.env`. **API Access Agreement reviewed (2026-03-02)** — commercial use permitted, royalty-free, must attribute "Data sourced from the [Register name]" with search timestamp. Full terms in `nz-property-data-sources-research.md` section 9.

**What doesn't exist as open data:**
- Individual property sale prices (held commercially by CoreLogic/QV/REINZ)
- Bulk council rating valuations (commercially licensed, but per-property REST queries work — see WCC above)
- Historical rents per property (privacy protected)

**Still to explore in next session:**
- ~~SA2 2018 boundaries~~ → ✅ Done (session 14). Downloaded from ArcGIS Hub (Eagle Technology mirror), loaded 2,171 polygons. 99.8% SA2 code match. Address→SA2 join: 0.6ms.
- Auckland Council: Use browser DevTools on their property rates lookup page to discover the underlying API endpoint
- Hutt City / Porirua / Upper Hutt / Kapiti open data portals: deeper layer exploration for property/valuation FeatureServers
- interest.co.nz: Use browser DevTools to discover the "Load more" AJAX endpoint URL/params, then build prototype collector
- ~~MBIE Market Rent API: Complete API key registration and test the endpoint~~ → ✅ Done (session 13)
- RBNZ M10 Housing Data: Manual browser download needed (site blocks curl)

### Step 3: Build (after design docs are complete)
- FastAPI + PostGIS API
- MapLibre GL JS frontend with interactive overlays
- Use `/bmad-bmm-sprint-planning` → `/bmad-bmm-dev-story` workflow

### Tech Stack Confirmed
- **Backend:** FastAPI (async, best Python spatial ecosystem, auto-docs)
- **Frontend map:** MapLibre GL JS (free, open-source, WebGL, no vendor lock-in)
- **Approach:** API-driven overlays for POC, vector tiles later for scale

---

## Project Files
```
D:\Projects\Experiments\wharescore-poc\
  data/
    nzdep/
      NZDep2023_MB2023.xlsx               ✅ Downloaded & loaded
      meshblock-2023-generalised.gpkg     ✅ Downloaded & loaded
      statsnz-meshblock-2023-generalised-GPKG.zip  (source zip)
    linz/
      nz-addresses.gpkg                   ✅ Downloaded & loaded (Layer 105689, full NZ)
      nz-parcels.gpkg                     ✅ Downloaded & loaded (Layer 51571, full NZ)
      nz-building-outlines.gpkg           ✅ Downloaded & loaded (3,228,445 outlines)
      nz-property-titles.gpkg            ✅ Downloaded & loaded (2,436,931 titles)
      lds-nz-addresses-GPKG.zip           (source zip)
      lds-nz-parcels-GPKG.zip             (source zip)
      lds-nz-building-outlines-GPKG.zip   (source zip)
      lds-nz-property-titles-GPKG.zip     (source zip)
    flood/
      flood_combined.gpkg                 ✅ Combined from GWRC REST API & loaded
      flood_*.json                        Individual Esri JSON files (source)
      wellington-flood-zones.geojson      (original broken GeoJSON — do not use)
    earthquake/
      nz-earthquakes-m3plus.csv           ✅ Downloaded & loaded (20,029 quakes)
    schools/
      nz-schools-directory.csv            ✅ Downloaded & loaded (2,568 schools)
    crash/
      Crash_Analysis_System_(CAS)_data.csv ✅ Downloaded & loaded (903,973 crashes)
    bonds/
      Detailed-Monthly-TLA-Tenancy.csv    ✅ Downloaded & loaded (26,417 records)
      Detailed-Monthly-Region-Tenancy.csv ✅ Downloaded & loaded (7,110 records)
      hm10.xlsx                           ✅ Downloaded & loaded (RBNZ M10, 143 quarterly records)
      Detailed-Quarterly-Tenancy-Q1-2020-Q3-2025.csv  ✅ Downloaded & loaded (229K rows)
      Detailed-Quarterly-Tenancy-Q1-1993-Q4-2019.zip  ✅ Downloaded & extracted
      Detailed Quarterly Tenancy Q1 1993 - Q4 2019.csv ✅ Loaded (960K rows)
    transit/
      metlink-gtfs-full.zip               ✅ Downloaded, stops extracted & loaded (3,119 stops)
      stops.txt                           Extracted from GTFS zip
    crime/
      victimisations-time-place.csv       ✅ Extracted from Tableau & loaded (1,153,994 records)
    climate/
      climate-projections-mmm.parquet     ✅ MfE climate projections (591MB Parquet)
      vcsn-grid-points.gpkg              ✅ VCSN grid points (11,491 points)
      climate_grid_load.sql              Generated PGDUMP for grid points
    coastal-flood/
      csi-erosion.geojson                ✅ NIWA coastal erosion segments
      csi_erosion_load.sql               Generated PGDUMP
    liquefaction/
      wellington-liquefaction.json       ✅ Source Esri JSON from GWRC REST API
      wellington-liquefaction.gpkg       ✅ Converted GeoPackage
      liquefaction_zones_load.sql        Generated PGDUMP
    transpower/
      transmission-lines.geojson         ✅ Transpower national transmission lines
      transmission_lines_load.sql        Generated PGDUMP
    tsunami/
      wellington-tsunami.json            ✅ Source Esri JSON from GWRC REST API
      wellington-tsunami.gpkg            ✅ Converted GeoPackage
      canterbury-tsunami-zones.zip       ✅ GNS Canterbury zones
      hawkesbay-tsunami-zones.zip        ✅ GNS Hawke's Bay zones
      tsunami_zones_load.sql             Generated PGDUMP
      auckland-tsunami-zones.zip         ⚠️ Tiny (183 bytes) — likely failed download
      bop-tsunami-zones.zip              ⚠️ Tiny (53 bytes) — likely failed download
      wellington-tsunami-zones.zip       ⚠️ Tiny (113 bytes) — likely failed download (used REST API instead)
    sa2/
      sa2-2018-generalised.geojson       ✅ Downloaded & loaded (2,171 SA2 polygons, national)
      sa2_boundaries_load.sql            Generated PGDUMP
    osm/
      new-zealand-latest.osm.pbf         ✅ Downloaded & loaded (393MB, 94,991 amenities extracted via osmium)
    doc-conservation/
      doc-public-conservation-land.geojson ✅ Downloaded & loaded (311MB, 11,025 polygons, EPSG:2193→4326)
    solar/                                Empty — Global Solar Atlas GeoTIFF not downloaded
    infrastructure/
      pipeline-data-2023-09.csv           ✅ Downloaded & loaded (4,572 projects, Te Waihanga Pipeline)
  scripts/
    load_nzdep.py                         ✅ Working (fixed sheet name handling)
    load_all_datasets.py                  ✅ Loads all CSV datasets (earthquakes, schools, crashes, bonds, transit)
    load_infrastructure.py                ✅ Loads Te Waihanga Pipeline CSV+Excel into PostGIS (merged, deduplicated)
    load_climate_projections.py           ✅ Loads MfE climate projections Parquet into PostGIS
    load_bonds_detailed.py                ✅ Loads detailed quarterly bond CSVs (SA2-level, 1993-2025)
    load_rbnz_housing.py                  ✅ Loads RBNZ M10 housing xlsx (national quarterly)
    load_tier4_datasets.py                ✅ Loads 5 Tier 4 datasets from ArcGIS REST APIs (zones, heights, SLUR, EPB, consents)
    fetch_market_rent.py                  ✅ Fetches MBIE Market Rent API → market_rent_cache table (on-demand, upsert)
    load_wcc_valuations.py                ✅ Bulk downloads WCC property valuations → council_valuations table (87,819 properties)
    load_osm_amenities.py                 ✅ Extracts amenities from Geofabrik NZ PBF → osm_amenities table (94,991 points)
    load_doc_conservation.py              ✅ Loads DOC conservation land GeoJSON → conservation_land table (11,025 polygons)
    load_spatial_data.bat                  ⚠️ Outdated — see loading notes below
  sql/
    01-create-database.sql                ✅ Used
    02-create-tables.sql                  ✅ Used
    03-create-indexes-views.sql           ⚠️ Needs update for column name changes
    04-validation-query.sql               ⚠️ Needs update: ogc_fid → objectid
  README.md                               ✅ Written
```

### Research Documents
- `D:\Projects\Experiments\_bmad-output\brainstorming\brainstorming-session-2026-02-10.md` — Day 1: 100 ideas, original vision
- `D:\Projects\Experiments\_bmad-output\brainstorming\brainstorming-session-2026-02-11.md` — Day 2: 100 ideas, data feasibility, market gap, MVP scope, monetisation
- `D:\Projects\Experiments\_bmad-output\brainstorming\nz-data-sources-research.md` — Government data catalog, spatial join architecture, tech stack
- `D:\Projects\Experiments\_bmad-output\brainstorming\nz-property-data-sources-research.md` — Commercial site TOS, legal framework
- `D:\Projects\Experiments\_bmad-output\brainstorming\poc-data-setup-guide.md` — Detailed POC setup with download URLs and SQL commands

### Planning Artifacts
- `D:\Projects\Experiments\_bmad-output\planning-artifacts\product-brief-Experiments-2026-02-15.md` — ✅ Product Brief (complete)
- `D:\Projects\Experiments\wharescore-poc\Plan.md` — ✅ Architecture & UX Design Plan (complete, 2026-03-02)
- `D:\Projects\Experiments\wharescore-poc\RISK-SCORE-METHODOLOGY.md` — ✅ Risk Score Methodology (complete, 2026-03-03)
- `D:\Projects\Experiments\wharescore-poc\SEARCH-GEOCODING-RESEARCH.md` — ✅ Search & Geocoding Research (complete, 2026-03-04)
- `D:\Projects\Experiments\wharescore-poc\FAIR-PRICE-ENGINE.md` — ✅ Fair Price Engine Research & Design (complete, 2026-03-05)
- `D:\Projects\Experiments\wharescore-poc\IMPLEMENTATION-PLAN.md` — ✅ Implementation Plan Overview (updated 2026-03-08) — build order, project structure, Phase 6, document map
- `D:\Projects\Experiments\wharescore-poc\BACKEND-PLAN.md` — ✅ Backend Plan (split from IMPLEMENTATION-PLAN.md, 2026-03-08) — Phase 1 (Database) + Phase 2 (FastAPI) + Security & Hardening (~2,395 lines)
- `D:\Projects\Experiments\wharescore-poc\FRONTEND-PLAN.md` — ✅ Frontend Plan (split from IMPLEMENTATION-PLAN.md, 2026-03-08) — Phase 3 (Shell) + Phase 4 (Report UI) + Phase 5 (Search) (~756 lines)

---

## All Verified Dataset URLs

### Already loaded in PostGIS
| Dataset | URL | Licence |
|---------|-----|---------|
| NZDep2023 Excel | Manual download from Otago Uni HIRP page (blocks automated downloads) | CC-BY 4.0 |
| Meshblock boundaries | https://datafinder.stats.govt.nz/layer/111228-meshblock-2023-generalised/ | CC-BY 4.0 |
| NZ Addresses | https://data.linz.govt.nz/layer/105689-nz-addresses/ | CC-BY 4.0 |
| NZ Parcels | https://data.linz.govt.nz/layer/51571-nz-parcels/ | CC-BY 4.0 |
| Wellington flood zones | GWRC REST API: `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Flood_Hazards_Areas/MapServer/2` | Free/open |
| GeoNet Earthquakes | FDSN API: `https://service.geonet.org.nz/fdsnws/event/1/query?format=text&minmagnitude=3&...` | CC-BY 3.0 NZ |
| School directory | https://www.educationcounts.govt.nz/directories/list-of-nz-schools | CC-BY 4.0 |
| Bond/rental (TLA) | https://www.tenancy.govt.nz/assets/Uploads/Tenancy/Rental-bond-data/rentalbond-data-tla.csv | CC-BY |
| Bond/rental (Region) | MBIE Tenancy Services (monthly by region) | CC-BY |
| Metlink GTFS | https://static.opendata.metlink.org.nz/v1/gtfs/full.zip | CC-BY 4.0 |
| NZ Property Titles | https://data.linz.govt.nz/layer/50804-nz-property-titles/ | CC-BY 4.0 |
| NZ Building Outlines | https://data.linz.govt.nz/layer/101290-nz-building-outlines/ | CC-BY 4.0 |
| Crash Analysis (CAS) | https://opendata-nzta.opendata.arcgis.com/datasets/NZTA::crash-analysis-system-cas-data-1/about | CC-BY 4.0 |
| Crime (Victimisation) | Extracted from Tableau workbook at `https://public.tableau.com/views/VictimisationsTimeandPlace/Summary` | CC-BY 4.0 |
| Tsunami evacuation zones | GWRC REST API + GNS shapefiles (Canterbury, Hawke's Bay) | CC-BY 4.0 |
| Liquefaction zones | GWRC REST API: `https://mapping.gw.govt.nz/arcgis/rest/services/` | Free/open |
| Transmission lines | Transpower via ArcGIS/GeoJSON | CC-BY 4.0 |
| Coastal erosion (CSI) | NIWA via ArcGIS/GeoJSON | CC-BY 4.0 |
| Climate grid (VCSN) | MfE / NIWA VCSN grid GeoPackage | CC-BY 4.0 |
| Climate projections | MfE climate projections Parquet (MMM ensemble, SSP scenarios) | CC-BY 4.0 |
| Infrastructure projects | Te Waihanga Pipeline CSV: `https://tewaihanga.govt.nz/media/qd5hm2hh/pipeline-data-as-at-29092023.csv` | CC-BY 4.0 |
| SA2 2018 boundaries | ArcGIS Hub (Eagle Technology): `https://hub.arcgis.com/api/download/v1/items/0c0a139373724862b58e9a0f1bff6098/geojson?redirect=false&layers=0` | CC-BY 4.0 |

### Confirmed live API endpoints (query on-demand, not loaded into PostGIS)
| Endpoint | URL | Records | Fields | Notes |
|----------|-----|---------|--------|-------|
| WCC Property Valuations | `https://gis.wcc.govt.nz/arcgis/rest/services/PropertyAndBoundaries/Property/MapServer/0` | 87,799 | CV, LV, IV, Address, Title, LandArea, ValuationDate | CC-BY-SA |
| CCC Rating Unit Values | `https://gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/0` | 185,784 | CV, LV, IV, ValuationRef, LegalDescription (no address — join with layer 1) | Untested licence |
| CCC Rating Unit (addresses) | `https://gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/1` | — | StreetAddress, LocalityName, LegalDescription | Join to layer 0 via ValuationRollNumber |
| Taranaki Property Rating | `https://services.arcgis.com/MMPHUPU6MnEt0lEK/arcgis/rest/services/Property_Rating/FeatureServer/0` | 64,312 | CV, LV, Address, LegalDesc, LandArea, Rates, ValuationDate | All Taranaki districts |
| interest.co.nz Auction Results | `https://www.interest.co.nz/property/residential-auction-results` | ~10-20k/yr | Address, SalePrice, RV, Beds/Baths, Agency, Date | robots.txt allows; needs collector |

### Confirmed live API endpoints (query on-demand, cached in PostGIS)
| Endpoint | URL | Cache Table | Status |
|----------|-----|-------------|--------|
| MBIE Market Rent API v2 | `https://api.business.govt.nz/gateway/tenancy-services/market-rent/v2/statistics` | `market_rent_cache` | ✅ Bulk warm complete — 14,646 rows, 1,842/2,171 SA2s (329 suppressed) |

### Future / optional downloads
| Dataset | URL | Licence | Notes |
|---------|-----|---------|-------|
| NZ Title Owners | https://data.linz.govt.nz/table/51564-nz-property-title-owners-list/ | Restricted | Requires special LINZ licence for personal data. |

### Excluded
| Dataset | Reason |
|---------|--------|
| GNS Active Faults (NZAFD) | **Non-commercial licence** — cannot use if WhareScore is commercial |

### Future / Post-MVP
| Dataset | URL | Notes |
|---------|-----|-------|
| DOC Conservation/Tracks | https://doc-deptconservation.opendata.arcgis.com | Nature proximity scoring |
| Broadband coverage | https://broadbandmap.nz | Viewing only — bulk needs MBIE request |
| ERO School Reviews | https://ero.govt.nz | Scraping required, no API |
| Tenancy Tribunal Decisions | https://www.justice.govt.nz/tribunals/tenancy-tribunal/tenancy-tribunal-decisions/ | Scraping required |
| Census 2023 Demographics | https://nzdotstat.stats.govt.nz | Many tables — need to choose which |
| Liquefaction zones (other regions) | Other council GIS portals | Wellington loaded; other regions council-by-council |

---

## Key Differences from Original Plan

| Item | Original Plan | Actual |
|------|--------------|--------|
| Python | 3.13 | 3.14.3 (use `py -3.14`) |
| PostgreSQL | 16 | 18.2 |
| PostGIS | 3.4 | 3.6.1 |
| PostgreSQL path | `C:\Program Files\PostgreSQL\16\bin\` | `E:\Programs\postgresql\bin\` |
| Address layer | Layer 53353 (NZ Street Address) | Layer 105689 (NZ Addresses) — old layer 404'd |
| Address table name | `nz-street-address` | `addresses` (loaded via ogr2ogr as `addresses`) |
| Flood zone source | Koordinates/GeoPackage | GWRC ArcGIS REST API → Esri JSON → GeoPackage |
| Flood zone ID column | `ogc_fid` | `objectid` |
| Meshblock join column | `mb2023_code` (planned) | `mb2023_v1_00` renamed to `mb2023_code` after load |
| Data loading | `load_spatial_data.bat` with ogr2ogr PostgreSQL driver | ogr2ogr PGDUMP → psql (PostgreSQL driver not in bundled GDAL) |
| Data scope | Wellington clip | Full national (addresses + parcels) |

### Loading Approach (for reference)
The bundled ogr2ogr doesn't have the PostgreSQL driver. Instead:
1. Use ogr2ogr with PGDUMP format to generate SQL files
2. Load SQL files with psql
3. Must set `PROJ_DATA="E:/Programs/postgresql/share/contrib/postgis-3.6/proj"` for reprojection
4. Must set `PGPASSWORD=postgres` for psql

Example:
```bash
PROJ_DATA="E:/Programs/postgresql/share/contrib/postgis-3.6/proj" "E:/Programs/postgresql/bin/ogr2ogr.exe" -f "PGDUMP" output.sql input.gpkg -t_srs EPSG:4326 -nln table_name --config PG_USE_COPY YES
PGPASSWORD=postgres "E:/Programs/postgresql/bin/psql.exe" -U postgres -d wharescore -q -f output.sql
```

For flood zones specifically, source CRS must be specified:
```bash
PROJ_DATA="E:/Programs/postgresql/share/contrib/postgis-3.6/proj" "E:/Programs/postgresql/bin/ogr2ogr.exe" -f "GPKG" output.gpkg input.json -s_srs EPSG:2193 -t_srs EPSG:4326 -nln flood_zones -nlt MULTIPOLYGON
```

---

## Key Configuration Values

| Setting | Value | Notes |
|---------|-------|-------|
| Database name | `wharescore` | |
| DB user | `postgres` | |
| DB password | `postgres` | |
| DB host | `localhost` | |
| DB port | `5432` | |
| PostgreSQL bin | `E:\Programs\postgresql\bin\` | psql.exe, ogr2ogr.exe |
| PROJ_DATA | `E:\Programs\postgresql\share\contrib\postgis-3.6\proj` | Required for ogr2ogr reprojection |
| Projection | EPSG:4326 (WGS84) | All data transformed on load |
| Source projection (LINZ) | EPSG:4167 (NZGD2000) | Practically identical to WGS84 |
| Source projection (Stats NZ, GWRC) | EPSG:2193 (NZTM2000) | Transformed on load |

---

## Data Source Details

### NZDep2023
- **Producer:** University of Otago, Wellington — HIRP
- **Version:** NZDep2023, released October 2024, based on 2023 Census
- **Landing page:** https://www.otago.ac.nz/wellington/research/groups/research-groups-in-the-department-of-public-health/hirp/socioeconomic-deprivation-indexes-nzdep-and-nzidep-department-of-public-health
- **Meshblock download:** Manual browser download required (site blocks curl/automated downloads)
- **Excel structure:** Sheet `NZDep2023_MB2023` contains data (first sheet is notes/metadata)
- **Join key:** `MB2023_code` (7 digits with leading zeros) joins to Stats NZ meshblock boundaries column `mb2023_code` (renamed from `mb2023_v1_00`)

### Wellington Flood Zones
- **Producer:** Greater Wellington Regional Council (GWRC)
- **ArcGIS REST endpoint:** `https://mapping.gw.govt.nz/arcgis/rest/services/GW/Flood_Hazards_Areas/MapServer/2`
- **Downloaded via:** Individual feature queries (OBJECTID-based) as Esri JSON, combined into GeoPackage via ogr2ogr
- **Source CRS:** EPSG:2193 — must use `-s_srs EPSG:2193` with ogr2ogr
- **14 flood hazard extents** covering rivers/streams across Wellington region (1% AEP / 1-in-100 year events)

### GeoNet Earthquakes
- **Producer:** GNS Science / GeoNet
- **API:** FDSN Web Service at `https://service.geonet.org.nz/fdsnws/event/1/query`
- **Format:** Pipe-delimited text with header. Fields: EventID, Time, Latitude, Longitude, Depth/km, Magnitude, EventLocationName, EventType
- **Limit:** 10,000 events per request — split time ranges if more needed
- **Downloaded:** 20,029 events (M3+, 2015-01-01 to 2026-02-14)
- **CRS:** WGS84 (lat/lng) — no reprojection needed

## Research Priorities (2026-03-03)

| Priority | Topic | Status | Why |
|----------|-------|--------|-----|
| **Must do before building** | Risk score methodology | ✅ Done | Full methodology in `RISK-SCORE-METHODOLOGY.md` — 27 scoring indicators, 5 categories, softmax for hazards, geometric mean composite, expert-range normalization, confidence system |
| **Must do before building** | Search/geocoding prototype | ✅ Done | Benchmarked 3 strategies on live DB. B-tree prefix: 0.07ms, tsvector: 3-35ms, trigram: 26ms-2s. Three-tier strategy defined in `SEARCH-GEOCODING-RESEARCH.md`. Created indexes. No external search engine needed. |
| **Should do before building** | Deployment & hosting plan | ✅ Done | Vultr Sydney VPS $48/mo, Docker Compose (PostGIS+Martin+FastAPI+Redis+Next.js), Cloudflare CDN, ~$50/mo total. Details in session 16 notes. |
| **Should do before building** | Martin tile server testing | ✅ Researched, ready to test | Single binary, auto-discovers tables, `minzoom` 12-14 for large tables, 10-50ms/tile at zoom 14+. Download and run to validate. |
| **Can research during build** | Fair price engine pipeline | ✅ Done | Full methodology in `FAIR-PRICE-ENGINE.md` — 3-method rent estimation, ensemble value estimation, confidence system, MBIE API tested & cache-on-demand built (`market_rent_cache` + `fetch_market_rent.py`), DB schema, API design |
| **Can research during build** | Auth & payments | ⬜ Not started | Only needed for premium, not core MVP |
| **Can research during build** | Data refresh automation | ⬜ Not started | Manual refresh is fine for beta |
| **Can research during build** | Legal/privacy specifics | ⬜ Not started | Low risk for beta, formalize before public launch |

---

## Tech Stack Decisions

| Component | Choice | Reason |
|-----------|--------|--------|
| Database | PostGIS (PostgreSQL 18.2) | Industry standard for spatial data |
| Python DB driver | psycopg v3 | psycopg2 won't build on Python 3.8/Windows without MSVC |
| Spatial data format | GeoPackage (.gpkg) | Modern, single-file, no field name limits |
| Data loading | ogr2ogr PGDUMP → psql | PostgreSQL driver not in bundled GDAL |
| Map display (future) | MapLibre GL JS | Free, open source, vector tiles |
| Routing (future) | Valhalla or OSRM | Self-hosted, free |
| Tile server | Martin v1.3.1 (Rust) | Fastest benchmarked, single binary, auto-discovers PostGIS tables |
| Hosting | Vultr High Performance, Sydney | $48/mo, 4 vCPU, 8GB RAM, 180GB NVMe, 25-50ms to NZ |
| CDN | Cloudflare Free | 7-day edge cache for PBF tiles, Sydney PoP |
| Frontend hosting | Vercel Free Tier (or same VPS) | Offloads SSR, global CDN, 100GB bandwidth |
| Backups | pg_dump → Cloudflare R2 Free + VPS snapshots | Daily compressed SQL, weekly VPS snapshot |

### Martin Tile Server Configuration (Session 16 Research)

**Installation:** Download `martin-x86_64-pc-windows-msvc.zip` from https://github.com/maplibre/martin/releases — single `martin.exe`, no dependencies.

**Quick start (auto-discovery, zero config):**
```bash
martin.exe "postgresql://postgres:postgres@localhost:5432/wharescore"
```
Auto-discovers all tables with geometry column + GIST index. Serves tiles on port 3000.

**Critical `minzoom` settings for large tables:**

| Table | Rows | minzoom | Rationale |
|-------|------|---------|-----------|
| parcels | 4,254,821 | 12 | ~1:50,000 scale, polygons distinguishable |
| building_outlines | 3,228,445 | 13 | Slightly smaller features |
| addresses | 2,403,583 | 14 | Points, need higher zoom |
| All other tables | <30K | 0-6 | Small enough for any zoom |

**Performance expectations:**

| Zoom | Tile coverage | Parcels/tile | Latency |
|------|--------------|-------------|---------|
| 12 | ~16 km | 2,000-10,000 | 200-500ms (marginal) |
| 14 | ~4 km | 100-500 | 10-50ms (fast) |
| 15+ | <2 km | 10-200 | 5-20ms (very fast) |

Cached tiles served in sub-millisecond. Set `cache_size_mb: 512` for POC.

**Config file generation:** `martin.exe "postgresql://..." --save-config config.yaml` then edit minzoom/maxzoom per table.

**Test endpoints:**
- `curl http://localhost:3000/catalog` — list all sources
- `curl http://localhost:3000/parcels` — TileJSON for MapLibre
- `curl http://localhost:3000/parcels/14/16143/10029` — single tile over Wellington CBD
- `curl http://localhost:3000/parcels,building_outlines/14/16143/10029` — composite tile

**No compatibility issues** with Windows 10, PostgreSQL 18.2, or PostGIS 3.6.1.

### Deployment & Hosting Plan (Session 16 Research)

**MVP Architecture: Single VPS, Docker Compose**

```
Docker Compose services:
  postgres    (PostGIS 3.6.1)     → 3-4GB RAM, port 5432 internal
  martin      (Rust tile server)  → 50-200MB RAM, port 3000 internal
  api         (FastAPI/Uvicorn)   → 200-400MB RAM, port 8000 internal
  redis       (cache)             → 50-100MB RAM, port 6379 internal
  web         (Next.js 15)        → 200-400MB RAM, port 3001 internal (or Vercel)
  nginx       (reverse proxy)     → 10-20MB RAM, ports 80/443
  Total: ~5-6.5GB of 8GB available
```

**Nginx routing:**
- `wharescore.co.nz/` → Next.js
- `wharescore.co.nz/api/` → FastAPI
- `tiles.wharescore.co.nz/` → Martin

**Provider comparison:**

| Provider | Location | Spec | Cost/mo | Latency to NZ |
|----------|----------|------|---------|---------------|
| **Vultr HP (recommended)** | Sydney | 4 vCPU, 8GB, 180GB NVMe | $48 | 25-50ms |
| DigitalOcean | Sydney | 4 vCPU, 8GB, 160GB | ~$48 | 25-50ms |
| Hetzner (budget/staging) | Singapore | 4 vCPU, 8GB, 160GB | ~$15 | 180-250ms |
| SiteHost (NZ-based) | Auckland | 4 cores, 8GB, 150GB | ~NZ$155 | <5ms |

**Database sizing estimate:** ~30-50GB on disk (geometries + GIST indexes + data). 8GB RAM VPS with 2.5GB `shared_buffers` handles this comfortably.

**CDN strategy for vector tiles:**
- Static layers (parcels, buildings, flood, zoning): Cloudflare 7-day edge cache
- Semi-dynamic (infrastructure, consents): 24-hour cache
- Dynamic (market rent, scores): GeoJSON via FastAPI, 1h Redis cache
- PMTiles on Cloudflare R2 as future optimization for static layers

**Total monthly cost: ~$50** (VPS $48 + domain ~$2 + Cloudflare free + Vercel free + R2 free)

**Scale path:**
1. MVP: Single 8GB VPS (~50-100 concurrent users)
2. Growth: Upgrade to 16GB VPS ($96/mo) + PgBouncer + PMTiles offload
3. Production: Separate DB server + app server + read replicas
4. Revenue scale: Multi-region, dedicated PostGIS cluster

**NZ-specific notes:**
- No data sovereignty concerns for CC-BY government open data
- Sydney hosting is standard for NZ tech (Xero, Trade Me backend use it)
- LINZ basemap tiles served from NZ infrastructure (zero VPS load for basemap)
- Payments: Stripe NZ (2.9% + $0.30, supports NZD)
- Domain: register `wharescore.co.nz` via Metaname or iwantmyname

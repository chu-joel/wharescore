# Claude Code Rules

## Mandatory: Keep Docs Updated
**After completing ANY code change, you MUST update the affected documentation before committing.** This is not optional. The docs in `docs/` are the source of truth for all future agents. If your change adds a table, endpoint, component, dataset, or rates module — the relevant doc MUST be updated in the same commit. See the doc update checklist at the bottom of this file and the doc-writing rules below.

### Doc-Writing Rules
These rules ensure every agent writes docs the same way, so docs stay consistent and machine-searchable:

1. **Tables, not prose.** Every piece of information goes in a markdown table row, not a paragraph. Tables are searchable and appendable. Prose rots.
2. **One row per thing.** One DataSource = one row. One API endpoint = one row. One component = one row. Never combine multiple items in one row.
3. **Use exact identifiers.** File paths must be exact (e.g., `backend/app/services/pncc_rates.py`, not "the PNCC module"). Field paths must be dot-notation (e.g., `report.liveability.bus_stops_800m`, not "bus stop count"). Table names must match the database exactly.
4. **Every row must be verifiable.** An agent must be able to grep the codebase or query the database to confirm the row is correct. If a row says "queried by get_property_report()", that must be literally true.
5. **No "etc" or "and more".** List everything or don't list it. Incomplete lists are worse than no list because agents trust what they read.
6. **Mark gaps explicitly.** If a city doesn't have data, write `-` not blank. If an endpoint has no auth, write `No` not blank. Explicit absence prevents false assumptions.
7. **Include the UPDATE comment.** Every table section must have a `<!-- UPDATE: When adding X, add a row here. -->` HTML comment above it telling the next agent exactly what to do.
8. **Same commit.** Doc updates go in the same git commit as the code change. Never "I'll update docs later." If you can't update the doc, you haven't finished the task.

## Context Continuity
When context is running low (~10% remaining), update `PROGRESS.md` with what was done and clear next steps, then tell the user.

## Read Before Write (mandatory)
Before making ANY change, read the relevant doc from the table below to understand the current state. This prevents duplicate work, wrong patterns, and missed connections. The docs are the source of truth — if the doc says something works a certain way, verify against the code, but trust the doc's structure for how to organize your changes.

## What This App Is
WhareScore is a property intelligence platform for New Zealand. Users search any NZ address and get:
- Risk score (0-100) from 40+ hazard/liveability/planning data layers
- Free on-screen report with key findings (gated: first 2 findings free)
- Paid hosted interactive report ($9.99 single / $140/mo Pro) with rent/price advisor, AI summary, full analysis
- Persona-specific: renter (rent fairness, healthy homes) vs buyer (price estimate, mortgage calc)

## Stack
Next.js 14 + FastAPI + PostgreSQL 17/PostGIS + Redis 7 + Docker Compose on Azure VM (B2ms). Auth: NextAuth/Google OAuth + JWT. Payments: Stripe test mode. Deploy: push to `main` → GitHub Actions SSH.

## File Map
```
backend/app/
  routers/property.py          — Report + export endpoints, _fix_unit_cv(), _overlay_transit_data(), _overlay_terrain_data()
  routers/nearby.py            — 12 nearby GeoJSON endpoints (schools, crashes, transit, heritage, etc.)
  routers/market.py            — Market analysis, rent/price advisor, HPI, rent history
  routers/rates.py             — Live council rates endpoint
  routers/account.py           — Auth, credits, promo, saved reports
  routers/payments.py          — Stripe checkout sessions (auth + guest)
  routers/webhooks.py          — Stripe webhook handler
  routers/reports.py           — Hosted report snapshot endpoint (/report/{token})
  routers/search.py            — Address search
  routers/suburb.py            — Suburb search + profile
  routers/rent_reports.py      — Crowdsourced rent reports
  routers/budget.py            — Budget calculator data capture
  routers/feedback.py          — User feedback submission
  routers/email_signups.py     — Email signup for region alerts
  routers/admin.py             — Admin dashboard + data management
  services/data_loader.py      — 530 DataSource definitions (THE data bible)
  services/snapshot_generator.py — Snapshot generation + ALL rates API wiring (~line 309-470)
  services/rent_advisor.py     — Rent estimation engine
  services/price_advisor.py    — Price estimation (CV + HPI)
  services/risk_score.py       — 0-100 scoring
  services/report_html.py      — Insights, recommendations, lifestyle fit
  services/ai_summary.py       — Claude/OpenAI narratives
  services/*_rates.py          — 25 council rates API clients
  migrations/0022_*.sql        — get_property_report() SQL function
  migrations/0023_*.sql        — get_transit_data() + cbd_points + hpi_national

frontend/src/
  components/property/PropertyReport.tsx    — On-screen report (renders sections)
  components/property/sections/*.tsx        — Question sections (Risk, Neighbourhood, Market, Transport, Planning)
  components/property/KeyFindings.tsx       — Severity-ranked findings
  components/property/UpgradeModal.tsx      — Paywall + pricing
  components/report/HostedReport.tsx        — Hosted report (renders 25+ sections from snapshot)
  components/report/Hosted*.tsx             — Hosted-only sections
  stores/*.ts                              — Zustand state (persona, inputs, budget, auth, export)
  components/map/MapContainer.tsx          — Main map (MapLibre GL + Martin tile layers)
  components/map/MapLayerPicker.tsx        — Layer toggle UI (hazards, property, schools, planning, transport)
```

## Data Flow
```
GET /property/{id}/report[?fast=true]
  → get_property_report() SQL [40+ tables]
  → enrich_with_scores() [0-100 composite + 5 categories]
  → asyncio.gather(_overlay_transit_data, _overlay_event_history[, _overlay_terrain_data])
     (terrain skipped when fast=true — frontend fetches fast first, full in background)
  → CV fetched lazily via GET /property/{id}/rates (25 councils, not in report path)
  → Redis cache 24h

POST /property/{id}/export/pdf/start[?report_tier=quick|full]
  → Quick tier: free with sign-in (no credits needed, expires 30 days)
  → Full tier: requires credits ($9.99 single or Pro plan)
  → generate_snapshot() [all data + rent/price advisor + AI]
  → create_report_snapshot() → report_snapshots table
  → share_token → /report/{token} (hosted report)
  → send_report_ready_email() → Brevo transactional email with link
  → Frontend shows toast "Your report is ready" + "Go to My Reports"
```

## Routing Table

| I need to... | Edit these files | Update these docs |
|---|---|---|
| Add hazard data for a council | `data_loader.py` (DataSource entry) | `docs/DATA-CATALOG.md` § DataSources-by-region |
| Add a council rates API | Create `services/{x}_rates.py`, add elif in `routers/rates.py` AND `snapshot_generator.py` | `docs/DATA-CATALOG.md` § Live-rates-APIs |
| Add transit for a city | `data_loader.py` (REGIONAL_DESTINATIONS + DataSource) | `docs/DATA-CATALOG.md` § GTFS-transit |
| Add field to SQL report | Edit `migrations/0022_*.sql`, re-apply on DB | `docs/FRONTEND-WIRING.md` § Report-fields |
| Add field to snapshot | `snapshot_generator.py` generate_snapshot() return | `docs/FRONTEND-WIRING.md` § Snapshot-structure |
| Add on-screen report section | Create `components/property/sections/*.tsx`, add to `PropertyReport.tsx` | `docs/FRONTEND-WIRING.md` § On-screen-sections |
| Add hosted report section | Create `components/report/Hosted*.tsx`, add to `HostedReport.tsx` | `docs/FRONTEND-WIRING.md` § Hosted-sections |
| Add API endpoint | `routers/property.py` (or appropriate router) | `docs/FRONTEND-WIRING.md` § API-endpoints |
| Add/change map layer | `frontend/src/components/map/MapLayerPicker.tsx` (layer definitions), Martin serves tiles from PostGIS tables automatically | — |
| Change admin dashboard | `backend/app/routers/admin.py` (1300 lines — data health, content management, data loading) | — |
| Change risk scoring | `services/risk_score.py` | — |
| Change rent/price advisor | `services/rent_advisor.py` or `price_advisor.py` | — |
| Fix payment flow | `routers/payments.py` + `UpgradeModal.tsx` + `pdfExportStore.ts` | `docs/SYSTEM-FLOWS.md` § Payment-credit-system |
| Deploy | `git push origin main` | — |
| SSH to server | `ssh wharescore@20.5.86.126` | — |
| Run SQL on prod | `docker exec app-postgres-1 psql -U postgres -d wharescore -c "..."` | — |
| Clear cache | `docker exec app-redis-1 redis-cli -a $REDIS_PASSWORD FLUSHDB` | — |

## Critical Rules

**Migrations:** Run on startup via `migrate.py`. Tracked in `schema_migrations`. To modify `get_property_report()`, create a NEW migration containing the full `CREATE OR REPLACE FUNCTION get_property_report(p_address_id INT)` with the updated body — same signature so no shadow overload, and it auto-runs on deploy. Copy the function from `0022_*.sql`, apply your changes, save as a new migration file. Do NOT edit `0022` in place (it won't re-run on existing deployments).

**SQL argument limit:** PostgreSQL limits functions to 100 arguments. `jsonb_build_object('k1', v1, 'k2', v2, ...)` counts each key AND value as one argument, so max 50 key-value pairs per call. The `hazards` section in `get_property_report()` is already at the limit. When adding fields, split into `jsonb_build_object(...) || jsonb_build_object(...)`. A pre-commit hook enforces this.

**Prod architecture:** Host nginx handles SSL (Let's Encrypt) and proxies to Docker services on localhost ports. Docker's nginx service is dev-only (`profiles: ["dev"]`). NEVER start Docker nginx on prod — it conflicts with host nginx on port 80. On prod, run `docker compose up -d` (no `--profile`). On local dev, run `docker compose --profile dev up -d` if you want the Docker nginx.

**Redis cache:** Reports cached 24h. Changes to report logic won't show until flushed. Key: `report:{address_id}`.

**Snapshots:** Immutable JSONB in `report_snapshots`. Once generated, works forever. Client-side adjustments use `deltas` tables.

**Data loading:** Most hazard data → `flood_hazard` table (with `source_council` column). National layers (flood_zones, liquefaction_zones, etc.) are mostly Wellington-only. Report SQL queries both.

**Live rates:** 25 councils. Fetched lazily via `GET /property/{id}/rates` (unified router in `routers/rates.py`). CV shown from DB first, updated inline when live rates arrive. `snapshot_generator.py` still calls rates directly for snapshot generation. When adding a new council rates API: create `services/{x}_rates.py`, add elif in `routers/rates.py` AND `snapshot_generator.py`.

**Frontend gating:** Free on-screen = score + 2 findings + basic sections. PremiumGate = remaining findings + PM transit + HPI chart. Quick Report (free, sign-in) = 8 sections, hosted link, expires 30 days. Full Report ($9.99) = 25+ sections, permanent hosted link.

**Report generation flow:** User clicks Generate → toast "Generating..." → poll loop → toast "Your report is ready!" with "Go to report" link → email also sent. No auto-navigation. Reports appear in My Reports with "Generating..." placeholder until share_token is populated. HTML blob reports are deprecated — only hosted reports shown.

## Documentation (source of truth — keep updated)

| Doc | What it answers | When to read | When to update |
|-----|----------------|-------------|----------------|
| `docs/QUALITY-STANDARDS.md` | "How do I write code the right way? How do I verify? What mistakes should I avoid?" | Before writing ANY code | When discovering new patterns/pitfalls |
| `docs/SYSTEM-FLOWS.md` | "How does auth/payment/scoring/findings/caching work? What is each screen's PURPOSE?" | Changing auth, payments, scoring, adding screens | When changing any system flow |
| `docs/WIRING-TRACES.md` | "Does city X have data for field Y? What's the full chain?" | Verifying data flows, debugging, auditing | When adding data, changing report fields |
| `docs/DATA-CATALOG.md` | "What table stores this? What DataSources populate it? What's the live rates API?" | Adding data, rates modules, checking schemas | When adding DataSources, tables, APIs |
| `docs/FRONTEND-WIRING.md` | "What component displays this field? What's in the snapshot? What API does this call?" | Changing UI, adding sections, tracing JSON | When adding components, fields, endpoints |
| `docs/RECIPES.md` | "How do I add a dataset/rates API/transit city/report field step by step?" | Any implementation task | When a new recipe is needed |
| `DATA-LAYERS.md` | "Which councils have flood/liquefaction/tsunami data loaded?" | Checking hazard coverage by region | When loading new council data |
| `PROGRESS.md` | "What was done recently? What's next?" | Starting a new conversation | End of every session |

## Doc Update Checklist (run before every commit)

Before committing, check if your change affects any of these. If yes, update the doc with the specified format:

| If you... | Update this doc | Add this |
|---|---|---|
| Added a DataSource | `DATA-CATALOG.md` § DataSources-by-region | Row under the region: `\| key \| target_table \|` |
| Added a rates module | `DATA-CATALOG.md` § Live-rates-APIs | Row: `\| # \| Council \| module.py \| city matches \| endpoint type \| CV \| LV \| IV \| Rates \|` — also verify TWO wiring points updated |
| Added GTFS city | `DATA-CATALOG.md` § GTFS-transit | Row: `\| City \| datasource_key \| URL \| stops \| destinations \| travel_times \|` |
| Added a DB table | `DATA-CATALOG.md` § Major-database-tables | Row: `\| table \| ~rows \| key columns \| populated by \| queried by \|` |
| Added a report field | `WIRING-TRACES.md` in the appropriate category table AND `FRONTEND-WIRING.md` § Report-fields | Trace row: `\| field.path \| table \| query step \| datasource \| all cities? \|` AND wiring row: `\| field.path \| Component \| Section \| Gated? \|` |
| Added a snapshot field | `FRONTEND-WIRING.md` § Snapshot-structure | Row: `\| key \| type \| source \| used by \|` |
| Added frontend component | `FRONTEND-WIRING.md` § On-screen or Hosted table | Row: `\| Component \| File \| Section \| Data fields \| Gated/Hosted-only \|` |
| Added API endpoint | `FRONTEND-WIRING.md` § API-endpoints | Row: `\| Method \| Path \| Auth \| Rate \| Purpose \| Key tables \|` |
| Changed auth flow | `SYSTEM-FLOWS.md` § Auth-chain | Update the affected step in the flow diagram |
| Changed payment/credits | `SYSTEM-FLOWS.md` § Payment-credit-system | Update plans table, flow diagram, or credit logic |
| Changed scoring | `SYSTEM-FLOWS.md` § Scoring-system | Update category weights, indicator scores, or formula |
| Changed finding rules | `SYSTEM-FLOWS.md` § Finding-generation | Update the rules list (critical/warning/info/positive) |
| Changed caching | `SYSTEM-FLOWS.md` § Caching-strategy | Update the cache table row |
| Changed screen content | `SYSTEM-FLOWS.md` § Screen-purposes | Update the content rules for that screen |
| Changed city data coverage | `WIRING-TRACES.md` § City-coverage-matrix | Update the cell for that city × field |

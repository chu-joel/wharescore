# Outstanding work

> Single hand-off list for what's open as of 2026-05-09. Sources are noted on every item so you can verify them.
>
> For the broader "what signals could we acquire that we don't have yet?" roadmap, see `INSIGHT-OPPORTUNITIES.md` (552 lines, 2026-04-18 brief). It is **not** rewritten here.

---

## A. Source-attribution gaps — CLOSED 2026-05-09

**Source:** the wording-doc audit (`docs/wording/_AUDIT-SUMMARY.md` + per-category files), inline `source_key status: TODO` markers across `docs/wording/INDICATOR-WORDING-*.md`.

**State:** ✅ **106 of 106** `Insight(...)` call sites in `backend/app/services/report_html.py` now carry `source=_src(...)`. Every finding rendered to a user is attributable to a named authority.

Closed by adding 11 SOURCE_CATALOG keys (`branz_wind`, `scion_wildfire`, `mfe_coastal_inundation`, `linz_8m_dem`, `airport_noise_overlay`, `council_overland_flow`, `council_geotech`, `council_landslide`, `council_hazard_register`, `council_parks`, `wcc_solar`) and attaching `source=_src(...)` to the matching Insight call sites. See `docs/DATA-PROVENANCE.md` § SOURCE_CATALOG attribution keys for the full rendered authority strings.

---

## B. Real product features (not fixes)

### B1. REINZ / QV suburb-median-sale-price comparator

**Source:** `docs/wording/INDICATOR-WORDING-market.md` flagged this in the audit. Currently the buyer-side Critical-tier finding rule (in `frontend/src/components/property/FindingCard.tsx generateFindings()`) compares asking price against `property.capital_value` because no sale comparator exists in the report. CV lags 1–3 years; we labelled it a sanity ceiling.

**To close:** pick a data source — REINZ HPI by TA already imports manually (`reinz_hpi_ta`), but it's a price index, not absolute medians. Per-suburb sale medians need either a REINZ subscription, QV scraping, or a Trade Me dataset. Build the importer, materialise per-SA2 in a `mv_*` view, expose on the report and update the FindingCard rule.

**Effort:** half-day to a day depending on data choice. **Decision needed:** which data source.

### B2. Persona-aware planning scoring

**Source:** I introduced this gap when commit `ab7603b` dropped `zone_permissiveness`, `height_limit`, `school_zone` from `WEIGHTS_PLANNING` because they need user-intent context (a buyer wanting to subdivide values permissiveness; a buyer wanting quiet values restriction; school zone matters relative to a chosen school). No prior audit; documented in `RISK-SCORE-METHODOLOGY.md` § Planning section and `docs/wording/INDICATOR-WORDING-planning.md`.

**To close:** add a buyer-intent UI ("Are you looking to live in / extend / subdivide / invest?") and persona-aware scoring logic that flips polarity based on intent. Restore the three indicators with intent-driven weights.

**Effort:** V2 product feature. ~1–2 days for a basic version.

---

## C. Editorial decisions to confirm

### C1. Demographics finding rules

**Source:** `docs/wording/INDICATOR-WORDING-demographics.md`. All 44 demographic indicators sit at `(no rule)`. The editorial pass concluded this is intentional — demographic mix shouldn't drive findings; the meaningful signals (deprivation index, crime trend) live under liveability where they belong.

**To close:** confirm intent (close as won't-do) or push back with examples of demographics-driven findings worth wiring. **Decision needed:** confirm intentional?

---

## D. Architectural observations (not from any audit — flagged during May 2026 chip work)

### D1. `/property/[id]/page.tsx` mounts 3 PropertyReport instances

**State:** one per breakpoint (`lg:block`, `sm:block lg:hidden`, `sm:hidden`), all in DOM, only one visible. Every effect inside PropertyReport runs three times. Currently patched with module-scoped dedupe keys for the symptoms I noticed (`lastAutoSaveKey`, `lastAutoExpandKey`, `rentAdvisorRunInFlight`, `priceAdvisorRunInFlight`).

**Risk:** any new global side-effect in PropertyReport descendants needs its own dedupe. Maintenance tax that compounds.

**To close:** refactor to render a single PropertyReport via a `useBreakpoint` hook + conditional layout. Drop the dedupe keys.

**Effort:** ~half-day. Touches `app/property/[id]/page.tsx` + a sniff through the descendants for any other multi-mount sensitivity.

### D2. No automated test coverage for the property-details chip

**State:** verified visually + scripted Playwright runs against prod during the May 2026 session. No committed test coverage of the chip's typology fan-out, persona-swap, auto-expand, or auto-save behaviour. The `extension/tests/visual/` Playwright setup could host one but currently only covers the badge component.

**Risk:** the chip touches ~6 components and 3 stores. Any future refactor (D1, persona tweaks, store reshape) ships blind.

**To close:** add a Playwright spec under `extension/tests/visual/` (or a new `frontend/tests/` if preferred) covering: chip renders, pulse states, fan-out to both persona stores, auto-trigger of advisor on complete inputs, persona swap preserves typology, reset on navigation to a new address.

**Effort:** ~half-day for a meaningful spec.

---

## E. Pointers to other lists not duplicated here

| Doc | What it covers | Why not in this list |
|---|---|---|
| `INSIGHT-OPPORTUNITIES.md` | Signal catalog (collected & scored / collected & unscored / signals to acquire). 552 lines, 2026-04-18. | Predates the May 2026 work; broader signal-acquisition roadmap, not a TODO list. |
| `DATA-AUDIT.md` | Data coverage by region. | Inventory, not TODO. |
| `UX-AUDIT*.md` | Three audits dated April 2026. | Some items shipped (compare, chip), others pending — not re-aggregated here. |
| `VISUAL-AUDIT.md` | Visual treatment notes. | Same as above. |
| `PROGRESS.md` | Running session log per session, has an "Open" block per entry. | Per-session, not consolidated. |
| `Plan.md`, `IMPLEMENTATION-PLAN.md`, `BACKEND-PLAN.md`, `FRONTEND-PLAN.md`, `PDF-REPORT-PLAN.md`, `FAIR-PRICE-ENGINE.md` | Older planning docs. | Some shipped, some superseded — re-reading recommended only for context. |

---

## Recommended order

1. ~~**A** (source attribution)~~ — ✅ closed 2026-05-09.
2. **C1** (demographics) — confirm intent, close. 5 min decision.
3. **D1** (3-mount architecture) — when next refactoring `/property/[id]`, fold this in. Don't do as standalone; do alongside any other layout change.
4. **D2** (chip tests) — when next touching the chip or the typology median.
5. **B1** (REINZ/QV) — needs data-source decision before it's actionable. Treat as roadmap.
6. **B2** (persona-aware planning) — V2 product feature. Treat as roadmap.

---

*Created 2026-05-09 to consolidate findings from the May 2026 wording-audit pass and chip work. Update this file as items close. The wording-doc per-category audit files remain authoritative for indicator-level evidence.*

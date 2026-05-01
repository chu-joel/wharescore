# WhareScore Frontend Wiring Map

> Source of truth for what data is displayed where and how it gets there.
> Agents: search by component name, report field, or snapshot key. Update when adding/changing UI.
> Note: report endpoint strips premium detail (terrain, walking_reach, event_history, area_profile, property_detection) for unauthenticated users.

---

## Source attribution (transparency)
<!-- UPDATE: When annotating a new Insight with source=_src("key"), add the key to SOURCE_CATALOG and a row in docs/DATA-PROVENANCE.md. -->

Findings and insights carry an optional `source` field that renders a "Source: {authority}" caption linking to the authority's page. Wiring:

| Layer | File | Shape | Notes |
|---|---|---|---|
| Insight class | `backend/app/services/report_html.py` (`Insight`, `SOURCE_CATALOG`, `_src`) | `Insight(level, text, action, source={authority, url}\|None)` | `source` is optional. Call sites without `source=` render unchanged. Unknown keys log a warning and render without attribution (don't crash). |
| Badge/ranked findings | `select_findings_for_badge()` → `ranked_findings` on report/snapshot | `{severity, title, detail, source?: {authority, url}}` | Propagated from `Insight.to_dict()` when present. |
| On-screen card | `frontend/src/components/property/FindingCard.tsx` | `Finding.source: string`, optional `sourceUrl: string` | When `sourceUrl` present, the caption renders as a link. |
| On-screen free tier | `frontend/src/components/property/KeyFindings.tsx` (`asFrontendFinding`) | Reads `ranked.source.authority`/`.url` | Falls back to `'WhareScore data'` when snapshot predates the field. |
| Hosted (Jinja, legacy) | `backend/app/templates/report/property_report.html` (4 insight loops) | `{% if i.source %}` | Only renders when present — old snapshots pass-through safely. |

**Coverage:** ~15 of 103 `Insight(...)` call sites annotated so far (highest-visibility hazards, crime, noise, crashes, contamination, climate, NZDep). Remaining calls render without attribution — adding more is a one-line edit per site.

## Report Fields → Components
<!-- UPDATE: When adding a report field, add the row. When adding a component, add its fields. -->

### On-screen report (`/property/{id}`, component: `PropertyReport.tsx`)

**Report flow: Verdict → Evidence → Action → Upgrade → Deep Dive.** ScoreGauge and ScoreStrip removed from on-screen report (Snapshots provide the verdict). CategoryRadar removed (visual noise). IndicatorCards no longer show numeric score bars — plain-English descriptions only. Indicator grids hidden for renters (buyers still see them). Deleted orphaned components: HealthyHomesSummary, RentAffordabilitySnap, RentMarketPower, BuyerPropertyInsights (all superseded by Snapshot components).

| Report field path | Component | Section | Gated? |
|---|---|---|---|
| `address.full_address, .suburb, .city, .lat, .lng` | PropertySummaryCard | 0. Header — duplicate "suburb, city" subheading is suppressed when `full_address` already contains both (most LINZ addresses). Header action row also renders `<AddToCompareButton variant="primary" />` (Phase A) — see § Property-comparison. | No |
| `property.capital_value, .land_value, .building_area_sqm, .title_ref` | PropertySummaryCard | 0. Header | No |
| `property.floor_area_sqm, .building_area_sqm, .title_type, property_detection.is_multi_unit` | PropertySummaryCard (pill), HostedExecutiveSummary (stat), HostedQuickReport + HostedReport (cover pill), FlatmateFriendly (m²/room calc) | 0. Header / hosted cover / flatmate card | No. All call sites must use `resolveFloorArea()` from `lib/format.ts` - returns per-unit `floor_area_sqm` when the rates API supplied it (AKCC/WDC/ICC today), returns `null` for cross-lease or multi-unit when only the shared LINZ polygon is available (so we do not render a misleading shared figure), and returns the labelled `building_area_sqm` for freehold/standalone. FlatmateFriendly ignores non-per-unit values so "m² per room" is never computed from the shared polygon. **Sourcing:** `_fix_unit_cv()` does NOT run on the cached `/report` path - `property.floor_area_sqm` arrives from two live paths. On-screen: `usePropertyRates` hook fetches `/api/v1/property/{id}/rates`, `PropertyPills` merges `liveRates.total_floor_area_sqm` over `property.floor_area_sqm` before calling `resolveFloorArea`. Hosted: `transformReport(snapshot.report, snapshot.rates_data)` - the second arg lets old snapshots (generated before the snapshot_generator fix) still surface the right value from their stored `rates_data` payload. New snapshots also get it baked directly into `report.property` by `snapshot_generator.py`. |
| `property.floor_area_source` | (not currently displayed) | - | Populated alongside `floor_area_sqm` to tag provenance (`akcc`, `wdc_arcgis`, `icc_arcgis`). Reserved for a future data-source badge. |
| `property.site_coverage_sqm` | (not currently displayed) | - | Auckland only. Reserved for future storey inference (`floor_area_sqm / site_coverage_sqm > 1.4` -> likely 2-storey). |
| `property.title_type, .estate_description` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires a **critical** leasehold finding or a **warning** cross-lease finding. Field comes from `property_titles` via `get_property_report()`. **Cross-lease MUST be tested before leasehold** in the if/else chain, and `isLeasehold` must include `!isCrossLease` as a precondition. Reason: cross-lease is legally a leasehold interest in the underlying land, so LINZ title strings for cross-lease routinely contain the literal word "leasehold". Without the ordering + precondition, every cross-lease property fires the wrong (scary ground-rent-review) leasehold warning instead of the correct cross-lease (flats-plan-mismatch) warning. | First 2 free |
| `hazards.active_fault_nearest.{name,distance_m,slip_rate_mm_yr}` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires a **critical** fault-rupture finding when distance ≤200m **and** slip ≥1 mm/yr; **warning** when ≤2km. Only fires when `fault_zone_name` (Wellington council layer) is absent — national fallback. | First 2 free |
| `liveability.peak_trips_per_hour` | KeyFindings via `generateFindings()` | 2. EVIDENCE — qualifies the transit-stops positive finding. ≥5 stops **and** ≤3 peak trips/hour downgrades to **info** ("stops aren't services"). | First 2 free |
| `terrain.aspect_label, .slope_degrees` | KeyFindings via `generateFindings()` | 2. EVIDENCE — north/NE/NW on slope ≥3° = **positive**. South/SE/SW on slope ≥3° = **info** (heating/mould implication). | First 2 free |
| `hazards.slope_failure + (liquefaction \| gwrc_liquefaction \| council_liquefaction)` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires **critical** "double seismic vulnerability" when both rated High. Triggers `compounding_seismic` rec in hosted. | First 2 free |
| `hazards.tsunami_zone, .coastal_elevation_cm + terrain.elevation_m` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires **critical** tsunami evacuation feasibility when zone ≥2 + coastal ≤300cm + elevation ≤5m. Refines existing tsunami_zone rec. | First 2 free |
| `hazards.slope_failure + (overland_flow_within_50m \| terrain.is_depression \| nearest_waterway_m ≤50)` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires **warning** "saturated slope" when slope medium+ AND surface water present. Triggers `saturated_slope` rec in hosted. | First 2 free |
| `liveability.nearest_gp.distance_m, .nearest_pharmacy.distance_m` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires **info** "healthcare desert" when both ≥2km. Mostly fires for renters / older buyers in hill suburbs and rural-edge addresses. | First 2 free |
| `hazards.on_erosion_prone_land, .erosion_min_angle` | KeyFindings via `generateFindings()` | 2. EVIDENCE — fires **warning** "On erosion-prone land" when the boolean is true. GWRC-only coverage (9114 rows). Angle rendered as "mapped as ≥X° slope" when available. | First 2 free |
| `property.cv_is_per_unit, property_detection.is_multi_unit, .unit_count` | PropertySummaryCard | 0. Header (per-unit CV via `effectivePerUnitCv` helper — ignores `cv_is_per_unit` when the value is >$5M on a multi-unit address; land/building area pills hidden for multi-unit). Same helper used by MonthlyCostEstimate, BuyerBudgetCalculator, InvestmentMetrics, HostedExecutiveSummary, QuestionSummary, ReportCTABanner — don't read `report.property.capital_value` directly in new components. | No |
| `terrain.elevation_m, .slope_degrees, .slope_category` | PropertySummaryCard | 0. Header (elevation pill + slope pill) | No |
| `market.rent_assessment.*, market.trend.*, market.market_heat, hazards.*, environment.wind_zone, terrain.aspect_label, terrain.is_depression` | RenterSnapshot | 1. VERDICT (renter only) — overall verdict + rent/market power/healthy homes/mould risk/sun sections | No |
| `hazards.*, planning.*, market.trend.*, terrain.elevation_m, property_detection.*` | BuyerSnapshot | 1. VERDICT (buyer only) — insurability, building era risk, renovation potential, climate/managed retreat, capital growth, title type. Verdict headlines ("Strong fundamentals", "Worth extra due diligence", etc.) deliberately avoid the word "risk" so they can't collide with the score-badge label. **Insurance flags must use the shared helpers in `lib/hazards.ts`** (`isInFloodZone`, `isNearFloodZone`, `isInTsunamiZone`, `hasHighCoastalErosionRisk`, `hasHighWildfireRisk`, `isInLandslideRisk`) — the same set `InsuranceRiskCard` uses — so the Snapshot verdict and the Insurance card can't contradict each other. Raw-field checks (e.g. `h.tsunami_zone`) miss council-specific overlays and the Snapshot will under-count flags. | No |
| `comparisons.suburb.*, comparisons.city.*, liveability.nzdep_score, .school_count, .transit_count, environment.noise_db, hazards.epb_count` | ComparisonBars | 1b. COMPARISON — property vs suburb vs city horizontal bar charts with contextual labels | No |
| All hazards + liveability + planning | KeyFindings | 2. EVIDENCE — key findings. Summary line must sum to `findings.length` — include `info` count alongside critical/warning/positive. BlurredFindingCards takes an explicit `totalCount` prop for the "See all N findings" CTA. | First 2 free |
| `hazards.flood_zone \| .flood_extent_label \| .flood_extent_aep \| .wcc_flood_type` | All flood-sensitive components | 2. EVIDENCE / 3. ACTION / 5. DEEP DIVE — any of the three flood fields = "in a flood zone". Use `isInFloodZone(h)` + `floodLabel(h)` from `lib/hazards.ts` for the boolean + human label. Do NOT check `h.flood_zone` directly — it only covers the sparse GWRC `flood_zones` layer and misses WCC District Plan (`wcc_flood_type`) and regional flood extents (`flood_extent_*`). Call sites: FindingCard, InsuranceRiskCard, ActionCard, BuyerSnapshot, RenterSnapshot, BuyerChecklistContent, RenterChecklistContent, BuyerBudgetCalculator, BuyerDueDiligence, LandlordChecklist, MouldDampnessRisk, QuestionSummary, HostedExecutiveSummary, HostedAtAGlance, HostedAreaFeed, HostedHazardAdvice, HostedHealthyHomes, HostedNextSteps, QuickHazardSummary, sectionRelevance.scoreRisk. | First 2 free |
| `hazards.flood_nearest_m` | Flood-proximity components | Distance in metres to the nearest flood polygon across `flood_hazard` + `flood_zones` + `flood_extent`, capped at 500m (null above that). 0 when the property is inside a polygon. Use `isNearFloodZone(h)` + `floodProximityM(h)` from `lib/hazards.ts` for the "within Nm" flag — true only when property is NOT in a zone AND distance ≤ `FLOOD_PROXIMITY_THRESHOLD_M` (100m). Call sites: FindingCard (warning-severity finding), InsuranceRiskCard, BuyerSnapshot, RenterSnapshot, LandlordChecklist, HostedHazardAdvice. Emitted by on-screen report (`get_property_report()`, migration 0054) AND hosted snapshots (`_detect_hazards` in rent_advisor.py — new snapshots only, pre-0054 snapshots will have null). | First 2 free |

**Copy tone for hazard findings** — headlines name the hazard in plain English; interpretations give the user something to DO (evacuate route, document check, insurance ask, viewing probe) rather than describing the data source. Flood-in-zone and flood-near-zone findings both include evacuation-route + flood-insurance + has-it-flooded-before prompts; the near-flood version leads with the distance ("Only 31m from a flood zone") since that's the specific fact the user needs.

**Dampness risk — flood escalation** — when `hazards.flood_zone || flood_extent_label || flood_extent_aep || wcc_flood_type` is set (i.e. `isInFloodZone(h)`) AND shows up in the dampness factor list, RenterSnapshot + MouldDampnessRisk both escalate to their higher-severity variant ("Higher dampness and flood damage risk") regardless of factor count. Past flooding leaves long-term mould in walls/floors/insulation and affects contents insurance — never treat a flood-zone property as a "minor" dampness factor even in isolation.

**Map hover cleanup** — `MapContainer` wires `onMouseLeave` AND `onPointerLeave` to the outer `<div>` wrapper (not just the `<Map>` canvas). react-map-gl's internal onMouseLeave only fires when the mouse exits the canvas element; moving to a sibling overlay (legend, style picker, report pane) wouldn't clear `hoverInfo` reliably. The wrapper-level handler belt-and-braces it so the tooltip disappears whenever the pointer leaves the map region.

**Onboarding tour** (`components/common/OnboardingTour.tsx`, mounted in `app/page.tsx`) — 5-step spotlight tour for first-visit users. Targets existing components via `data-tour` attributes:
- `map-layers` → `MapLayerChipBar` wrapper
- `map` → `MapContainer` outer div
- `persona-toggle` → `PersonaToggle` wrapper
- `generate-report` → `FloatingReportButton` portal

Steps 3 ("click any property") and 4 ("toggle persona") auto-advance when the external signal fires (`searchStore.selectedAddress` / `personaStore.persona` change). Other steps have a Next button. Tour persists completion in `localStorage['whare:onboarding_seen']`. Force re-run with `?tour=1`. Skipped automatically when the user deep-links to a property (`?address=…`). Smooth transitions via `cubic-bezier(0.32, 0.72, 0, 1)` on all four dim rectangles + spotlight ring + tooltip. Tooltip placement falls back through below → above → right → left until one fits the viewport.

When adding a new step target, add the `data-tour` attribute to the wrapper element (NOT a portal root unless the tour should measure the portal's content bounding box). The tour uses `getBoundingClientRect()` so the target must be a mounted, visible DOM node at the time the step activates.

**Scroll demo step** — between "click property" and "persona toggle" the tour plays a scripted scroll of the report panel: finds the nearest scrollable ancestor of `[data-tour="persona-toggle"]`, scrolls ~420px down after 400ms, scrolls back to top at 2800ms, auto-advances at 3200ms. Works across breakpoints because the ancestor walk covers SplitView pane (desktop), TabletPanel (tablet), and the MobileDrawer contentRef (mobile). Steps declare `onEnter: 'scroll-report-down' | 'scroll-report-top'` to trigger the behaviour.

**Finish hands the user back to a clean slate** — after the final step (or on skip), the tour calls `searchStore.clearSelection()` so the user lands on the empty map + landing panel rather than the demo property they just walked through. The localStorage flag is still set, so the tour won't re-run.

**Tour step order + interactions** (current):
1. `map` — explore the map (pan/scroll/zoom copy).
2. `layers` — turn on map filters (MapLayerChipBar).
3. `click-property` — choreographed zoom-then-tap-then-load. Fetches `10 Customhouse Quay, Wellington`, calls `selectAddress` at 300ms (map flies in without loading the report), tap ripple at 1600ms over the now-zoomed map, then `selectProperty` at 1900ms to load the report for real. Splitting `selectAddress`/`selectProperty` lets the user watch the fly-in instead of seeing it obscured by the immediately-mounting report pane.
4. `scroll` — "What's in the report" — scrolls the report panel down ~420px then back up, with the scroll container as the spotlight target so the surrounding page dims.
5. `rent-fair` — spotlights the rent-fair AccordionItem (tagged `data-tour-section="rent-fair"` by QuestionAccordion). onEnter `'expand-rent-fair'` forces persona='renter', polls for the item, scrolls it into view, and programmatically clicks the AccordionTrigger button so the section is expanded when the tour arrives.
6. `persona` — always flips to buyer (because step 5 just forced renter). Tap ripple + `setPersona('buyer')`.
7. `generate` — sales-leaning copy promoting the Full hosted report.

All steps use manual `advance: 'next-button'` — nothing auto-advances on a timer or event. onEnter side-effects still fire.

**Demo-flood-layers onEnter** (step `layers`) — clicks the MapLayerPicker trigger (`[data-layer-picker-trigger]`) to open the modal, then clicks each of the three flood layer buttons (`[data-layer-id="flood_zones"]`, `[data-layer-id="flood_hazard"]`, `[data-layer-id="flood_extent"]`) staggered 900ms apart with a visible tap ripple over each row. On step leave the cleanup dispatches a `keydown: 'Escape'` on `document` so the base-ui Dialog closes itself. Each layer button is tagged with `data-layer-id={id}` inside `MapLayerPicker.tsx` for this purpose.

**Center placement + bullets + CTA** — `Step.placement: 'center'` pins the tooltip in the viewport centre regardless of target position; used for the final Generate step so the sales pitch reads from the middle of the screen while the spotlight still highlights the Generate button. `Step.bullets: string[]` renders a bullet list below `body` with piq-primary dot markers. `Step.cta: string` renders a single bold piq-primary line above the footer buttons. Together they turn the final step into a condensed value-prop sell without a wall-of-text body.

**Wait-for-load contract (step 3 → step 4 transition)** — the PropertyReport fetch is async (SQL + transit + terrain overlays can take several seconds) so the tour must not advance on a fixed delay. Instead, step 3's `address-selected` handler polls `[data-tour="persona-toggle"]` every 200ms (max 12s) for a measurable rect, then advances after a 700ms grace. Step 4's `auto-toggle-persona` onEnter does the same belt-and-braces poll before firing the tap ripple + `setPersona` so the ripple lands on the real DOM element even after sticky repositioning / scroll. If you add new tour steps that depend on report-loaded state, copy this pattern — rely on the target's measurable rect, not a fixed timer.

**User-facing copy tone** — do NOT use em-dashes (—) in strings rendered to the user. They read as visual gaps, especially in templated copy like `` `${factor} — detail` `` which renders as "factor — detail" and looks like broken list syntax. Prefer colons for intro/detail (`Leasehold title: you own the building`), periods to break into two sentences (`Significant concerns. Inspect carefully`), or commas to soften (`Room to negotiate, especially when the listing...`). Code comments are fine to leave with em-dashes.

**Dismiss gestures** — the dim areas around the spotlight have `pointer-events-auto` + `cursor-pointer` + `onClick={onSkip}`, so clicking the dim background closes the tour. The tooltip itself `stopPropagation`s. The spotlight cutout over the target has `pointer-events-none` so the user can still interact with the highlighted element.

**Re-running the tour** — `AppHeader` help button now opens a dropdown with "Take the tour" and "Help & FAQ". Selecting Take the tour dispatches a `window` CustomEvent named `tour:restart`; `OnboardingTour` listens, clears `localStorage['whare:onboarding_seen']`, clears the active selection, and re-enters step 0. `?tour=1` still forces a run on page load.

**Welcome gate** — before the spotlight tour starts, a centred "Welcome to WhareScore — want a quick tour?" dialog is shown (`WelcomeGate` inside `OnboardingTour.tsx`). "Take the tour" → enters step 0. "Maybe later" / clicking the backdrop / clicking X → sets the seen flag and doesn't show again. This prevents the tour from starting without consent and gives new users a branded welcome before they see their first spotlight. The gate also shows on Help-menu → Take the tour so a manual restart is a consistent experience.

**Scroll step target** — `target: 'report-panel'` is a sentinel resolved in `readRect()` via `findReportScrollContainer()` (the nearest scrollable ancestor of `[data-tour="persona-toggle"]`). Cutout lands on the report pane being scrolled, so the rest of the page (map, chrome) dims around it. Previously used `target: 'body'` which produced zero-size dim rectangles and no visual focus during the scroll demo.
| `hazards.tsunami_zone \| .wcc_tsunami_ranking \| .council_tsunami_ranking` | Tsunami-sensitive components | `transformReport.ts` falls back: `tsunami_evac_zone` → `tsunami_zone_class` → `council_tsunami_ranking` → `wcc_tsunami_ranking`. For boolean checks use `isInTsunamiZone(h)` from `lib/hazards.ts`. Call sites: InsuranceRiskCard. | No |
| `hazards.coastal_erosion \| .coastal_erosion_exposure \| .council_coastal_erosion` | Coastal-erosion-sensitive components | Use `hasHighCoastalErosionRisk(h)` from `lib/hazards.ts`. Checks national exposure label AND council overlay presence (Auckland ASCIE + others). Raw `h.coastal_erosion?.includes('high')` misses the council overlays. Call sites: InsuranceRiskCard. | No |
| `hazards.wildfire_risk \| .wildfire_vhe_days` | Wildfire-sensitive components | Use `hasHighWildfireRisk(h)` from `lib/hazards.ts`. `wildfire_risk` is a trend string ("increasing"/"stable") — severity signal is `wildfire_vhe_days` (days/yr of Very High/Extreme fire danger). Threshold ≥15 days = high, `increasing` + ≥8 days = high. Call sites: InsuranceRiskCard. | No |
| `hazards.landslide_in_area \| .landslide_susceptibility_rating \| .landslide_count_500m` | Landslide-sensitive components | Use `isInLandslideRisk(h)` from `lib/hazards.ts`. True if GNS mapped polygon intersects, OR council susceptibility is high/very-high (GWRC + Auckland), OR ≥3 documented events within 500m. Raw `h.landslide_in_area` alone misses council susceptibility zones. Call sites: InsuranceRiskCard. | No |
| `hazards.*, environment.*, planning.epb_listed, terrain.*, address.city, address.ta` | LandlordChecklist | 3. ACTION (renter hero) — "What to ask the landlord". Items are tagged `scope: 'personalised' \| 'universal'` — personalised (hazard/environment/terrain-triggered) show first under "Based on this property"; universal (Healthy Homes, heating, insulation R-values, rent increase, pets, costs) sit behind a "Show N more vital questions" expander under "Vital for every rental". When the property has no personalised triggers, universal auto-expands so the list is never empty. | No |
| `hazards.*, planning.*, property_detection.is_multi_unit` | BuyerDueDiligence | 3. ACTION (buyer hero) — "Your due diligence". Same progressive-disclosure pattern as LandlordChecklist: `scope: 'personalised' \| 'universal'` on items. Personalised = property-specific conditional checks (seismic assessment when EPB, geotech when high liq/slope, body corp when multi-unit, flood assessment when flood, insurance-quotes-WARNING when any hazard). Universal = every buyer (Building inspection, LIM, Legal review, Title search, plus normal insurance quotes when no hazards). Shows under "Priority for this property" first, then "Show N more vital checks" → "Vital for every purchase". Auto-expands universal when nothing personalised fired. | No |
| — (UI layout) | QuestionAccordion | 5b. DEEP DIVE — `DEFAULT_EXPANDED = []`. All question panels (Safety/deal-breakers, rent-fair, true-cost, daily-life, neighbourhood, restrictions, investment) start collapsed for both personas so the page reads as Snapshot → Findings → Action → Upgrade → (compact) deep-dive menu. Readers drill in per section. Items carry optional `featured` + `teaser` fields on the `QuestionSection` config: `featured: true` renders a piq-primary border + gradient + "Start here" pill badge (exactly one per persona — `rent-fair` for renters, `deal-breakers` for buyers) so the hero section stands out from the collapsed list. `teaser` is a ~60-char "what's inside" italic muted line shown below any preview chips — complements the data-driven chips with a content-driven hint so collapsed panels advertise what's inside rather than just a question + data dump. Every item also gets `hover:border-piq-primary/40` transition so non-featured panels still read as tappable. | No |
| — (portal) | FloatingReportButton | 4. UPGRADE — bottom-left floating CTA. Positioning **`bottom-24 md:bottom-5`** (was `bottom-5`). On mobile the MobileDrawer mini sheet is 80px tall with its drag-handle at bottom 36-80px of the viewport; a bottom-5 FAB overlapped that region and stole pointer events, so users couldn't drag the drawer. Must stay ≥ mini-sheet-height on mobile. Desktop has no drawer, so `md:bottom-5` stays. Consent banner case shifts by another ~48px. | No |
| `buyerInputStore`, `budgetStore` | ReportConfirmModal (BuyerFields) | Modal opened from FloatingReportButton. **Render gotcha**: bedroom/bathroom/finish pickers write to `buyerInputStore`, NOT `budgetStore`. Do NOT early-return on a missing budgetStore entry — the user will see "Select bedrooms to continue" validation with no picker visible. Only gate the budget-dependent block (purchase price / deposit / rate / loan / income / overrides) on the entry existing. RenterFields already uses this `{r && ...}` pattern correctly; BuyerFields had an `if (!b) return null` bug that was fixed. | No |
| `comparisons.*` | ComparisonBars | 5a. COMPARISON — sits BELOW the upgrade CTA (between `ReportCTABanner` and `QuestionAccordion`). Rationale: the CTA is the first post-Action surface; comparison is context for readers who keep scrolling. Do not move above the CTA. | No |
| `hazards.*, planning.*, environment.*, coverage.*, property_detection.*` | BuyerDueDiligence | 3. ACTION (buyer hero) — "We've covered X of Y due diligence checks. Here's what you still need" with costs and property-specific notes | No |
| `market.rent_assessment.median, hazards.earthquake_count, hazards.active_fault_nearest` | KnowYourRights | 3. ACTION (inside renter checklist accordion) — bond max, rent increase rules, modification rights, fibre rights, HH compliance, quiet enjoyment, letting fee ban | No |
| `hazards.*` (all) | RiskHazardsSection | 5. DEEP DIVE accordion "Is it Safe?" — persona-aware: renters see critical alerts + summary count only; buyers see full detail incl. fault/landslide/climate/solar | No |
| `hazards.active_fault_nearest` | ActiveFaultDetailCard | 5. DEEP DIVE (buyers only). SQL shape is `{name, type, slip_rate_mm_yr, distance_m}` — the card historically referenced fault.class / fault.fault_type / fault.recurrence_interval which the SQL never provides; those rows have been removed. `type` (a numeric fault classification code) is rendered as "Class N". | No |
| `planning.transmission_line_distance_m` | hosted-only rec `transmission_lines` | Hosted Quick + Full. Rec is tiered: ≤25m easement-probable (title-level restriction + lender LVR cap), ≤100m NPSET setback buffer (council conditions on new builds), ≤200m awareness-only (EMF falls off ~1/d², no development restriction). Tier content computed as `transmission_tier_line` in `build_recommendations` ctx. | Hosted-only |

**Naming convention for conditional rec placeholders**: variables ending in `_line` (e.g. `active_fault_line`, `climate_precip_line`, `transmission_tier_line`) are pre-formatted full sentences that resolve to the empty string when the underlying data isn't present. `_make()` in `build_recommendations()` drops any action that resolves to `""` — so these placeholders can vanish cleanly from the rec bullet list without leaving a blank line. Prefer this pattern over stuffing fallback text into the ctx when you want a rec bullet to be conditional.
| `hazards.contamination_count` | ContaminatedLandCard | 5. DEEP DIVE | No |
| `hazards.landslide_nearest, .landslide_count_500m` | LandslideDetailCard | 5. DEEP DIVE (buyers only) | No |
| `environment.climate_temp_change, .climate_precip_change_pct` | ClimateForecastCard | 5. DEEP DIVE (buyers only) | No |
| `liveability.crime_rate, .crime_city_median` | CrimeCard | 5. DEEP DIVE — buyers: inside "neighbourhood" via NeighbourhoodSection. Renters: inside "safety" only (hidden from neighbourhood to avoid duplication). Humanized: "Safer than X% of areas" (no raw victimisation count). | No |
| `liveability.nzdep_score` | NeighbourhoodSection | 5. DEEP DIVE "neighbourhood" — CrimeCard hidden for renters (already in safety). Buyers see full indicator grid + CrimeCard. | No |
| `liveability.cbd_distance_m, .nearest_train_m` | TransportSection | 5. DEEP DIVE "daily life" — persona-aware: renters see distances/commute only; buyers also see indicator grid | No |
| `walking_reach.bus, .rail, .ferry` | TransportSection | 5. DEEP DIVE "daily life" | No |
| `liveability.transit_travel_times[]` | TransportSection | 5. DEEP DIVE "daily life" | Top 3 free, rest gated |
| `terrain.aspect_label` | SunAspectCard | 5. DEEP DIVE "daily life" (renter only) | No |
| `hazards.aircraft_noise_name, .aircraft_noise_dba, .aircraft_noise_category` | NoiseLevelGauge | 5. DEEP DIVE "daily life" — aircraft noise shown prominently alongside road noise | No |
| `property.capital_value, .land_value` | MarketSection | 5. DEEP DIVE "investment" (buyer only — CV card hidden for renters). PriceAdvisorCard removed from MarketSection; buyers get it in `true-cost` only to avoid duplication. | No |
| `market.market_heat, .trend.cagr_*` | MarketSection | 5. DEEP DIVE — HPI chart hidden for renters (not relevant to rental decisions) | No |
| `property_detection.detected_bedrooms, .is_multi_unit, .detected_type, property.building_area_sqm` | FlatmateFriendly | 5. DEEP DIVE "rent fair" (renter only) | No |
| `planning.zone_name, .zone_category, .height_limit, overlays` | PlanningSection | 5. DEEP DIVE "restrictions" (buyers). The "Category" row is hidden when `zone_category` equals `zone_name` or is the literal string "Zone" (WCC ArcGIS feed returns that for MRZ). EPB checklist row asks "This building on the EPB register? Yes — listed / No" instead of the old "Earthquake-prone building / Not listed" phrasing. | No |
| `coverage.available, .total, .per_category, .bonus_features` | DataLayersAccordion | 6. Below fold (compact mode) | No |
| (live API call) | AISummaryCard | 6. Below fold (after accordion) | No |

**Mobile input zoom rule:** any raw `<input type="text|number">` in on-screen report components must use `text-base md:text-sm` (or larger at mobile). Safari zooms on focus when the computed font-size is < 16px. PriceAdvisorCard, BuyerBudgetCalculator, RenterBudgetCalculator, BudgetSlider inline editors all follow this pattern. The shared `<Input>` primitive (`components/ui/input.tsx`) already bakes this in — prefer it over raw `<input>` where possible.

**Renter accordion sections:** `rent-fair`, `safety`, `daily-life`, `neighbourhood` (merges old `neighbourhood-improving` + `neighbourhood`), `renter-checklist` (hero, skipped from accordion). Default expanded: `rent-fair`, `daily-life`.

**Buyer accordion sections:** `deal-breakers`, `investment`, `true-cost`, `daily-life`, `neighbourhood`, `restrictions`, `buyer-checklist` (hero, skipped). Default expanded: `deal-breakers`, `true-cost`.

**Accordion trigger deduplication:** When preview chips are present, the text summary is hidden (they showed identical information). Chips use color-coded pills; text shown as fallback only when no chips exist.

### Hosted report (`/report/{token}`, component: `HostedReport.tsx`)

**Layout:** Two tabs — "Your Property" (default, Building2 icon) and "The Area" (MapPin icon). Pill-style tab bar (rounded, bg-muted/60, `min-h-[44px]` touch targets). Cover + score strip + orientation text + coverage badge above tabs. Methodology + disclaimer below tabs. Sidebar stays fixed across both (inputs use `text-base` to prevent iOS zoom). Tab navigation footer at bottom of each tab ("Continue to The Area" / "Back to Your Property"). URL hash sync (`#property` / `#area`). Print CSS shows both tabs with section headers ("Part 1: Your Property" / "Part 2: The Area") and page breaks. Header: Share button shows "Copied!" feedback + label on desktop; Print button (was "Save PDF"). Share/Print buttons are 44×44 min with `aria-label` so screen readers can identify them on mobile. Quick report (HostedQuickReport.tsx) has no tabs, same share/print buttons. Coverage badge shows `"{N} sources checked"` from `report.coverage.available` on BOTH tiers (Full + Quick). H1 address is visible at all breakpoints (no `hidden sm:block`). ReportSidebar takes an `instanceId` prop so the mobile inline copy and desktop floating copy don't share input IDs.

| Snapshot field | Component | Hosted-only? |
|---|---|---|
| `report.scores.categories` | HostedAtAGlance | Yes. Pills are split into two groups with different vocabularies: Risk group (Hazard Risk, Insurance, Crime, Noise) uses `OK / Watch / Risk`; Lifestyle group (Schools, Neighbourhood, Transport, Rent) uses `Great / Limited / Sparse`. Lifestyle pills must NOT use hazard wording — schools/transport are amenity signals, not risks. |
| `report.property, report.scores, meta` | HostedExecutiveSummary | Yes |
| `ai_insights` | HostedAISummary | Yes (on-screen fetches live) |
| `report.scores.categories` | CategoryRadar | Yes (hosted only — removed from on-screen report) |
| `report.*` (all) | KeyFindings (all, no gating) | No (shared, but ungated) |
| `hazard_advice, weather_history` | HostedAreaFeed | Yes. Top Events grid: 1 col mobile, 3 col sm+. Cards use overflow-hidden + break-words. |
| `rent_baselines` | HostedRentAdvisor | Yes (renter only) |
| `rent_history` | HostedRentHistory | Yes |
| `price_advisor, deltas` | HostedPriceAdvisor | Yes (buyer only) |
| `hpi_data` | HostedHPIChart | Yes (buyer persona only — renters don't see it) |
| `report.*` (questions) | QuestionContent (loop) | No (shared) |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `school_zones` | HostedSchoolZones | Yes. Filtered to schools ≤5 km so private schools with country-wide enrolment zones (e.g. St Oran's 15 km, Hutt International 27 km) don't appear as "in-zone". |
| `report.liveability.schools` | HostedSchools | Yes. Shows **only out-of-zone nearby schools** (in-zone ones live in HostedSchoolZones above). Decile column dropped — deciles were retired 2023 and the column rendered as "–" for every row. |
| `road_noise` | HostedRoadNoise | Yes |
| `terrain`, `isochrone`, `terrain_insights` | HostedTerrain | Yes |
| `report.liveability` (crime, deprivation, transit modes, AM+PM travel times, peak_trips_per_hour, nearest_stop_name, crashes, amenities_500m) | HostedNeighbourhoodStats | Yes. Peak frequency shown with Excellent/Good/Limited badge. |
| `report.environment` (air, water, climate, contamination, corrosion) | HostedNeighbourhoodStats | Yes. Air + water blocks must show distance to the nearest LAWA monitoring station (`air_pm10_distance_m` / `water_distance_m`) plus an italic caveat that the reading is regional, not at the property. Same caveat is mirrored in the `report_html.py` water/air findings. |
| `report.planning` (notable trees, parks, heritage, overlays, geotech, transmission_line_distance_m) | HostedNeighbourhoodStats | Yes. Transmission line warning if ≤500m. Heritage: context labels for 50+/10+ items. Cycle paths: quality labels (excellent ≥10km, good ≥3km). Amenities: shows fallback message when 0. |
| `report.comparisons` (suburb + city benchmarks) | HostedNeighbourhoodStats | Yes |
| `rates_data` (total_rates, rates_breakdown) | HostedNeighbourhoodStats | Yes (Full only). Annual rates card with breakdown. |
| `census_demographics, census_households, census_commute` | HostedDemographics (isFull=true) | Yes. Population, age, commute (free), income, tenure, ethnicity, internet (Full). |
| `climate_normals` | HostedClimate | Yes. Monthly temp range chart, seasonal table, highlight cards. |
| `nearby_doc` | HostedOutdoorRec | Yes |
| `report.planning` | HostedInfrastructure | Yes |
| `report.hazards` | HostedHealthyHomes | Yes (renter only). Rows marked "Not verified — ask at viewing" by default (not "No issues detected"), since the Healthy Homes standards can only be verified in person. Moisture/draught can still flag "Area hazard" when flood / liquefaction / coastal / wind zone data fires. Moved to after Rent Advisor (was after questions). |
| `report.hazards, terrain, environment` | MouldDampnessRisk | Yes (renter only, Full + Quick). After HealthyHomes in Full, after Rent Verdict in Quick. |
| `report.terrain.aspect_label` | SunAspectCard | Yes (renter only, Full). After MouldDampnessRisk. |
| `report.hazards, environment, planning, terrain, address` | LandlordChecklist | Yes (renter only, Full + Quick). In Full: standalone after questions (filtered from QuestionContent to avoid duplication), before hazard advice. In Quick: after rent verdict. |
| `report.market.rent_assessment, hazards.earthquake_count` | KnowYourRights | Yes (renter only, Full + Quick). Accepts a `userRent` prop — bond max is computed from the user's weekly rent first, falling back to area median only if the sidebar input is empty. Standalone after LandlordChecklist (filtered from QuestionContent to avoid duplication). |
| `hazard_advice` | HostedHazardAdvice | Yes. Suppresses its own coastal-erosion + coastal-inundation blocks when `snapshot.coastal` is present, to avoid saying the same thing twice. |
| `coastal` | HostedCoastalTimeline | Yes. Section hidden when `coastal == null` or `tier === 'not_applicable'`. Renter persona only sees `tier === 'happens_now'` (life-safety), buyer sees all tiers. Renter narrative swapped via `narrative_renter` field when set (contents insurance + evacuation framing, no building-insurance talk). |
| `recommendations` | HostedRecommendations | Yes |
| (persona template) | HostedNextSteps | Yes |
| (static) | HostedMethodology | Yes |
| `meta, rent_baselines, price_advisor, report.property` | ReportSidebar | Yes. Takes an `instanceId` prop (`"mobile"` / `"desktop"`) so the two responsive copies generate unique input IDs for `<label htmlFor>` bindings. Inline labels say "Your details" (was "Property details") to avoid colliding with the "Your Property" tab label. |

### Quick Report (`/report/{token}`, component: `HostedQuickReport.tsx`, tier=quick)

Rendered when `report_tier === 'quick'`. **Free with sign-in.** Single-column, no sidebar, 8 sections. Same snapshot data, curated lightweight view. Free on-screen=2 findings, Quick=3, Full=all. **Expires after 30 days** (`expires_at` on snapshot). Expiry warning shown in last 7 days (amber 4-7d, red ≤3d). Upgrading to Full clears `expires_at` (permanent).

<!-- UPDATE: When adding a Quick Report section, add a row here. -->
| Snapshot field | Component | Reused from Full? |
|---|---|---|
| `report.scores` | ScoreGauge + ScoreStrip | Yes (shared) |
| `ai_insights.bottom_line, key_takeaways` | (inline in HostedQuickReport) | Subset (3 takeaways) |
| `report.scores.categories` | HostedAtAGlance | Yes |
| `report` | KeyFindings (maxFree=3) | Yes (capped at 3, Full shows all) |
| `rent_baselines` / `price_advisor` | QuickVerdict | New (simplified) |
| `report.hazards, terrain, environment` | MouldDampnessRisk | Renter only — dampness risk with viewing tips |
| `report.hazards, environment, planning, terrain, address` | LandlordChecklist | Renter only — personalized landlord questions |
| `report.market.rent_assessment, hazards` | KnowYourRights | Renter only — tenant rights (bond max, rent rules, modifications) |
| `report.hazards` + `snapshot.coastal` | QuickHazardSummary | New (traffic lights). "Coastal & sea level" row prefers `snapshot.coastal.tier` when present (happens_now=concern, within_30_years=watch, longer_term=clear). Falls back to `hazards.coastal_erosion` flag otherwise. |
| `school_zones` | HostedSchoolZones | Yes |
| `nearby_highlights` | HostedNearbyHighlights | Yes |
| `recommendations` | QuickActions | Shows all critical + important items first, then fills with advisory up to 5 total (was hard-capped at 3, which left renters with a lone "Contaminated Land" bullet on sparse properties). |
| — | QuickUpgradeBanner | POST /report/{token}/upgrade → uses credit if available (instant reload), else Stripe checkout |

### Property comparison (`/compare?ids=A,B`, component: `CompareView.tsx`)
<!-- UPDATE: When adding a section/row to compareSections.ts or a new compare component, add a row here. -->

**Phase A scope:** anonymous-only, max 2 staged, localStorage-persisted. Scoreboard + Risk + Market sections. No backend persistence yet (Phase B). Mounted site-wide via `<CompareTray />` in `app/layout.tsx`.

**Tri-state data model (mandatory invariant):** every row resolves to one of `present` (numeric/string value), `negativeKnown` ("Not in zone" / "None"), or `unknown` (city has no coverage). `compareDiff.winnerOf` returns `null` whenever ANY value is `unknown` — the diff sentence renders "Data not available for {col}". Never silently treat unknown as a winning value.

| Component | File | Section | Data fields |
|---|---|---|---|
| `CompareView` | `frontend/src/components/compare/CompareView.tsx` | Top-level layout for `/compare` — header + scoreboard + N section accordions | All fields below, hydrated via `useComparedReports(ids)` |
| `CompareHeader` | `frontend/src/components/compare/CompareHeader.tsx` | Sticky address row + persona toggle | `report.address.full_address, .suburb`, `report.scores.overall` (column score badge) |
| `CompareScoreboard` | `frontend/src/components/compare/CompareScoreboard.tsx` | Always-visible top strip — risk score, critical findings count, persona's primary $ | `report.scores.overall`, `report.ranked_findings.{persona}` (count where severity=critical), `market.rent_assessment.median` (renter) or `property.capital_value` (buyer) |
| `CompareSection` | `frontend/src/components/compare/CompareSection.tsx` | One accordion per `SectionDef`. Closed: section-level diff sentence ("A leads on most metrics"). Open: `CompareRow` per `RowDef`, identical rows collapsed to "Same on both: …" trailer | Per `compareSections.ts` |
| `CompareRow` | `frontend/src/components/compare/CompareRow.tsx` | One metric across 2-3 columns. Per-column accent (A=teal, B=amber, C=deep-teal). Winner: 2px left border + ↑ glyph + accent-tinted bg | Determined by `RowDef.extract(report)` returning `CompareValue` |
| `CompareTray` | `frontend/src/components/compare/CompareTray.tsx` | Site-wide dock. Desktop: pill top-right with popover. Mobile: bottom bar (hides on scroll-down) + `Sheet` expanded view. Hidden when 0 staged or on `/compare`. | `useComparisonStore.items` |
| `AddToCompareButton` | `frontend/src/components/compare/AddToCompareButton.tsx` | Toggle button. Variants: `primary` (report header), `icon` (search results), `menu-item` (toast/menus), `mobile-action` (sticky bottom). Toast on add via `sonner`. Cap at 2 enforced by store. | — |
| `CompareEmptyState` | `frontend/src/components/compare/CompareEmptyState.tsx` | `/compare` with 0 or 1 ids — search prompt + already-staged list | `useComparisonStore.items` |

**Section field map (Phase A — verify in `frontend/src/lib/compareSections.ts`):**

| Section | Row | Field path | Strategy | Notes |
|---|---|---|---|---|
| Scoreboard | risk-score | `scores.overall` | lower-better | Fallback to unknown if non-finite |
| Scoreboard | critical-findings | `ranked_findings[persona].filter(severity==='critical').length` | lower-better | Falls back to hazard-flag count when ranked_findings absent |
| Scoreboard | primary-$ (renter) | `market.rent_assessment.median` | lower-better | $/wk |
| Scoreboard | primary-$ (buyer) | `property.capital_value` | lower-better | Phase B will swap to `price_estimate.p50` once on the live report path |
| Risk | flood | `getFloodTier(hazards)` (5-tier rank) | lower-better | Uses `lib/hazards.ts` — never reads raw `flood_zone` directly |
| Risk | liquefaction | `liquefactionRating(hazards)` | lower-better | `unknown` rating short-circuits the row |
| Risk | tsunami | `isInTsunamiZone(hazards)` | lower-better | Binary today; tier helper is Phase B |
| Risk | slope-failure | `hazards.slope_failure` (parsed) | lower-better | — |
| Risk | fault | `hazards.active_fault_nearest.distance_m` | higher-better (farther = better) | — |
| Risk | coastal-elevation | `hazards.coastal_elevation_cm` | higher-better | National coverage |
| Market | capital-value | `property.capital_value` | lower-better | Format: short currency ($1.2M / $850k) |
| Market | median-rent | `market.rent_assessment.median` | lower-better | $/wk |
| Market | rent-band | `market.rent_assessment.{lower,upper}_quartile` | identity | Renders verbatim, never picks a winner |
| Market | market-heat | `market.market_heat` | categorical | Same / Different |

**Compare data hydration:** `useComparedReports(ids)` calls existing `/api/v1/property/{id}/report?fast=true` per id in parallel via `useQueries`. Reuses the existing 24h Redis cache, the same tier-gating, the same `transformReport()` normalization. **No new aggregate `/compare` endpoint** — adding one would duplicate the gating logic and risk drift from `/property/{id}/report`.

**Column accent system:** A=`piq-primary` (teal), B=`piq-accent-warm` (amber), C=`piq-primary-dark` (deep teal). Reused across `CompareTray` letter chips, `CompareHeader` letter chips, `CompareRow` value-chip borders, `CompareRow` diff-sentence accent number, and `CompareScoreboard`. **Never use `piq-accent-hot` (red) for column identity** — red is reserved for finding severity.

**Identical-row collapse rule:** `compareDiff.isIdentical(values)` returns true when every value's `kind` and `display` match. Two `unknown` values count as identical (both render as "—") — coverage gaps don't inflate the visible row count. Collapsed rows render as a single italic "Same on both: row1 (val), row2 (val), …" line at section bottom.

**Sign-in gate (Phase A):** none — anonymous users can stage 2 properties and view compare. Phase B adds the 3rd-property gate (per plan; `comparisonStore` already exposes `replaceAll` for the localStorage→server merge).

---

## Snapshot Structure
<!-- UPDATE: When adding a key to generate_snapshot() return dict, add it here. -->

Generated by `snapshot_generator.py` `generate_snapshot()` (~line 1077). Stored in `report_snapshots.snapshot_json`.

| Key | Type | Source | Used by |
|-----|------|--------|---------|
| `report` | Full PropertyReport JSON | `get_property_report()` SQL + scores enrichment + transit overlay (Auckland/regional via `get_transit_data()`) + rates fix | All question sections, findings, scores |
| `rent_baselines` | Dict keyed by "House:3BD" etc | `compute_rent_baselines()` from bonds_detailed | HostedRentAdvisor, ReportSidebar |
| `price_advisor` | PriceAdvice object | `compute_price_snapshot()` from CV + HPI + yield | HostedPriceAdvisor, ReportSidebar |
| `deltas` | Adjustment tables | `build_delta_tables()` constants | Client-side recalculation in hostedReportStore |
| `recommendations` | Array of recs | `build_recommendations()` rule engine | HostedRecommendations |
| `insights` | Dict by category | `build_insights()` rule engine | HostedExecutiveSummary |
| `ai_insights` | String or null | `generate_pdf_insights()` Claude/OpenAI | HostedAISummary |
| `lifestyle_personas` | Array | `build_lifestyle_fit()[0]` | (not currently rendered) |
| `lifestyle_tips` | Array of strings | `build_lifestyle_fit()[1]` | (not currently rendered) |
| `rent_history` | Array {time_frame, median_rent, lq, uq, bonds} | bonds_detailed 10yr query | HostedRentHistory |
| `hpi_data` | Array {quarter_end, house_price_index, house_sales} | rbnz_housing table | HostedHPIChart |
| `crime_trend` | Array {month, count} | crime table 3yr | (embedded in neighbourhood) |
| `nearby_highlights` | {good: [], caution: [], info: []} | osm_amenities 1500m | HostedNearbyHighlights |
| `nearby_supermarkets` | Array {name, brand, distance_m} | osm_amenities 10km | (embedded in highlights) |
| `nearest_supermarkets` | Array {name, brand, distance_m, latitude, longitude} (top 5, NZ brand priority) | osm_amenities 5km, brand-first sort | HostedNeighbourhoodStats (Full only — stripped from Quick). Was missing from generate_snapshot until fixed — old snapshots won't have it. |
| `rates_data` | Council rates response | Live council API (25 councils) | ReportSidebar |
| `nearby_doc` | {huts: [], tracks: [], campsites: []} | doc_* tables 5km | HostedOutdoorRec |
| `school_zones` | Array {school_name, school_id, institution_type, distance_m, eqi, roll, suburb, city} | school_zones JOIN schools table | HostedSchoolZones (shows distance, EQI, roll) |
| `road_noise` | {laeq24h: number} | noise_contours table | HostedRoadNoise |
| `terrain` | {elevation_m, slope_degrees, aspect_label, aspect_degrees, is_depression, depression_depth_m, relative_position, wind_exposure, wind_exposure_score, flood_terrain_risk, flood_terrain_score, nearest_waterway_m, nearest_waterway_name, nearest_waterway_type, waterways_within_500m} | SRTM raster via `walking_isochrone.py` + `_classify_terrain_inferences()` + `nz_waterways` table | HostedTerrain |
| `coastal` | {tier, ground_elevation_m, coast_distance_m, storm_tide_100yr_distance_m, vlm_mm_yr, scenarios[], headline, narrative, narrative_renter?, score_impact} or null | `services/coastal_timeline.py::build_coastal_exposure(report)`, wrapped by `_safe_coastal()` in snapshot_generator.py so any exception falls back to null (advisory section — never fails snapshot generation). MVP uses existing hazard flags + terrain elevation + NZ SeaRise national-median SLR scenarios (`NATIONAL_SLR` constant, cross-checked against MfE Coastal Hazards Guidance 2024 Table 6 and IPCC AR6 WG1 Ch9 Table 9.9 — envelopes tested). Per-point data loaded via `backend/scripts/load_searise_points.py` from Zenodo record 11398538 (8,173 sites → `searise_points` table). Loader is opt-in; service silently uses national medians when the table is empty. `coast_distance_m` and `storm_tide_100yr_distance_m` are null placeholders until LINZ coastline + NIWA storm-tide polygons are loaded. `score_impact.delta` halved when a council coastal layer (`coastal_erosion`, `coastal_inundation_ranking`) already fires, to prevent double-counting. **Drives the 0-100 score**: `risk_score.py::enrich_with_scores` reads `report.coastal.score_impact` and maps `delta / max_possible × 100` into the `coastal` indicator (renamed from `coastal_erosion` 2026-04-29 because SeaRise data is SLR + storm tide + VLM, not erosion). Then drops the `coastal_erosion_council` indicator so the same risk doesn't count twice. Snapshot path attaches coastal to `report` BEFORE enrich (in `prefetch_property_data`). On-screen path does the same via `_overlay_coastal_data` then re-enrich. Old snapshots without a `coastal` key fall back to legacy `SEVERITY_COASTAL_EXPOSURE` enum (now also writes to the `coastal` indicator key) and render with the section hidden. | HostedCoastalTimeline |
| `isochrone` | {geojson, transit_within: {bus, rail, ferry}} | Valhalla walking isochrone + `count_transit_in_polygon()` | HostedTerrain |
| `terrain_insights` | Array {type, title, detail, severity} | `_build_terrain_insights()` rule engine | HostedTerrain |
| `weather_history` | Array of extreme weather events | weather_events 50km 5yr | HostedAreaFeed |
| `hazard_advice` | Array {hazard, severity, title, actions[], source} | `_build_hazard_advice()` | HostedHazardAdvice, HostedAreaFeed |
| `meta` | {schema_version, generated_at, address_id, full_address, persona, dwelling_type, inputs_at_purchase, sa2_name, ta_name} | Computed | Cover page, ReportSidebar |
| `census_demographics` | Object or null | `census_demographics` table via SA2 join, falls back to `v_census_by_boundary` concordance view for 2023→2018 SA2 code mapping. Population, age, ethnicity, birthplace, gender, languages. | HostedDemographics (Full only) |
| `census_households` | Object or null | `census_households` table via SA2 join, falls back to `v_census_households_by_boundary` concordance view. Income, tenure, crowding, vehicles, internet, rent, landlord. | HostedDemographics (Full only) |
| `census_commute` | Object or null | `census_commute` table via SA2 join, falls back to `v_census_commute_by_boundary` concordance view. Work at home, drive, bus, train, bike, walk counts. | HostedDemographics (Full only) |
| `business_demography` | Object or null | `business_demography` table via SA2 join. Employee count, business count, growth %. | HostedDemographics (both Quick + Full) |
| `community_facilities` | Object | `osm_amenities` + `fibre_coverage` (SRID fixed 2026-04-08, migration 0043) + `cycleways` spatial queries. Nearest hospital, EV charger, library/sports/playground/community centre/cycling counts, fibre availability + provider, cycleway km within 2km. | HostedNeighbourhoodStats |
| `climate_normals` | Array of 12 or null | `climate_normals` table via TA name join. Monthly temp/rain/sun/wind normals 1991-2020. | HostedClimate (Full only) |
| `report_tier` | `'quick'` or `'full'` | `report_snapshots.report_tier` (injected by API, not in JSONB) | Page routing, QuickUpgradeBanner |
| `expires_at` | ISO string or null | `report_snapshots.expires_at` (injected by API). Quick=30 days, Full=null (permanent). Cleared on upgrade. | Expiry warning in HostedQuickReport, account page |

---

## User Input Stores
<!-- UPDATE: When adding a new store or input field, document it here. -->

| Store | File | Key fields | Persisted | Sent to backend |
|-------|------|-----------|-----------|----------------|
| personaStore | `stores/personaStore.ts` | `persona: 'buyer'\|'renter'` | localStorage | Yes (persona param on export) |
| rentInputStore | `stores/rentInputStore.ts` | dwellingType, bedrooms, weeklyRent, finishTier, bathrooms, hasParking, isFurnished, hasOutdoorSpace, isCharacterProperty, sharedKitchen, utilitiesIncluded, notInsulated | No | Yes (rent_inputs in export + snapshot inputs_at_purchase) |
| buyerInputStore | `stores/buyerInputStore.ts` | askingPrice, bedrooms, finishTier, bathrooms, hasParking | No | Yes (buyer_inputs in export + snapshot inputs_at_purchase) |
| budgetStore | `stores/budgetStore.ts` | Buyer: purchasePrice, depositPct, interestRate, loanTerm, rates, insurance, utilities, maintenance, bodyCorpFee, annualIncome. Renter: weeklyRent, roomOnly, householdSize, utilities, contentsInsurance, transport, food, annualIncome | localStorage | Yes (budget_inputs in export) |
| hostedReportStore | `stores/hostedReportStore.ts` | bedrooms, bathrooms, finishTier, weeklyRent, askingPrice, hasParking, isFurnished etc. | No | No (client-side delta recalculation only) |
| downloadGateStore | `stores/downloadGateStore.ts` | isAuthenticated, credits {plan, creditsRemaining, quickCredits, fullCredits, dailyLimit, downloadsToday}, showUpgradeModal | No | No (reads from /account/credits) |
| pdfExportStore | `stores/pdfExportStore.ts` | isGenerating, downloadUrl, shareUrl, addressId, persona, error, _pendingToken | No | Yes (triggers export API). _doExport always fetches fresh JWT before API call to avoid stale tokens from confirm modal delay. 401 with credits → "session expired" toast, not plan selector. |
| mapStore | `stores/mapStore.ts` | selectedAddressId, mapStyle, layerVisibility, viewState | No | No (map UI state only) |
| searchStore | `stores/searchStore.ts` | query, results, isSearching, selectedResult | No | No (search UI state) |

---

## API Endpoints
<!-- UPDATE: When adding an endpoint, add a row here. -->

**Recent additions:**

| Method | Path | Auth | Rate | Purpose | Key tables |
|---|---|---|---|---|---|
| POST | `/admin/reinz-hpi/upload` | admin | — | Upsert a month of REINZ TA HPI data. Body: `{month_end, rows[{ta_name, hpi, calculated, change_*_pct}]}`. Source: REINZ monthly PDF (page 14 full TA index + page 6 movement cols). UI: `/admin/reinz-hpi` (`ReinzHpiPanel.tsx`). | reinz_hpi_ta |
| GET | `/admin/reinz-hpi` | admin | — | List months loaded in `reinz_hpi_ta` with row counts + CGR coverage. | reinz_hpi_ta |
| POST | `/admin/cache/flush` | admin | — | Redis FLUSHDB. Used after REINZ HPI upload or DataSource reload to evict 24h-cached reports. UI: button on `/admin/reinz-hpi`. | - |

**Rate-limit proxy-headers contract:** uvicorn runs with `--proxy-headers --forwarded-allow-ips "*"` (see `backend/Dockerfile`) because host nginx proxies to `127.0.0.1:8000` via a Docker bridge. Without these flags, slowapi's `get_remote_address` sees the bridge gateway as the client IP and **every user on earth shares a single rate-limit bucket**. Trusting `*` is safe because compose binds `:8000` to `127.0.0.1` only, so the api is unreachable from the public internet and only host nginx (same VM) can forward to it. If you ever move the api off the host, tighten `--forwarded-allow-ips` to the nginx IP.

**Tour map demo targets the NavigationControl buttons** — `MapContainer` renders a `NavigationControl` (zoom +/-) at top-right. The OnboardingTour `demo-map-navigation` onEnter ripples over `.maplibregl-ctrl-zoom-in` and `.maplibregl-ctrl-zoom-out` (stable MapLibre classnames) then triggers the actual zoom via `tour:fly-to` so the user learns what the buttons do by watching the tour use them. If you restyle the navigation buttons, preserve the class names or the tour's ripple targets will fail silently.

**Signup nudge (`SignupNudge.tsx`, mounted inside `PropertyReport`):** shows a small dismissible bottom-right card prompting anonymous users to sign in. Fires once per session when `shouldShowSignupNudge()` allows. Timer: 60s for first-time visitors, 30s for returning visitors (detected via `isReturningVisitor()` which reads a persistent `wharescore_has_visited_before` localStorage flag written by `markVisitedEver()` on every property view). Value props called out in copy: save properties + shareable free report. Session-level `wharescore_signup_nudge_shown` flag prevents re-firing; dismissing the card (X or Maybe later) respects the flag. Z-index below `ScrollPrompt` so the paid-upgrade prompt wins if both would be visible at once.

**Auth entry-point routing contract:** every user-facing auth prompt (SignupNudge, SavePropertyButton, EmailSummaryCapture, the Sign-in header button, etc.) MUST route to `/signin?callbackUrl=...` rather than calling next-auth's `signIn()` directly. The `/signin` page is the branded welcome and provider picker — email-OTP (primary, no password) OR Google OAuth. Calling `signIn('google')` from a component commits the user to a single provider and skips the welcome. The only exception is `AdminAuthGate` which is admin-only and sees a fixed user base.

**Deep-link routing to `/?address=X`:** the landing page's URL-sync effect (`app/page.tsx`) is gated behind a `hasMountedRef` so it does NOT strip `?address` on first mount. Without the gate, two useEffects race on mount: the URL-sync clears the param before the restore-from-URL effect can read it, and the user bounces to a blank landing page. The strip only runs for explicit user-initiated deselection (back button, Search Another, tour finish). Any code that tries to "clean up" the URL on mount will reintroduce the bug.

**Saved-properties full_address fallback:** `GET /account/saved-properties` LEFT JOINs `addresses` and COALESCEs through `saved_properties.full_address` (if non-empty AND not the legacy "Saved property" placeholder) → `addresses.full_address` → `''`. Ensures /account always shows the real street address regardless of whether the save was POSTed with an empty body, came from the legacy localStorage migration, or came from a later correctly-formed POST.

**Saved-properties pipeline (end-to-end):**
- Canonical localStorage key is `saved_properties` (array of `SavedProperty` objects). Legacy `wharescore_saved` (array of addressIds) is auto-migrated on first load of `useSavedProperties`, then deleted.
- `SavePropertyButton` writes via `useSavedProperties.toggle()`. For signed-in users it also POSTs / DELETEs to `/api/v1/account/saved-properties` so saves persist across devices.
- On sign-in (or mount if already signed in), the button pulls `GET /account/saved-properties` and merges server items into local via `useSavedProperties.mergeFromServer()`. Local-only items are not pushed back proactively; they sync on next toggle.
- Cross-instance sync: the hook listens for `window` `storage` + custom `saved-properties-updated` events so one button's toggle updates any other consumer (e.g. landing panel) in the same tab without a refresh.
- `/account` page shows a dedicated **Saved Properties** section above **Saved Reports**. Both are fetched in parallel; saved-properties failure is silent (non-critical vs the saved-reports path which drives purchased content).
- When adding new places that want to display the user's saved list, prefer `GET /account/saved-properties` over localStorage for signed-in users — localStorage is a cache, the server is the source of truth cross-device.

**Analytics IP-capture contract:** every server-side `track_event()` call MUST pass `ip=client_ip_from_request(request)` (helper in `app/services/event_writer.py`). Without it, `app_events.ip_hash` stores NULL and the admin DAU/WAU/MAU + new/returning metrics on `/admin/analytics/overview` report zero. Active callsites using the helper: `routers/search.py` (search event), `routers/property.py` (report_view, report_generated). Frontend-emitted events flow through `POST /events` which reads headers inline. If you add a new `track_event` call anywhere in a router, thread the helper through it.

Default limit across all endpoints without explicit override: **240/minute per IP** (see `app/deps.py`). Endpoints below override with specific limits.

| Method | Path | Auth | Rate | Purpose | Key tables/services |
|--------|------|:----:|------|---------|-------------------|
| GET | `/property/{id}/report` | No | 40/min (user or IP) + 15/min (IP only, anon) | Full property report. `?fast=true` skips Valhalla terrain (~5-15s) for progressive loading — frontend fetches fast first (deferred), then full in background. **Two overlaid limits** so authenticated/signed-in users aren't bottlenecked by a shared-IP counter (offices, universities) while still capping anonymous abuse. Bumped from 20/5 to 40/15 after the proxy-headers fix landed (before the fix, every user shared a single bucket, so the old limits were tight by necessity). | get_property_report() SQL, _overlay_transit_data() (AM+PM split, fixes nearest_train), _overlay_event_history(), _overlay_terrain_data() (skipped when fast=true) |
| GET | `/property/{id}/summary` | No | 60/min | Lightweight popup summary. Fast path: address+CV+rent query (~50ms). Pre-warms full report cache in background. | addresses, council_valuations, mv_rental_market, sa2_boundaries |
| GET | `/property/{id}/ai-summary` | No | 20/min | AI narrative (30s timeout) | generate_property_summary() |
| GET | `/property/{id}/rates` | No | 30/min | Live council rates for all 25 councils. Called lazily by frontend after report load; 404 = city has no integration. CV shown from DB first, updated inline when this resolves. City matched via `town_city` column (aliased as `city`). | 25 council APIs via `routers/rates.py` unified router |
| GET | `/property/{id}/area-feed` | No | 20/min | GeoNet + NEMA + MetService | External APIs |
| GET | `/property/{id}/crime-trend` | No | 60/min | Monthly crime 3yr | crime table |
| GET | `/property/{id}/earthquake-timeline` | No | 60/min | Annual quakes 10yr | earthquakes table |
| GET | `/property/{id}/rent-history` | No | 20/min | Rent trends | bonds_detailed |
| GET | `/property/{id}/market` | No | 20/min | Fair price analysis | bonds_*, council_valuations, rbnz_housing |
| POST | `/property/{id}/rent-advisor` | No | 20/min | Rent fairness | compute_rent_advice() |
| POST | `/property/{id}/price-advisor` | No | 20/min | Price fairness | compute_price_advice() |
| GET | `/nearby/{id}/highlights` | No | 40/min | Nearby amenities | osm_amenities |
| GET | `/nearby/{id}/schools` | No | 40/min | Schools + zones. `school_type` uses `org_type` column (Full Primary, Contributing, Secondary, etc.) | schools, school_zones |
| GET | `/nearby/{id}/transit` | No | 40/min | Transit stops | transit_stops |
| GET | `/nearby/{id}/crashes` | No | 40/min | Crashes 5yr | crashes |
| GET | `/nearby/{id}/heritage` | No | 40/min | Heritage sites | heritage_sites |
| GET | `/nearby/{id}/consents` | No | 40/min | Resource consents 2yr | resource_consents |
| GET | `/nearby/{id}/earthquakes` | No | 40/min | M4+ earthquakes 10yr 30km | earthquakes |
| GET | `/nearby/{id}/infrastructure` | No | 40/min | Infrastructure projects | infrastructure_projects |
| GET | `/nearby/{id}/buildings` | No | 40/min | Building outlines | building_outlines |
| GET | `/nearby/{id}/supermarkets` | No | 40/min | Supermarkets + grocers | osm_amenities |
| GET | `/nearby/{id}/amenities` | No | 40/min | Classified amenities (sentiment) | osm_amenities |
| GET | `/nearby/{id}/conservation` | No | 40/min | Conservation + eco + trees | conservation_land, significant_ecological_areas, notable_trees |
| POST | `/property/{id}/export/pdf/start?report_tier=quick\|full` | Yes | 20/hr | Start PDF gen (deducts credit matching requested tier) | _generate_pdf_background() |
| POST | `/property/{id}/export/pdf/guest-start` | Token | 20/hr | Guest PDF gen | guest_purchases |
| GET | `/property/{id}/export/pdf/status/{job}` | No | 120/min | Poll job status | pdf_jobs (Redis) |
| GET | `/property/{id}/export/pdf/download/{job}` | No | 20/min | Download HTML report | pdf_jobs (Redis) |
| GET | `/report/{token}` | No | 30/min | Hosted report snapshot (includes report_tier) | report_snapshots |
| POST | `/report/{token}/upgrade` | Optional | 10/min | Upgrade Quick→Full. Uses credit first (returns `{upgraded:true}`), else Stripe checkout ($9.99/$4.99 Pro). Quick response data is server-side stripped — full data only returned for tier='full'. | report_snapshots, report_credits, Stripe |
| GET | `/search/address` | No | 60/min | Address autocomplete (3-tier) | addresses (tsvector + trigram) |
| GET | `/search/suburb` | No | 30/min | Suburb search | sa2_boundaries |
| GET | `/suburb/{sa2_code}` | No | 20/min | Suburb profile | area_profiles, sa2_boundaries |
| GET | `/suburbs/guides` | No | 60/min | List published SEO suburb guides (sitemap + /suburbs index) | suburb_guide_pages |
| GET | `/suburbs/guide/{slug}` | No | 60/min | Full SEO guide for one suburb (1h Redis cache) | suburb_guide_pages |
| GET | `/account/credits` | Yes | — | Plan + credit balance (returns quick_credits, full_credits, credits_remaining) | users, report_credits |
| GET | `/account/saved-reports` | Yes | — | User's saved report list | saved_reports |
| GET | `/account/saved-reports/{id}/download` | Yes | — | Re-download saved report | saved_reports |
| POST | `/account/saved-properties` | Yes | — | Bookmark a property | saved_properties |
| POST | `/account/email-summary` | Yes | — | Queue email summary | users, addresses |
| POST | `/account/manage-subscription` | Yes | — | Stripe portal URL | report_credits, Stripe API |
| POST | `/account/redeem-promo` | Yes | 15/min | Redeem promo code (returns report_tier: quick\|full) | promo_redemptions, report_credits |
| POST | `/checkout/session` | Yes | 15/min | Stripe checkout (auth). Plans: full_single ($9.99), pro_extra ($4.99 Pro over-limit), pro ($140/mo). Promotion codes enabled. Verifies stored Stripe customer ID exists (handles test→live switch). | Stripe API |
| POST | `/checkout/guest-session` | No | 5/min | Stripe checkout (guest). Plan: full_single ($9.99) | guest_purchases, Stripe API |
| GET | `/checkout/guest-token` | No | 5/min | Exchange session for download token | guest_purchases, Redis |
| POST | `/webhooks/stripe` | Sig | 60/min | Stripe events | report_credits, users, guest_purchases |
| PATCH | `/account/profile` | JWT | 10/hour | Update the current user's `display_name` (1-60 chars, internal whitespace collapsed, surrounding trimmed). Returns `{display_name}`. Used by the Edit name control on `/account`. | users |
| POST | `/rent-reports` | No | 30/min | Submit or enrich a crowd-sourced rent report. Auto-upserts within a 24h (ip_hash, address_id) window so progressive submissions (core rent first from RentComparisonFlow, richer details later from RentAdvisorCard) land on one row. Accepts the core trio (dwelling_type, bedrooms, reported_rent) plus optional richer fields (bathrooms, finish_tier, has_parking, is_furnished, is_partially_furnished, has_outdoor_space, is_character_property, shared_kitchen, utilities_included, not_insulated). source_context and notice_version are audit-only. No auth. Data collection is covered by the first-visit `RentDataNotice` banner (not gated — notice is informational). | user_rent_reports, sa2_boundaries, bonds_detailed, addresses |
| GET | `/rent-reports/{id}` | No | 40/min | Building rent data (3+ reports) | rent_reports |
| POST | `/budget-inputs` | No | 3/hr | Save budget calculator data | user_budget_inputs |
| POST | `/email-signups` | No | 3/hr | Region availability signup | email_signups |
| POST | `/auth/send-code` | No | 5/min, 10/hr | Send 6-digit OTP to email via Brevo | Redis (otp:{email}, 5 min TTL) |
| POST | `/auth/verify-code` | No | 10/min | Verify OTP code, return user info for NextAuth | Redis (otp:{email}) |
| POST | `/feedback` | No | 5/hr | Submit feedback | feedback |
| GET | `/health` | No | — | Health check | DB + Redis ping |
| POST | `/events` | No | 60/min | Frontend event ingestion (allowlisted types) | app_events |
| GET | `/admin/check` | Admin | 30/min | Check if signed-in user has admin access (email in ADMIN_EMAILS) | users |
| GET | `/admin/users` | Admin | 30/min | List users with per-tier credit balances (searchable, paginated) | users, report_credits, saved_reports |
| POST | `/admin/users/{id}/credits?amount=N&tier=quick\|full` | Admin | 30/min | Add (positive) or remove (negative) credits for a user | report_credits |
| GET | `/admin/analytics/overview?days=N` | Admin | 30/min | Analytics dashboard. `today.*` stat cards (searches, report_views, reports_generated, payments, total_requests, avg_response_ms, server_errors, errors) **scale with `days` (1/7/30/90, capped at 90)**; `today.active_sessions` is CURRENT_DATE only (live metric). Also returns `trends`, `top_endpoints` (24h), `slow_requests` (24h), `recent_errors`, `unresolved_errors_24h`, `range_days` (echoes param), **unique visitors (DAU/WAU/MAU + new/returning today)**, **conversion funnel (7 day, visit → search → report view → generated → payment screen → payment completed, by distinct ip_hash; payment screen stage counts distinct user_id because Stripe checkout has no ip)**, **geography blocks (top_cities_viewed, top_cities_generated, top_search_queries — 30-day window, joins app_events.properties.address_id → addresses.town_city)** | app_events, perf_metrics, error_log, daily_metrics, addresses |
| GET | `/admin/analytics/events` | Admin | 30/min | Paginated event browser (filterable by type, days) | app_events |
| GET | `/admin/analytics/errors` | Admin | 30/min | Paginated error browser (filterable by category, days) | error_log |
| POST | `/admin/analytics/errors/{id}/resolve` | Admin | 30/min | Mark error as resolved | error_log |
| GET | `/admin/analytics/buyer-inputs` | Admin | 30/min | Buyer-side mirror of `/analytics/rent-reports`. Aggregates persona='buyer' rows from `user_budget_inputs`: totals (total/7d/30d/distinct addresses-sa2s-contributors), 30d trend, breakdowns (by_city top 20, by_bedrooms, by_bathrooms, by_finish_tier, by_price_band, by_source), field completeness (asking_price/purchase_price/bedrooms/bathrooms/finish_tier/has_parking/deposit/income percentages). Powers the admin `BuyerInputsPanel`. | user_budget_inputs, addresses |
| GET | `/admin/analytics/rent-reports` | Admin | 30/min | Aggregated view of crowd-sourced rent submissions: totals (total/7d/30d/outliers/distinct addresses-sa2s-contributors), 30d daily trend, breakdowns (by_city top 20, by_bedrooms, by_bathrooms, by_dwelling_type, by_source_context), rich-field completeness (bathrooms/finish/parking/furnished/outdoor/character/utilities/insulation percentages). Used by the admin `RentReportsPanel` to monitor data-volume, coverage, and form-quality. Excludes outliers from the medians. | user_rent_reports, addresses |
| POST | `/admin/data-sources/{source_key}/load` | Admin | - | Trigger a single DataSource loader in the background. Single-flight via Redis key `data_loader:active` (409 if busy). Returns `{job_id, status}`; poll for progress. | `data_loader.DATA_SOURCES_BY_KEY[source_key].loader()` + `data_versions` |
| POST | `/admin/data-sources/load-new` | Admin | 1/min | Run migrations, then load every DataSource that has never been loaded (not in `data_versions`). Skips already-loaded datasets — use for first-time seeding, not refresh. Single-flight guarded. Returns `{job_id, datasets_to_load, keys}`. | DATA_SOURCES, data_versions |
| POST | `/admin/data-sources/reload-all?keys=a,b,c` | Admin | 1/min | **Force-reload** every DataSource sequentially (ignores `data_versions`). Use for scheduled refreshes of time-varying feeds (`epb_mbie`, `metlink_gtfs`, council hazards, etc.). Optional `keys=` param restricts the run to a comma-separated subset. Single-flight guarded. Flushes `report:*` Redis cache on completion. | All DATA_SOURCES loaders |
| GET | `/api/v1/admin/data-sources/health` | Admin | - | Operational health of every DataSource. Joins `DATA_SOURCES` with `data_source_health` (left-join — sources never run appear with NULL fields). Each row includes `auto_load_enabled` (False = registered for inventory but excluded from bulk automation). Sorts by problems first (blocked > failing > stale > healthy). Optional `only_problems=true` for the dashboard's "needs attention" view. | DATA_SOURCES, data_source_health |
| GET | `/api/v1/admin/data-sources/due` | Admin | - | Subset of DataSources due for a freshness check right now (per cadence_class + check_interval + last_attempt_at). Cheap query; the cron polls this before triggering reloads. | DATA_SOURCES, data_source_health |
| POST | `/api/v1/admin/data-sources/refresh-due?limit=N&dry_run=bool` | Admin OR `Authorization: Bearer ADMIN_API_TOKEN` | 1/hour | Walks due sources, polls upstream metadata via `change_detection`, runs `run_loader()` only when changed. Validation gate active (rejects new row count < 50% of previous). `limit` caps the run (default 10) so backlogs don't run away. Single-flight via Redis. **Response shape splits on `dry_run`:** `dry_run=true` is synchronous (cheap metadata polls only, returns `.results[]` in seconds — used by ops to verify classifications). `dry_run=false` is **fire-and-forget** — kicks off a background task and returns `{job_id, due_count, due_keys}` immediately so nginx doesn't 504 on long bulk reloads (auckland_flood is ~5 min). Per-source outcomes for the async path land in `data_source_health`; live progress in Redis `data_loader:active` (poll `GET /admin/data-sources/job`). Called by the daily GH Actions `data-refresh.yml` workflow. | DATA_SOURCES, data_source_health |
| POST | `/extension/badge` | Optional | 60/min authed · 30/min anon | Browser-extension tier-gated badge: resolves the host-page address, returns score + persona-tailored findings + tier-appropriate price/rent/walk/school fields. Body = `{source_site, address_text, source_url?}` — no host-page attributes. Requires header `X-WhareScore-Extension: 1`. | search_service, get_property_report(), enrich_with_scores(), select_findings_for_badge() |
| GET | `/extension/status` | No | 60/min | Per-site kill-switch + version floor. Polled every 60 min by the extension via `chrome.alarms`. Phase 1 ships with `trademe.co.nz.badge_enabled=false`. | Static response |

**Admin UI note:** All admin hooks (`useAdmin*.ts`) and `AnalyticsPanel` use `useAuthToken()` to send Bearer tokens. Hooks must be called before any early returns in components — never conditionally.

**TypeScript note:** `ReportSnapshot` cannot be cast directly to `Record<string, unknown>` — use `as unknown as Record<string, unknown>` for dynamic field access on snapshot objects. This applies when accessing snapshot fields not yet in the `ReportSnapshot` interface (e.g. newly added data like `business_demography`).

**Admin note:** New tables must be added to `ALLOWED_TABLES` in `admin.py` (line ~28) for the admin data health dashboard to count them.

**Mobile text rule:** No text below 12px (`text-xs`). All `text-[10px]` and `text-[11px]` were replaced with `text-xs` across 73+ files. Touch targets minimum 44px. Search overlay results py-4, cancel button min-h-[44px], drawer handle pt-4/pb-4.

**Property type note:** All three report covers (Full, Quick, on-screen) show a property type badge from `report.property.title_type` or `report.property.building_use` (first non-"Unknown" value). Helps users understand what the CV/data applies to (e.g. "Unit Title" vs "Freehold" vs "Commercial car parking").

**Security note:** `/property/{id}/report` strips premium data (terrain, event_history, area_profile, council-specific hazard detail) for unauthenticated users. `/report/{token}` Quick tier uses `_QUICK_ALLOWED_KEYS` allowlist + strips inner report detail. Authenticated users get full data. When adding new premium fields, add to Quick allowlist only if rendered by HostedQuickReport.

**SQL note:** In snapshot_generator.py queries, use explicit `CROSS JOIN addr` instead of implicit `FROM table, addr` when also using `LEFT JOIN` — PostgreSQL can't reference the implicit join alias from the LEFT JOIN clause.

## SEO Suburb Guide Pages
<!-- UPDATE: When adding an SEO landing-page route, add a row here. -->

| Route | File | Source | SSR | Indexed |
|-------|------|--------|:---:|:-------:|
| `/suburbs` | `frontend/src/app/suburbs/page.tsx` | `GET /api/v1/suburbs/guides` | Yes | Yes |
| `/suburbs/{slug}` | `frontend/src/app/suburbs/[slug]/page.tsx` | `GET /api/v1/suburbs/guide/{slug}` | Yes | Yes |
| `sitemap.xml` entries for guides | `frontend/src/app/sitemap.ts` | `GET /api/v1/suburbs/guides?limit=5000` | Yes | — |

Guide content lives in `suburb_guide_pages` and is generated by `scripts/generate_suburb_guides.py` (local Qwen via Ollama). JSON-LD Article + BreadcrumbList + FAQPage schemas are emitted server-side. Metadata (title/description/canonical/og) is computed in `generateMetadata()`.

---

**Performance note:** Report endpoint has `[PERF]` timing logs via `print()`. Cold cache ~1s after index fix (was 9-12s). Migration 0031 adds index on `addresses(gd2000_xcoord, gd2000_ycoord)`. Quick Report snapshots skip Valhalla terrain (~60s saving) — `skip_terrain` passed from `create_report_snapshot` → `generate_snapshot` → `prefetch_property_data`. Terrain backfilled async via `_backfill_terrain()` and merged into snapshot JSONB. Background generation has `[PERF-BG]` timing logs. Transit access label uses score thresholds (not risk rating). Nearest train capped at 50km (migration 0033 replaces `get_property_report()` — do NOT edit 0022 in place). 48 cities in `cbd_points` (migration 0032). Snapshot generation uses `preloaded` dict to skip re-fetching data the background task already has (report, rent_history, hpi_data, rates_data, supermarkets, highlights). `prefetch_property_data` runs 16 independent queries in parallel via `asyncio.gather` with separate DB connections. Rent baselines (5 bedroom variants) also parallelized.

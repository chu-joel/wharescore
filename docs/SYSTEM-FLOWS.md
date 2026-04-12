# WhareScore System Flows

> How auth, payments, scoring, findings, and infrastructure work end-to-end.
> Agents: search by system name. Update when changing any flow.

---

## Screen Purposes & Content Rules

**Every screen has a specific purpose. When adding or changing features, follow these rules to decide what goes where.**

### Free On-Screen Report (`/property/{id}`)
**Purpose:** Show enough real value that the user trusts WhareScore knows what it's talking about, then make them want the full report. The free report should make the user think "this is already more useful than anything else I've found — imagine what the full report has."

**Report flow: Verdict → Evidence → Action → Upgrade → Deep Dive**

- **1. VERDICT (glanceable, 5sec):** RenterSnapshot (rent affordability, market power, healthy homes, mould risk, sun aspect → overall verdict) OR BuyerSnapshot (insurability, building era risk, renovation potential, climate/managed retreat, capital growth, title type → overall verdict). ScoreGauge and ScoreStrip removed — Snapshots provide the verdict.
- **2. EVIDENCE:** First 2 key findings (severity-ranked). Area activity teaser.
- **3. ACTION (high-value free content):** LandlordChecklist (renter hero — personalized questions with climate-zone insulation R-values, heating requirements, HH compliance) OR BuyerDueDiligence (buyer hero — "We've covered 6 of 12 checks, here's what you still need" with costs). KnowYourRights panel in renter checklist accordion (bond max, rent increase rules, modification rights, fibre broadband rights).
- **4. UPGRADE:** CTA banner.
- **5. DEEP DIVE:** Question accordion. Renters: `rent-fair` and `daily-life` expanded by default. Buyers: `deal-breakers` and `true-cost` expanded by default. All others collapsed.
- **6. BELOW FOLD:** AI Summary (area narrative), email capture, data layers (compact), key takeaways, disclaimer.
- GATE (blur/lock): Findings 3+, PM transit, HPI, investment metrics, full checklists.
- NEVER SHOW (hosted-only): Rent advisor, price advisor, school zones, DOC, weather history, hazard advice, recommendations, neighbourhood stats.
- PERSONA FILTERING: Renters see simplified hazard view (critical alerts only, no indicator grids, no fault/landslide/climate/solar detail), FlatmateFriendly card in rent section, SunAspectCard in daily-life, aircraft noise in NoiseLevelGauge. Buyers see full indicator grids, all technical detail. CrimeCard humanized for all ("Safer than X% of areas", no raw victimisation count). IndicatorCards show plain-English descriptions only (no numeric score bars).

### Paid Hosted Report (`/report/{token}`)
**Purpose:** This is the product people pay money for. It must be professional, comprehensive, truthful, and actionable. The user should finish reading it and know exactly what to do next — whether to proceed with the property, what to investigate further, what risks to price in, and what questions to ask the landlord/agent. It replaces the need for hours of manual research.

**Who reads this and why:**
- **Renters** want to know: Is the rent fair? Is the place safe? What's the neighbourhood like? Are there hidden issues (mould, noise, flooding)? What are my rights? They need confidence to sign a lease or leverage to negotiate rent.
- **Buyers** want to know: Is the price fair? What are the real risks? What will insurance cost? Will the value hold? What should I get inspected? They need confidence to make an offer or walk away.

**Quality standard:**
- PROFESSIONAL: This competes with paid property reports from CoreLogic/QV. Every section must look polished, data must be presented with context (not raw numbers), and insights must be actionable ("your rent is 12% above fair — here's why" not just "median rent: $550").
- TRUTHFUL: Never spin data. If a property has serious hazards, say so clearly. If data is limited, say "limited data available" — don't hide the section. Users trust us because we tell them things the listing doesn't.
- COMPLETE: Show EVERYTHING we have data for. If a data layer exists for this property's region, it appears here. An empty section ("No flood hazard data found for this area") is better than a missing section — it shows we checked.
- ACTIONABLE: Every section should answer "so what?" for the user's persona. Hazard findings should say what to do (get a geotech report, check insurance, ask about EQC). Market data should say whether the price/rent is fair and by how much.

**Content rules:**
- SHOW EVERYTHING: All findings (no gating), all hazard detail, all transit times (AM + PM), rent advisor with adjustable inputs, price advisor with methodology, HPI chart, rent history, school zones, DOC facilities, road noise, weather history, hazard-specific advice, actionable recommendations, neighbourhood stats, infrastructure projects, healthy homes compliance (renters), methodology/data sources
- PERSONA-AWARE: Renter reports show rent advisor, healthy homes, rent fairness. Buyer reports show price advisor, mortgage calc, investment yield. Both show all hazards, transport, planning.
- NEVER HIDE: If data exists, show it. Empty sections show we checked. Missing sections look like we forgot.
- COLLAPSE/EXPAND DEFAULTS: Event Timeline collapsed by default. Hazard Advice sections open by default.
- RECOMMENDATIONS: End with clear next steps ("Before you sign: 1. Get a building inspection 2. Check your insurance quote 3. Ask about the flood risk"). These should be specific to the hazards/issues found, not generic.
- DATA: Uses pre-computed snapshot (immutable JSONB). All data captured at generation time. User adjustments (rent/price sliders) are client-side only using delta tables — no regeneration needed.
- METHODOLOGY: Include a section explaining where the data comes from and how scores are calculated. Transparency builds trust.

**Completeness check (for agents):**
When adding ANY new data layer to the system:
1. Add the data to the snapshot → `generate_snapshot()` return dict in `snapshot_generator.py`
2. Create a `HostedXxx.tsx` component in `frontend/src/components/report/`
3. Render it in `HostedReport.tsx` in the appropriate position
4. Think about BOTH personas — does a renter care about this? Does a buyer? Show it to the right persona or both.
5. Present the data with context and a "so what" — not just raw numbers
6. Update `docs/FRONTEND-WIRING.md` § Hosted-sections table

### Map View (`/`)
**Purpose:** Discovery. Let users explore the map, see property pins, and search addresses. The map is the entry point.

**Content rules:**
- SHOW: Search bar, map layers (hazards, property, schools, planning, transport), property pins with popup summary
- Popup shows: Address, score, CV, 1-2 key findings
- Click-through to full report

### Account Page (`/account`)
**Purpose:** Manage credits, view past reports, subscription management.

**Content rules:**
- SHOW: Credit balance, plan type, saved reports list with re-download, subscription management link (Stripe portal)
- AUTH REQUIRED: Redirects to signin if not authenticated

### Guest Download Page (`/guest/download`)
**Purpose:** One-time download after guest (no-account) purchase. Token-based, expires in 5 minutes.

---

## Auth Chain

### Sign-in flow
```
User clicks "Sign in" → Google OAuth (NextAuth)
  → Google returns profile + tokens
  → NextAuth JWT callback stores Google sub as user ID
  → Session created with user.id, email, name
```

### Token flow (frontend → backend)
```
Frontend needs to call authenticated endpoint
  → useAuthToken() hook calls GET /api/auth/token
  → Next.js API route checks session (await auth())
  → Generates HS256 JWT (5-min expiry) signed with AUTH_SECRET
  → Returns {token: "eyJ..."}
  → Hook caches token for 4 minutes
  → Frontend sends: Authorization: Bearer {token}
```

### Backend validation
```
Request hits authenticated endpoint
  → require_user FastAPI dependency extracts Bearer token
  → Verifies HS256 signature with AUTH_SECRET (shared with Next.js)
  → Extracts user_id from token.sub
  → Auto-creates user in DB on first request (plan='free')
  → Links any guest purchases with matching email
```

**Key files:**
- `frontend/src/auth.ts` — NextAuth config (Google provider)
- `frontend/src/app/api/auth/token/route.ts` — JWT generation
- `frontend/src/middleware.ts` — route protection (/account, /admin)
- `backend/app/services/auth.py` — require_user dependency
- **Shared secret:** AUTH_SECRET env var (must match in both)

**What requires auth:** `/account/*`, `/admin/*` (frontend middleware). `POST /export/pdf/start`, `POST /checkout/session`, `GET /account/credits`, `POST /account/redeem-promo` (backend require_user).

### Admin auth (email allowlist)
```
Admin page load → AdminAuthGate checks session
  → Not signed in? → "Sign in with Google" button
  → Signed in → GET /admin/check (Bearer JWT)
    → require_admin dependency: extracts email from JWT/DB
    → Checks email against ADMIN_EMAILS env var (comma-separated)
    → 200 → admin UI rendered
    → 403 → "Access Denied" with email shown
```
- **Config:** `ADMIN_EMAILS` env var (set in GitHub Secrets, written to .env.prod on deploy)
- **Dev mode:** If `ADMIN_EMAILS` is empty and `ENVIRONMENT=development`, all authenticated users get admin access
- **Key files:** `services/admin_auth.py` (require_admin), `config.py` (get_admin_emails), `AdminAuthGate.tsx`, `useAdminAuth.ts`

---

## Payment & Credit System

### Plans and pricing
| Plan | Price | Credits | Report Tier | Limits | Stripe mode |
|------|-------|---------|-------------|--------|-------------|
| free | $0 | 0 | — | — | — |
| quick (free) | $0 | Free with sign-in | Quick (~8 sections) | Unlimited | No payment |
| full_single | $9.99 | 1 report | Full (25+ sections) | No expiry | One-time payment |
| pro | $140/mo | Unlimited | Full | 10/day, 30 per rolling 30 days | Subscription |
| pro_extra | $4.99 | 1 report | Full | No expiry | One-time (Pro users over limit) |
| promo | Free | 1 per redemption | Full | Per-code max | Via redeem-promo |
| upgrade | $9.99 ($4.99 Pro) | — | Quick→Full | Per-snapshot | One-time payment |

### Report tiers
- **Quick Report** (free, sign-in required): Score, AI bottom line, RAG grid, 3 key findings, rent/price band, hazard summary, schools, neighbourhood highlights, top actions. Single-column, no sidebar. Shareable hosted link + printable PDF.
- **Full Report** ($9.99): All 25+ sections with full detail, interactive sidebar, rent/price methodology, hazard intelligence timeline, terrain analysis, neighbourhood deep-dive.
- Same snapshot data — tier controls frontend rendering only. Stored as `report_tier` column on `report_snapshots`.
- Upgrade: `POST /report/{token}/upgrade` — first tries to use an existing credit, then falls back to Stripe checkout for $9.99. On success (either path), `report_tier` updated to `'full'`, `expires_at` cleared, and report-ready email sent to user via `send_report_ready_email()`.

### Authenticated purchase flow
```
UpgradeModal → handlePurchase(plan)
  → If not signed in: redirect to /signin?callbackUrl=current_path, return
  → POST /checkout/session {plan, address_id?}
  → Backend: get/create Stripe customer (verifies stored ID exists in Stripe — handles test→live key switch by creating new customer if stale) → create Checkout Session
  → Redirect to Stripe checkout URL
  → User pays on Stripe
  → Stripe sends webhook: checkout.session.completed
  → Backend: insert report_credits, update users.plan
  → User returns to site with credits
  → PaymentSuccessPage polls up to 10 times (2s interval)
  → If webhook slow: shows "pending" state with spinner
  → On credit detected: auto-redirects to report page
```

### Guest purchase flow
```
UpgradeModal → handleGuestCheckout()
  → POST /checkout/guest-session {address_id, persona}
  → Backend: create Checkout Session (no customer) + guest_purchases DB row
  → Redirect to Stripe
  → User pays
  → Webhook: checkout.session.completed (mode=guest_single)
  → Backend: store download token in Redis (5-min TTL)
  → Stripe redirects to /guest/download?session_id=...
  → Frontend: GET /checkout/guest-token?session_id=... → gets one-time token
  → Frontend: POST /property/{id}/export/pdf/guest-start?token=...
  → Report generated, snapshot created
  → If user later signs in with same email: guest purchases linked to account
```

### Credit deduction
```
POST /property/{id}/export/pdf/start?report_tier=quick|full
  → require_paid_user: reads report_tier from query params
  → Finds credit matching requested tier (prefers exact tier match)
  → Priority: pro > matching-tier credit > any credit (most recent first)
  → Active = not cancelled, not expired, credits_remaining > 0
  → Pro: check daily (10) + rolling 30-day (30) limits, always full tier
  → Single/pack3/promo: decrement credits_remaining by 1 on the matched credit row
  → If no credits: return 403 → frontend shows UpgradeModal
```

### Per-tier credit tracking
```
GET /account/credits returns:
  quick_credits: N  — sum of credits where report_tier = 'quick'
  full_credits: N   — sum of credits where report_tier = 'full'
  credits_remaining: N — total (quick + full, for backwards compat)
```
Frontend `downloadGateStore` tracks `quickCredits` and `fullCredits` separately.
ReportConfirmModal shows a tier picker when user has both quick and full credits.
If user has only one type, that tier is auto-selected (no picker shown).
Pro users always get Full (no picker).

### Promo codes
Hardcoded in `account.py` `_PROMO_CODES` dict:
- `WHARESCOREJOEL`: 1 Full report credit, 999 max uses per user
- `WHARESCOREPONY`: 1 Quick report credit, 10 max uses per user

### Report export flow (tiered: Quick free, Full $9.99)
```
User clicks Generate Report → usePdfExport.startExport(preferredTier?)
  → Callers originating from a paid CTA (ReportCTABanner, ReportUpsell,
    BlurredFindingCards) pass preferredTier='full'. That flows through
    pdfExportStore.startExport → useReportConfirmStore.show(id, cb, 'full')
    so the modal opens with Full preselected. Pass nothing (or 'quick')
    from generic "Get Your Report" buttons and the modal stays on Quick.
  → Pro user? → ReportConfirmModal(tier=full) → generate
  → Signed-in with credits? → ReportConfirmModal (choose Quick free or Full with credit)
  → Signed-in without credits? → ReportConfirmModal (Quick free only; Full → UpgradeModal)
  → Not signed in? → UpgradeModal (sign-in prompt + $9.99 Full purchase)
  → ReportConfirmModal: user fills dwelling type, bedrooms, etc.
  → User clicks Generate → _doExport(addr, token, tier) fires
  → Persistent toast.loading("Generating your report...") — stays visible until complete/error
  → POST /property/{id}/export/pdf/start?report_tier={tier} with Bearer token
  → Backend: require_paid_user — Quick tier skips credit check (free with auth),
    Full tier requires credits as before
  → Poll status every 2s (up to 90 attempts)
  → On completed: dismiss generating toast, show toast.success "Your report is ready!"
    with "Open report →" link (opens new tab, no auto-navigation)
  → On error: dismiss generating toast, show toast.error with message
  → Backend (Phase 1 complete, Full only): send_report_ready_email() if user has email
     → Quick reports: NO email (free tier, reduces Brevo usage)
     → Full reports: Brevo email with "View Report" + "or access from My Reports"
  → My Reports shows "Generating..." placeholder until share_token populated

Quick reports: expires_at = now() + 30 days. Warning shown in last 7 days.
Full reports: expires_at = NULL (permanent). Upgrading Quick→Full clears expiry.
```

**Discounts & credits:** Two mechanisms:
- **Stripe promotion codes** — all checkout sessions have `allow_promotion_codes=True`. Coupons (e.g. WHARE20 = 20% off) created in Stripe dashboard, users enter at checkout.
- **Admin credits** — `POST /admin/users/{id}/credits` gives free report credits directly. No in-app promo code UI (removed) — admin handles this via the dashboard.

**Key files:** `routers/payments.py` (Stripe sessions), `routers/webhooks.py` (payment webhooks), `routers/account.py` (credits, promo, saved-reports), `services/credit_check.py` (require_paid_user — Quick=free, Full=credits), `stores/downloadGateStore.ts` (frontend credit state), `stores/pdfExportStore.ts` (export flow + persistent generating toast + success toast opens new tab), `UpgradeModal.tsx` (purchase UI — Full $9.99/$4.99 Pro + Pro plan, max-h-[85vh] on mobile, no Quick card, no in-app promo code, all text min 12px), `PremiumGate.tsx` (blur overlay — max-h-24 collapsed, "Tap to unlock in full report"), `services/email.py` (send_report_ready_email). Toasts: `position="top-center"` (providers.tsx) to avoid floating button overlap.

---

## Scoring System

### Categories and weights
| Category | Weight | Aggregation | # Indicators |
|----------|--------|-------------|-------------|
| Hazards | 0.25 | Softmax (worst-dominates, β=0.08) | 11-15 |
| Environment | 0.10 | Weighted mean | 5 |
| Liveability | 0.20 | Weighted mean | 4 |
| Transport | 0.15 | Weighted mean | 6 |
| Market | 0.15 | Weighted mean | 3 |
| Planning | 0.15 | Weighted mean | 5 |

### Composite score formula
```
composite = exp(Σ(weight[k] × ln(score[k] + 1)) / Σweight[k]) - 1
```
Weighted geometric mean. Requires 3+ categories with scores. Market dropped if no rental data.

### Rating bins
| Score | Label | Color |
|-------|-------|-------|
| 0-20 | Very Low Risk | #0D7377 |
| 21-40 | Low Risk | #56B4E9 |
| 41-60 | Moderate Risk | #E69F00 |
| 61-80 | High Risk | #D55E00 |
| 81-100 | Very High Risk | #C42D2D |

### Key hazard indicator scores
- Flood 1% AEP (100yr) → 75/100
- Tsunami zone 3 → 85/100
- Liquefaction Very High → 95/100
- Active fault within 200m → 80/100
- Slope failure Very High → 90/100

### Rental trend sign handling
`rental_trend` uses `normalize_min_max(max(0.0, yoy_pct), 0, 20)` — negative
(falling) rents clamp to 0 so they never register as a "risk". A previous
version took `abs(yoy)` which made a 20% fall score the same as a 20% rise
and produced contradictory "Rents rising fast" copy on falling-rent
properties. Buyer-side concerns about falling yield live in
`BuyerSnapshot`, not in this 0-100 score.

### Rental fairness (market depth) inversion
`rental_fairness` is a market-depth signal keyed on bond count for the
suburb's ALL/ALL rental_overview row. The convention for risk scores is
HIGHER = MORE RISK, so a thick rental market (many bonds, lots of listings
to compare against) must produce a LOW score. The formula is
`round(100 * (1 - min(1, bonds/200)))`: 0 bonds → 100 (thin market, high
risk), 200+ bonds → 0 (thick market, low risk). A previous version had
this inverted, which caused properties in busy Wellington/Auckland suburbs
with 180+ bonds to show "Rental Fairness: High risk — limited rental
market activity" — the exact opposite of reality. The IndicatorCard copy
text in `frontend/src/components/common/IndicatorCard.tsx` keys off this
same HIGHER=WORSE convention, so flipping one without the other breaks it.

### Rent advisor area_context label convention
`rent_advisor._get_area_context()` returns suburb-level context items
(NZDep, transit stops 400m, schools 1.5km, max noise dB) sourced from
`mv_sa2_comparisons`. These describe the SUBURB AVERAGE, not this specific
property — a single meshblock can diverge substantially. Every description
string is prefixed "Suburb avg …"/"Suburb NZDep avg …"/"Suburb peak …" so
the Full report's HostedRentAdvisor "About {sa2_name}" block can't be
mistaken for the property's own stats (which often differ from the suburb
average and are reported elsewhere in `liveability.*`). If you add a new
context item, follow the same prefix convention and include the matching
`ctx.direction` (up/down/neutral) + `ctx.is_area_wide_hazard` flag.

### Rental CAGR sanitisation
`transformReport.transformMarket` in the frontend runs every CAGR through
`sanitiseCagr` before handing it to the UI. 1yr values outside ±25% and
5/10yr values outside ±15% are treated as signal noise (small SA2 bond
samples regularly throw out 30+% YoY moves that aren't real) and nulled
so the cards render "—" instead of "1yr -31.3%".

### Dual-CTA conversion funnel (save vs buy)
Anonymous users who land on a property report see two CTAs, not one:

- **Primary** — "Save free report (sign in)" → `pdf.startExport('quick')` →
  `pdfExportStore.startExport` calls `signIn(undefined, { callbackUrl: ... })`
  with an `autoSave=<addressId>` query param. After Google OAuth returns to
  the same property page, `PropertyReport.tsx` detects the param and kicks
  `startExport('quick')` automatically. The user ends up on the hosted Quick
  report with a saved account — no forgotten link, no dead traffic.
- **Secondary** — "Or buy the Full Report — $9.99" → `pdf.startExport('full')`
  → `UpgradeModal` → Stripe guest-checkout (no account required). After
  payment, `payment-success/page.tsx` detects `useSession() === 'unauthenticated'`
  and surfaces a "Claim this report — create a free account" prompt. The
  hosted link is still sent via email regardless.

Signed-in users see a single primary CTA ("Generate Report"). The
`ReportConfirmModal` picks Quick vs Full after the click — no funnel split
at the button level.

The three CTA surfaces that implement this are:
1. `PropertySummaryCard` header button (compact)
2. `ReportCTABanner` mid-report banner (full hero with features list)
3. `FloatingReportButton` FAB (sticky bottom-left on desktop/mobile)

All three route through `pdf.startExport(preferredTier)` where `preferredTier`
is `'quick'` for the free path and `'full'` for the paid path. The store is
the only place that decides "sign in first" vs "guest checkout" — the
buttons just declare intent.

### Schools indicator fallback (EQI missing)
`school_quality_score` was collapsing to 100 ("no schools nearby") any
time the feed returned schools without an EQI value joined — this
silently ruined the scoring for regions where the EQI feed hasn't been
refreshed. It now checks for EQI-carrying schools first and falls back
to a proximity-based score (distance to nearest + count bonus) when EQI
is missing but schools exist. Users stop seeing "Schools: 100/100" for
addresses with 4 schools in sight.

### NULL vs 0 handling
Indicators where NULL raw data means "no data for this location" (not "confirmed safe") are **omitted entirely** when the source field is NULL. This prevents showing "0/100 Low risk" when we simply don't have data. Affected indicators: flood, tsunami, coastal_erosion, liquefaction, slope_failure, wind, air_quality. Council-specific data and terrain/waterway fallbacks still set these indicators when available. Earthquake (GeoNet national), wildfire (always has station data), and EPB (count-based) are always set.

### Crime indicator fallback
Crime data uses NZ Police "area_unit" names which don't always match SA2 names (~10% of addresses fail the fuzzy match, especially in Auckland). When `crime_percentile` is null but TA-level crime stats exist (`crime_city_median_vics`), the indicator score is estimated by interpolating the TA's median victimisation count against known national quartiles: p25=61, p50=191, p75=479. Example: Auckland median=393 vics → 67.5th percentile → score 67.5/100. This prevents At a Glance from showing "?" for Crime.

### Coverage count
`coverage_summary()` counts only indicators present in the `indicators` dict (i.e. where we have data). Shows "N data layers" not "N of M". This avoids showing "30 of 34" when 4 indicators were omitted due to no data for the location.

### Terrain-inferred risk boosts (soft signals)
When council hazard data is absent, terrain shape, waterway proximity, and event history provide soft score boosts:
- Flood terrain score ≥3 (flat depression at low elevation) + no flood zone → 25-35/100
- Waterway ≤50m + flood score < 45 → 45/100; ≤100m → 35/100; ≤200m → 25/100
- Wind exposure score ≥4 (exposed ridgeline/hilltop) + no wind zone → 35-50/100
- ≥3 heavy rain events (5yr) + no flood zone → 15-33/100
- ≥2 extreme wind events (5yr) + low wind score → 20-35/100
- ≥5 M4+ earthquakes (10yr, 30km) + low earthquake score → 20-40/100

These never override actual council data — they only fill gaps where council mapping doesn't exist.
Waterway data from LINZ Topo50 (774K features: rivers, streams, drains) — table `nz_waterways`.

### Council-specific hazard normalisation (all cities)

National hazard tables (flood_zones, tsunami_zones, liquefaction_zones, slope_failure_zones) are Wellington-only. For all other cities, council-specific regional tables provide hazard data. `risk_score.py` uses a "take the worst" strategy: council data refines/overrides national scores via `max()`.

### Coverage & data layers display

`coverage_summary()` in `risk_score.py` returns per-category breakdown with available indicator keys. Shape:
```python
{"available": 25, "total": 34, "per_category": {"hazards": {"available": 9, "total": 11, "indicators": ["flood", ...]}, ...}}
```

Frontend `DataLayersAccordion` component (replaces old `CoverageRing`) shows this as an expandable accordion in the free report and a compact summary in the UpgradeModal. `transformReport.ts` also appends `bonus_features` (AI insights, council valuation, national data) detected from the raw report — these are non-indicator features shown alongside the category breakdown. Coverage is piped to the UpgradeModal via `downloadGateStore.coverage`.

| Hazard | National table (Wellington-only) | Council table (all cities) | Normalisation |
|--------|--------------------------------|---------------------------|---------------|
| Flood | `flood_zones` → `severity_flood()` | `flood_hazard` → AEP string parsing (0.5%→45, 1%→75, 2%→85, 10%→90) | Council used when WCC not present |
| Liquefaction | `liquefaction_zones` → `SEVERITY_LIQUEFACTION` | `liquefaction_detail` → same dict + fill-land boost (85) | Council always refines if higher |
| Tsunami | `tsunami_zones` → `SEVERITY_TSUNAMI` | `tsunami_hazard` → High/Medium/Low → 80/55/30 | Council used when WCC not present |
| Slope failure | `slope_failure_zones` → `SEVERITY_SLOPE_FAILURE` | `slope_failure` → `SEVERITY_GWRC_SLOPE` or `SEVERITY_SLOPE_FAILURE` | Council always refines if higher |
| Landslide susceptibility | (no national table) | `landslide_susceptibility` → `SEVERITY_LANDSLIDE_SUSCEPTIBILITY` (Very Low→5, Low→15, Moderate→45, High→75, Very High→90) | Separate indicator in WEIGHTS_HAZARDS (0.10) |

**Key file:** `backend/app/services/risk_score.py` — complete scoring logic

---

## Finding Generation

### Rules (what triggers each finding)
Generated by `generateFindings(report, persona)` in frontend.

**Critical:** Flood zone, tsunami zone 1/Red, liquefaction High/Very High, slope failure Very High, landslides ≥3 within 500m, coastal erosion <50m, EPB rating, fault zone High ranking

**Warning:** Liquefaction moderate, slope failure High/Medium, landslides 1-2, coastal erosion <200m, earthquake hazard grade 4, EPB 1-2 within 300m, contamination ≥5 nearby, road noise ≥65dB, aircraft noise ≥65dBA

**Info:** Heritage overlay, special character area, ecological area, notable trees 50m, contamination 1-4 nearby, road noise 60-65dB, aircraft noise 55-65dBA, high deprivation (NZDep ≥8)

**Positive:** No major natural hazards, schools ≥5 within 1.5km, transit ≥5 stops within 400m, low deprivation (NZDep ≤3), parks ≥3 within 500m, solar ≥1200 kWh/m²/year

### Deduplication rules
- InsuranceRiskCard: appears only in deal-breakers section, NOT duplicated in true-cost section
- TrajectoryIndicator: appears in `neighbourhood` section for BOTH personas (renters no longer have a separate `neighbourhood-improving` section)
- CrimeTrendSparkline: appears in `neighbourhood` section for both personas — gated behind PremiumGate for renters, free for buyers
- CrimeCard: appears in `safety` (renter) or `neighbourhood` (buyer) — never both. NeighbourhoodSection hides it for renters
- PriceAdvisorCard: appears only in `true-cost` section for buyers — NOT inside MarketSection (which would duplicate it in `investment`)
- Council Valuation card: hidden for renters in MarketSection (renters see CV in hero pill only)
- HPI chart: hidden for renters in MarketSection (not relevant to rental decisions)

### Ordering
1. Primary: severity (critical → warning → info → positive)
2. Secondary: persona relevance (renter: Hazards > Liveability > Environment; buyer: Hazards > Planning > Liveability)

### Gating
- Free report: first 2 findings shown, rest blurred with count badge
- Hosted report: all findings shown, no gating

---

## Caching Strategy

| What | Cache key | TTL | Invalidation |
|------|-----------|-----|-------------|
| Property report | `report:{address_id}` | 24h | Manual FLUSHDB or DEL |
| Council rates | `rates:{address_id}` | 1h | Auto-expire |
| Area feed | `area-feed:{address_id}` | 30min | Auto-expire |
| Crime trend | `crime-trend:{area_unit}` | 24h | Auto-expire |
| Suburb summary | `suburb:{sa2_code}` | 1h | Auto-expire |
| PDF job | `pdf_job:{job_id}` | 1h | Auto-expire |
| Guest token | `guest-token:{session_id}` | 5min | Deleted on first read |
| Report snapshot | DB (not Redis) | Forever | Immutable |

**Important:** After changing report logic or data — flush the Redis cache or wait 24h. Reports served from cache won't reflect changes.

**CV is no longer in the report cache path.** Capital value is fetched lazily via `GET /property/{id}/rates` after page load and displayed inline — it does not go through Redis.

---

## Request Lifecycle & Observability

### Middleware stack (order matters)
1. **TrustedHostMiddleware** — reject spoofed Host headers
2. **Security headers** — X-Content-Type-Options, X-Frame-Options, etc.
3. **CORS** — strict origin list
4. **Bot detection** — block scrapers, detect patterns
5. **Request metrics** (`middleware/request_metrics.py`) — generates UUID `request_id`, times request, writes to `perf_metrics` table via event writer
6. **Rate limiter** (slowapi) — per-IP/user throttling

### Event tracking
- **Backend**: `services/event_writer.py` provides `track_event()`, `write_perf_metric()`, `log_error()` — all non-blocking (asyncio queue, batch flush every 2s)
- **Frontend**: `lib/analytics.ts` provides `trackEvent()` via `navigator.sendBeacon` → `POST /api/v1/events`
- **Lifecycle**: Started/stopped in FastAPI lifespan. Queue bounded at 10K items (drops silently if full).
- **Aggregation**: Midnight detection in flush loop triggers daily rollup into `daily_metrics` table.
- **Cleanup**: `cleanup_old_analytics()` SQL function — run daily via cron: `docker exec app-postgres-1 psql -U postgres -d wharescore -c "SELECT cleanup_old_analytics()"`

### Admin analytics dashboard
- **Route**: `/admin/analytics` → `AnalyticsPanel.tsx`
- **Data**: Stat cards (today), sparkline trends, top endpoints table, slow requests (>2s), recent errors with resolve button
- **Refresh**: Auto-refresh every 30s via React Query

---

## Infrastructure

### Docker services (production)
| Service | Image | Port | Memory | Depends on |
|---------|-------|------|--------|-----------|
| postgres | postgis/postgis:17-3.5 | 5432 (internal) | 3GB | — |
| redis | redis:7-alpine | 6379 (internal) | 128MB | — |
| valhalla | docker-valhalla | 8002 (internal) | 1GB | — (SRTM 30m elevation tiles, walking isochrones) |
| martin | maplibre/martin:v0.15 | 3000 (internal) | 256MB | postgres |
| api | ./backend/Dockerfile | 8000 (internal) | 2GB | postgres, redis |
| web | ./frontend/Dockerfile | 3000 (internal) | 512MB | api |
| nginx | nginx:alpine | 80, 443 | — | api, web, martin |

### Required env vars (.env.prod → symlinked as .env on VM)

**Web container (Next.js) needs:** AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST=true, AUTH_URL (=FRONTEND_URL)

**API container (FastAPI) needs:** AUTH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DATABASE_URL, REDIS_URL, CORS_ORIGINS, FRONTEND_URL

**Both read from:** `.env.prod` on VM, symlinked to `.env` so docker-compose `${VAR:-default}` substitution works.

**Common mistake:** If web container has no AUTH_SECRET/AUTH_TRUST_HOST, NextAuth throws `UntrustedHost` on every request and pages fail to render. The container logs show the Docker container hostname in the URL (e.g., `https://9fbc24244360:3000/api/auth/session`).

**Optional:** MBIE_API_KEY, LINZ_API_KEY, AZURE_OPENAI_*, STRIPE_PRICE_*, ADMIN_PASSWORD_HASH, VALHALLA_URL

### Deploy
```
git push origin main → GitHub Actions → SSH to 20.5.86.126 → pull → build --no-cache → restart all
```

**Key file:** `docker-compose.prod.yml`, `.github/workflows/deploy.yml`

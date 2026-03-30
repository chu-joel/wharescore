# WhareScore System Flows

> How auth, payments, scoring, findings, and infrastructure work end-to-end.
> Agents: search by system name. Update when changing any flow.

---

## Screen Purposes & Content Rules

**Every screen has a specific purpose. When adding or changing features, follow these rules to decide what goes where.**

### Free On-Screen Report (`/property/{id}`)
**Purpose:** Show enough real value that the user trusts WhareScore knows what it's talking about, then make them want the full report. The free report should make the user think "this is already more useful than anything else I've found — imagine what the full report has."

**Content rules:**
- SHOW: Overall score (0-100 with colour), 5 category scores (Risk, Area, Market, Transit, Planning), first 2 key findings with full detail, basic overview of each question section (hazards, neighbourhood, transport, market, planning), AI summary preview, CV and property details
- GATE (blur/lock with count badge): Findings beyond first 2 (show "X more findings" count — creates urgency), PM transit times, HPI trend chart, detailed rent/price analysis
- NEVER SHOW (hosted-report-only): Rent advisor, price advisor, school zones, DOC facilities, road noise detail, weather history, hazard-specific advice, actionable recommendations, neighbourhood stats, infrastructure detail, healthy homes — these are the premium value
- DATA: Uses live API call (`GET /property/{id}/report?fast=true` first, then full in background). CV fetched lazily via `/property/{id}/rates`. Transit overlay for all cities. AI summary fetched separately.
- PERSONA: Toggle between renter/buyer changes which questions show and finding priority order. The toggle should be prominent — users should feel the report adapts to them.
- CONVERSION: Every gated section should make the value of upgrading obvious. "3 critical risks found — unlock full report to see details" not just a generic blur. CTAs show $9.99 (Full Report). Signed-in users can get a free Quick Report (8 sections, 30-day expiry).

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
- Upgrade: `POST /report/{token}/upgrade` creates Stripe checkout for $9.99. Webhook updates `report_tier` to `'full'` on same snapshot row.

### Authenticated purchase flow
```
UpgradeModal → handlePurchase(plan)
  → If not signed in: signIn('google'), return
  → POST /checkout/session {plan, address_id?}
  → Backend: get/create Stripe customer → create Checkout Session
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
User clicks Generate Report → usePdfExport.startExport()
  → Pro user? → ReportConfirmModal(tier=full) → generate
  → Signed-in with credits? → ReportConfirmModal (choose Quick free or Full with credit)
  → Signed-in without credits? → ReportConfirmModal (Quick free only; Full → UpgradeModal)
  → Not signed in? → UpgradeModal (sign-in prompt + $9.99 Full purchase)
  → ReportConfirmModal: user fills dwelling type, bedrooms, etc.
  → User clicks Generate → _doExport(addr, token, tier) fires
  → Toast: Quick="Find it in My Reports when ready" / Full="We'll email you a link"
  → POST /property/{id}/export/pdf/start?report_tier={tier} with Bearer token
  → Backend: require_paid_user — Quick tier skips credit check (free with auth),
    Full tier requires credits as before
  → Poll status every 2s (up to 90 attempts)
  → On completed: toast "Your report is ready!" with "Go to report" link
    (no auto-navigation — user stays on current page)
  → Backend (Phase 1 complete, Full only): send_report_ready_email() if user has email
     → Quick reports: NO email (free tier, reduces Brevo usage)
     → Full reports: Brevo email with "View Report" + "or access from My Reports"
  → My Reports shows "Generating..." placeholder until share_token populated

Quick reports: expires_at = now() + 30 days. Warning shown in last 7 days.
Full reports: expires_at = NULL (permanent). Upgrading Quick→Full clears expiry.
```

**Key files:** `routers/payments.py` (Stripe sessions), `routers/webhooks.py` (payment webhooks), `routers/account.py` (credits, promo, saved-reports), `services/credit_check.py` (require_paid_user — Quick=free, Full=credits), `stores/downloadGateStore.ts` (frontend credit state), `stores/pdfExportStore.ts` (export flow + toasts), `UpgradeModal.tsx` (purchase UI — Full $9.99 + Pro only, no Quick card), `services/email.py` (send_report_ready_email)

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
- TrajectoryIndicator: appears only in neighbourhood-improving section, NOT duplicated in neighbourhood for renters
- CrimeTrendSparkline: appears only in neighbourhood-improving section, NOT duplicated in neighbourhood for renters

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

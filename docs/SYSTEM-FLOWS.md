# WhareScore System Flows

> How auth, payments, scoring, findings, and infrastructure work end-to-end.
> Agents: search by system name. Update when changing any flow.

---

## Screen Purposes & Content Rules

**Every screen has a specific purpose. When adding or changing features, follow these rules to decide what goes where.**

### Free On-Screen Report (`/property/{id}`)
**Purpose:** Hook the user. Show enough value that they see the product works and want more. Generate trust with real data, create urgency with gated premium content.

**Content rules:**
- SHOW: Overall score, 5 category scores, first 2 findings, basic hazard/neighbourhood/transport/market/planning overview, AI summary preview
- GATE (blur/lock): Findings beyond first 2 (show count), PM transit times, HPI chart, detailed rent/price analysis
- NEVER SHOW: Rent advisor, price advisor, school zones, DOC facilities, road noise detail, weather history, hazard advice, recommendations, neighbourhood stats, infrastructure detail
- DATA: Uses live API call (`GET /property/{id}/report`), cached 24h. Live council rates API for CV. Transit overlay for all cities.
- PERSONA: Toggle between renter/buyer changes which questions show and finding priority order

### Paid Hosted Report (`/report/{token}`)
**Purpose:** Deliver maximum value. This is the product the user paid for. It must contain EVERYTHING we have data for — nothing should be missing. If a data layer exists for the property's region, it must appear here.

**Content rules:**
- SHOW EVERYTHING: All findings (no gating), all hazard detail, all transit times (AM + PM), rent advisor with adjustable inputs, price advisor with methodology, HPI chart, rent history, school zones, DOC facilities, road noise, weather history, hazard-specific advice, actionable recommendations, neighbourhood stats, infrastructure projects, healthy homes compliance (renters), methodology/sources
- NEVER HIDE: If data exists, show it. An empty section is better than a missing one — shows the user we checked
- DATA: Uses pre-computed snapshot (immutable JSONB). All data captured at generation time. User adjustments are client-side only (delta tables).
- COMPLETENESS CHECK: When adding any new data layer to the system, it MUST be added to the snapshot (generate_snapshot() in snapshot_generator.py) AND have a corresponding HostedXxx component in the hosted report.

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

---

## Payment & Credit System

### Plans and pricing
| Plan | Price | Credits | Limits | Stripe mode |
|------|-------|---------|--------|-------------|
| free | $0 | 0 | — | — |
| single | $4.99 | 1 report | No expiry | One-time payment |
| pack3 | $9.99 | 3 reports | No expiry | One-time payment |
| pro | $49/mo | Unlimited | 10/day, 30/month | Subscription |
| promo | Free | 1 per redemption | Per-code max | Via redeem-promo |

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
POST /property/{id}/export/pdf/start
  → require_paid_user: checks report_credits for active credit
  → Priority: pro > pack3/single > promo (most recent first)
  → Active = not cancelled, not expired, credits_remaining > 0
  → Pro: check daily (10) + monthly (30) limits
  → Single/pack3/promo: decrement credits_remaining by 1
  → If no credits: return 403 → frontend shows UpgradeModal
```

### Promo codes
Hardcoded in `account.py` `_PROMO_CODES` dict:
- `WHARESCOREJOEL`: 1 credit, 999 max uses per user
- `WHARESCOREPONY`: 1 credit, 10 max uses per user

**Key files:** `routers/checkout.py` (Stripe sessions + webhooks), `routers/account.py` (credits, promo), `stores/downloadGateStore.ts` (frontend credit state), `UpgradeModal.tsx` (purchase UI)

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

**Key file:** `backend/app/services/risk_score.py` — complete scoring logic

---

## Finding Generation

### Rules (what triggers each finding)
Generated by `generateFindings(report, persona)` in frontend.

**Critical:** Flood zone, tsunami zone 1/Red, liquefaction High/Very High, slope failure Very High, landslides ≥3 within 500m, coastal erosion <50m, EPB rating, fault zone High ranking

**Warning:** Liquefaction moderate, slope failure High/Medium, landslides 1-2, coastal erosion <200m, earthquake hazard grade 4, EPB 1-2 within 300m, contamination ≥5 nearby, road noise ≥65dB, aircraft noise ≥65dBA

**Info:** Heritage overlay, special character area, ecological area, notable trees 50m, contamination 1-4 nearby, road noise 60-65dB, aircraft noise 55-65dBA, high deprivation (NZDep ≥8)

**Positive:** No major natural hazards, schools ≥5 within 1.5km, transit ≥5 stops within 400m, low deprivation (NZDep ≤3), parks ≥3 within 500m, solar ≥1200 kWh/m²/year

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

**Important:** After changing report logic, data, or CV sources — flush the Redis cache or wait 24h. Reports served from cache won't reflect changes.

---

## Infrastructure

### Docker services (production)
| Service | Image | Port | Memory | Depends on |
|---------|-------|------|--------|-----------|
| postgres | postgis/postgis:17-3.5 | 5432 (internal) | 3GB | — |
| redis | redis:7-alpine | 6379 (internal) | 128MB | — |
| valhalla | docker-valhalla | 8002 (internal) | 1GB | — |
| martin | maplibre/martin:v0.15 | 3000 (internal) | 256MB | postgres |
| api | ./backend/Dockerfile | 8000 (internal) | 2GB | postgres, redis |
| web | ./frontend/Dockerfile | 3000 (internal) | 512MB | api |
| nginx | nginx:alpine | 80, 443 | — | api, web, martin |

### Required env vars (.env.prod)
**Mandatory:** POSTGRES_PASSWORD, REDIS_PASSWORD, AUTH_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

**Optional:** MBIE_API_KEY, LINZ_API_KEY, AZURE_OPENAI_*, STRIPE_PRICE_*, ADMIN_PASSWORD_HASH

### Deploy
```
git push origin main → GitHub Actions → SSH to 20.5.86.126 → pull → build --no-cache → restart all
```

**Key file:** `docker-compose.prod.yml`, `.github/workflows/deploy.yml`

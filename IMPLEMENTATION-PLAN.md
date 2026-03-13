# WhareScore — Implementation Plan (Overview)

**Created:** 2026-03-07
**Updated:** 2026-03-08 (session 26: restructured Phase 3/5, added types/constants/tailwind config, /summary endpoint, map-tap flow, URL routing)
**Status:** Ready to build

## Document Map

This plan is split into focused documents for efficient context loading:

| Document | Content | Lines |
|----------|---------|-------|
| **IMPLEMENTATION-PLAN.md** (this file) | Overview, project structure, Phase 6, references | ~390 |
| **BACKEND-PLAN.md** | Phase 1 (Database) + Phase 2 (FastAPI) + Security & Hardening | ~3,390 |
| **FRONTEND-PLAN.md** | Phase 3 (Shell + layout + design system) + Phase 4 (Report UI) + Phase 5 (Search + hooks) + Admin Portal + Frontend Security | ~2,260 |
| **docs/DATABASE-SCHEMA.md** | 42 tables, all columns/types/indexes, SQL execution order | reference |
| **ux-design-specification.md** | Wireframes, design system, component file map | reference |

**For a dev agent:** Load this overview + the relevant plan file. Don't load both backend and frontend at once unless needed.

---

## Build Order

Six phases, each produces something testable. Each phase is ~1-2 sessions.

```
Phase 1: Database Layer       →  Crime fix, TOAST, views, materialized views, PL/pgSQL functions, area_profiles + wcc_rates_cache tables
Phase 2: FastAPI Backend      →  .env, health, security middleware, search, report, scores, nearby, market, AI, rates, rent reports, feedback, admin
Phase 3: Frontend Shell       →  Martin tiles, Next.js + Tailwind config + types + constants, MapLibre + LINZ basemap, SplitView, mobile bottom sheet, AppHeader/AppFooter/dark mode/StaticPageLayout
Phase 4: Property Report UI   →  PropertyReport wrapper, score gauge, accordion sections, AI summary card, data presentation (can use mock data before backend exists)
Phase 5: Search & Integration →  Autocomplete, flyTo, full user flow, map-tap exploration, URL routing/SSR, all hooks
Phase 5b: Admin Portal        →  Auth gate, dashboard, analytics, data health, feedback mgmt, content mgmt
Phase 6: Polish & Deploy      →  Demo property, static pages, Docker, deploy, accessibility
```

---

## Project Structure

```
propertyiq-poc/
  backend/
    app/
      __init__.py
      main.py                        # FastAPI app, CORS, lifespan, security middleware stack
      config.py                      # pydantic-settings: DB, Redis, MBIE key, security config
      db.py                          # psycopg3 AsyncConnectionPool
      redis.py                       # async Redis client with graceful fallback (cache_get/cache_set/cache_incr)
      dependencies.py                # FastAPI Depends() for db conn, redis
      middleware/
        __init__.py
        security_headers.py          # CSP, HSTS, X-Frame-Options, Referrer-Policy
        bot_detection.py             # UA filtering, scraping pattern detection, honeypot
        rate_limiter.py              # slowapi setup, per-endpoint limits (Redis-backed)
      routers/
        __init__.py
        search.py                    # GET /api/v1/search/address
        property.py                  # GET /api/v1/property/{address_id}/report + /summary
        nearby.py                    # GET /api/v1/nearby/{address_id}/{layer}
        market.py                    # GET /api/v1/property/{address_id}/market + /rent-history
        rates.py                     # GET /api/v1/property/{address_id}/rates (WCC live + cache)
        rent_reports.py              # POST + GET /api/v1/rent-reports
        feedback.py                  # POST /api/v1/feedback
        email_signups.py             # POST /api/v1/email-signups
        admin.py                     # GET/PATCH /api/v1/admin/* (password-protected)
        tiles.py                     # Health/proxy if needed (Martin serves directly)
      schemas/
        __init__.py
        search.py                    # SearchResult, SearchResponse
        property.py                  # PropertyReport, HazardData, PlanningData...
        scores.py                    # CategoryScore, CompositeScore, RatingBin
        market.py                    # RentAssessment, TrendData, MarketHeat
        rates.py                     # WCCRatesData, Levy, Valuation
        nearby.py                    # NearbyFeature, NearbyResponse (GeoJSON)
        rent_reports.py              # RentReport, RentReportCreate, CrowdsourcedData
        feedback.py                  # FeedbackCreate, FeedbackResponse
        admin.py                     # AdminDashboard, AdminFeedbackList
      services/
        __init__.py
        search.py                    # Three-tier search (btree → tsvector → trigram)
        property_report.py           # Calls get_property_report(), assembles response
        risk_score.py                # Normalization, softmax, WAM, composite
        market.py                    # Fair rent, trend, CV adjustment
        rates.py                     # WCC rates API client + DB cache upsert
        rent_reports.py              # Validation, outlier detection, storage
        property_detection.py        # Multi-unit / apartment auto-detection
        abbreviations.py             # NZ address abbreviation expansion
        geo_utils.py                 # to_geojson_feature, to_geojson_polygon_feature, row_to_dict
        ai_summary.py                # Azure OpenAI: property summary generation
        admin_auth.py                # bcrypt verify, session tokens, require_admin dependency
        abuse_logger.py              # Structured logging for rate limits, bot blocks, scraping
    sql/
      05-views.sql                   # Regular views
      06-materialized-views.sql      # Materialized views + area_profiles table
      07-functions.sql               # PL/pgSQL: get_property_report(), get_risk_scores()
      08-toast-optimization.sql      # TOAST EXTERNAL for large geom tables
      09-application-tables.sql      # user_rent_reports, feedback, email_signups, admin_content, wcc_rates_cache
    requirements.txt
    Dockerfile

  docs/
    DATABASE-SCHEMA.md               # 42 tables, all columns/types/indexes, SQL execution order

  scripts/
    generate_area_profiles.py        # Batch: query DB per SA2, call Azure OpenAI, store profiles

  frontend/
    src/
      app/
        layout.tsx                   # Root: Inter font, metadata, providers
        page.tsx                     # Landing: map + search overlay
        property/[id]/
          page.tsx                   # Property report page (SSR metadata for OG)
          loading.tsx                # Skeleton
        help/page.tsx                # Help / FAQ
        about/page.tsx               # About
        privacy/page.tsx             # Privacy Policy
        terms/page.tsx               # Terms of Use
        contact/page.tsx             # Contact
        changelog/page.tsx           # What's New / Changelog
        admin/                       # Admin portal (password-protected)
          layout.tsx                 # Admin shell with tab nav + auth gate
          page.tsx                   # Dashboard overview
          analytics/page.tsx         # Analytics charts
          data-health/page.tsx       # Data pipeline health
          feedback/page.tsx          # Bug reports, feature requests, ratings
          emails/page.tsx            # Out-of-coverage email signups
          content/page.tsx           # Banners, demo addresses, FAQ mgmt
      components/
        map/
          MapContainer.tsx           # MapLibre instance, LINZ basemap, Martin sources
          MapLayerChipBar.tsx        # Horizontal scrolling layer preset chips
          MapLayerPicker.tsx         # Full-screen layer picker modal (mobile)
          MapLegend.tsx              # Floating collapsible legend (active layers only)
          MapPopup.tsx               # Mini-preview popup on parcel tap
          MapControls.tsx            # Zoom +/-, locate me, satellite toggle
          PropertyPin.tsx            # Selected property marker
          layers/                    # One file per vector tile layer config
        property/
          PropertyReport.tsx         # Full report panel wrapper
          PropertySummaryCard.tsx    # Address, bookmark, CV, score gauge, score strip
          AISummaryCard.tsx          # AI-generated property + area summary (4-6 sentences)
          ScoreGauge.tsx             # 240° arc gauge (SVG, animated, 0-100)
          ScoreStrip.tsx             # Horizontal row of 5 category score circles
          ScoreCircle.tsx            # Individual 36px colored score circle
          ScoreContextSignals.tsx    # Percentile, prevalence, trend per indicator
          NearbyAmenitiesCard.tsx    # Walkability grid: cafes, shops, parks (OSM, 500m)
          NearbyAmenitiesList.tsx    # Expanded categorised amenity list
          ConservationCard.tsx       # Nearest DOC reserves/national parks
          IndicatorCard.tsx          # Individual risk indicator card
          CriticalFinding.tsx        # High-score indicator with alert treatment
          KeyTakeaways.tsx           # Post-report summary + CTAs
          RentFairnessCard.tsx       # "Is Your Rent Fair?" headline + verdict
          RentComparisonFlow.tsx     # 3-state container: A (inputs), B (filtered), C (full)
          RentDistributionBar.tsx    # Horizontal LQ-Med-UQ bar with user marker
          PropertyTypeSelector.tsx   # PillToggleGroup: House, Flat, Apartment, Room
          BedroomSelector.tsx        # PillToggleGroup: 1, 2, 3, 4, 5+
          CrossTypeComparison.tsx    # Cross-type rent comparison table
          UserRentContribution.tsx   # "Help others" opt-out checkbox
          CrowdsourcedRentCard.tsx   # Crowd data display (3+ reports threshold)
          RentHistoryChart.tsx       # TimeSeriesChart for SA2 rent trends
          HPITrendChart.tsx          # TimeSeriesChart for national HPI
          CouncilValuationCard.tsx   # KeyValueCard for CV/LV/IV (Wellington)
          DistanceToCard.tsx         # KeyValueCard for CBD + train distances
          RentInput.tsx              # Inline rent entry (in Market section)
          BuildingInfoBanner.tsx     # Multi-unit transparency notice
          UnitComparisonTable.tsx    # Sibling unit valuations table (multi-unit buildings)
          BetaBanner.tsx             # "Full reports free during beta" banner
          PremiumBadge.tsx           # "FREE BETA" / Lock icon on accordion headers
          UpgradeCard.tsx            # Paywall card inside locked sections (post-beta)
          DataSourceBadge.tsx        # "Source: NIWA | Updated: Jan 2026"
          CoverageBadge.tsx          # "15 of 27 layers"
          ReportDisclaimer.tsx       # Inline legal disclaimer at report bottom
          sections/
            RiskHazardsSection.tsx   # Section 1: Flood, tsunami, liquefaction, etc.
            NeighbourhoodSection.tsx  # Section 2: Crime, schools, deprivation, amenities
            MarketSection.tsx        # Section 3: Rent fairness, history, CV, HPI
            RatesSection.tsx         # Section 3b: WCC rates (Wellington only)
            TransportSection.tsx     # Section 4: Transit, crashes, distance to CBD
            PlanningSection.tsx      # Section 5: Zones, height, consents, infra
        search/
          SearchBar.tsx              # Input + debounced autocomplete dropdown
          SearchOverlay.tsx          # Full-screen autocomplete (mobile)
          RecentSearches.tsx         # localStorage recent searches list
          SavedProperties.tsx        # Bookmarked properties list (landing page)
        layout/
          AppHeader.tsx              # Header: logo, nav links, dark mode, help icon
          AppFooter.tsx              # Footer: govt logos, legal links, disclaimer
          SplitView.tsx              # 60/40 map + panel (desktop, >= 1024px)
          MobileDrawer.tsx           # Bottom sheet with 3 snap points (< 640px, Vaul)
          TabletPanel.tsx            # Push-style side panel (640-1023px, 320px)
          AnnouncementBanner.tsx     # Top-of-page info/warning/success banner
          StaticPageLayout.tsx       # Shared wrapper for /help, /about, /privacy, /terms, /contact, /changelog
        feedback/
          FeedbackFAB.tsx            # Floating action button (bottom-right)
          FeedbackDrawer.tsx         # Sheet with bug/feature/general forms
          BugReportForm.tsx          # Bug report form fields
          FeatureRequestForm.tsx     # Feature request form fields
          GeneralFeedbackForm.tsx    # Satisfaction rating + comment
        error/
          NetworkError.tsx           # ErrorState variant: WifiOff icon, full-page
          TimeoutError.tsx           # ErrorState variant: Clock icon, full-page
          SectionError.tsx           # ErrorState variant: AlertTriangle icon, inline + retry
          NotFoundError.tsx          # ErrorState variant: SearchX icon, address not found
          OutOfCoverage.tsx          # ErrorState variant + email capture form
          RateLimitError.tsx         # ErrorState variant: Clock icon, rate limiting
          StaleCacheBanner.tsx       # AnnouncementBanner variant: "Data may be outdated"
        empty/
          NoRecentSearches.tsx       # EmptyState variant: Search icon, first-time user
          NoRiskDetected.tsx         # EmptyState variant: CheckCircle2, success
          DataNotAvailable.tsx       # EmptyState variant: HelpCircle, neutral, dashed
        common/
          PillToggleGroup.tsx        # Reusable pill toggle row (Toggle + rounded-full)
          KeyValueCard.tsx           # Reusable key-value card (Card + dl/dt/dd)
          TimeSeriesChart.tsx        # Reusable Recharts wrapper with CHART_THEME
          EmptyState.tsx             # Reusable empty/clear state (icon + title + description)
          ErrorState.tsx             # Reusable error state (icon + title + onRetry)
          LoadingSkeleton.tsx        # Generic shimmer skeleton shapes
          ReportSkeleton.tsx         # Full report loading skeleton
          AnalyticsConsent.tsx       # Cookie/analytics consent banner
        admin/
          AdminAuthGate.tsx          # Password entry + session cookie management
          DashboardOverview.tsx      # Key metrics, charts, recent errors
          AnalyticsPanel.tsx         # Search volume, engagement charts
          DataHealthPanel.tsx        # Service status, dataset freshness
          FeedbackPanel.tsx          # Bug/feature/general feedback list + status mgmt
          EmailSignupsPanel.tsx      # Out-of-coverage email list + CSV export
          ContentPanel.tsx           # Banner, demo addresses, FAQ management
        ui/                          # shadcn/ui components (generated via npx shadcn@latest add)
      hooks/
        usePropertyReport.ts         # TanStack Query → /api/v1/property/{id}/report
        usePropertySummary.ts        # TanStack Query → /api/v1/property/{id}/summary (map-tap)
        useNearby.ts                 # TanStack Query → /api/v1/nearby/{id}/{layer}
        useSearch.ts                 # Debounced search with abort controller
        useMarket.ts                 # TanStack Query → /api/v1/property/{id}/market
        useRates.ts                  # TanStack Query → /api/v1/property/{id}/rates
        useRentHistory.ts            # TanStack Query → /api/v1/property/{id}/rent-history
        useHPITrend.ts               # TanStack Query → /api/v1/market/hpi
        useRentReports.ts            # TanStack Query + mutation for rent reports
        usePropertyDetection.ts      # Auto-detect apartment/flat from address signals
        useRecentSearches.ts         # localStorage read/write for recent searches
        useSavedProperties.ts        # localStorage bookmarked properties (max 20)
        useLayerVisibility.ts        # Which map layers are toggled on
        useFirstUseHints.ts          # localStorage-tracked onboarding hints
        useAdminAuth.ts              # Admin session check + login mutation
        useAdminDashboard.ts         # TanStack Query → /api/v1/admin/dashboard
        useAdminAnalytics.ts         # TanStack Query → /api/v1/admin/analytics
        useAdminDataHealth.ts        # TanStack Query → /api/v1/admin/data-health
        useAdminFeedback.ts          # TanStack Query → /api/v1/admin/feedback + PATCH mutations
        useAdminEmails.ts            # TanStack Query → /api/v1/admin/emails
        useAdminContent.ts           # TanStack Query → /api/v1/admin/content + PUT mutations
        useFeedback.ts               # Submit feedback API mutation
        useEmailSignup.ts            # POST /api/v1/email-signups mutation (OutOfCoverage)
        useMobileBackButton.ts       # History state for bottom sheet back button
      stores/
        mapStore.ts                  # Zustand: viewport, layers, selectedPropertyId
        searchStore.ts               # Zustand: search query, selected address
      lib/
        api.ts                       # fetch wrapper, base URL, error handling
        constants.ts                 # Colors, rating bins, layer config
        types.ts                     # Shared TypeScript types (mirrors backend schemas)
        format.ts                    # Number/date/score formatting utilities
        animations.ts                # Animation timing constants + easing curves
        mapStyles.ts                 # Risk pattern fills for MapLibre (color + texture)
        storage.ts                   # Safe localStorage read/write with validation
    tailwind.config.ts
    next.config.ts
    package.json
    Dockerfile

  docker-compose.yml                 # postgres, martin, api, redis, web, nginx
  docker-compose.dev.yml             # Dev overrides (hot reload, no nginx)
  .env                               # DB creds, MBIE key, LINZ key
  nginx/
    nginx.conf                       # Reverse proxy routing
```

---

## Phase 6: Polish & Deploy

### 6A. Pre-loaded Demo

Landing page auto-loads 162 Cuba Street with full report visible. Shows "aha moment" within 5 seconds.

### 6B. Docker Compose

```yaml
services:
  postgres:
    image: postgis/postgis:18-3.6
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  martin:
    image: ghcr.io/maplibre/martin:v1.3.1
    command: --config /config/martin.yaml
    depends_on: [postgres]

  redis:
    image: redis:7-alpine

  api:
    build: ./backend
    depends_on: [postgres, redis]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      retries: 3

  web:
    build: ./frontend
    depends_on:
      api:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [api, web, martin]
```

### 6C. Static Pages

Build simple static/informational pages linked from the footer and help menu:

| Page | Route | Content |
|------|-------|---------|
| Help / FAQ | `/help` | Accordion FAQ, search tips, data source explanations, "How scores work" |
| About | `/about` | Project story, data sources list with links, open data attribution |
| Privacy | `/privacy` | Cookie policy, analytics consent, IP hashing explanation, no-tracking pledge |
| Terms | `/terms` | Disclaimer (not financial advice), data accuracy caveats, usage limits |
| Contact | `/contact` | Feedback form embed + email link |
| Changelog | `/changelog` | Version history, new features, data refresh dates |

All pages use a shared `StaticPageLayout` wrapper (max-width prose container, back-to-map link). Content can be hardcoded TSX or loaded from markdown files.

### 6D. Deploy to Vultr Sydney

- Provision 4 vCPU / 8GB RAM VPS
- Install Docker
- Copy docker-compose.yml + .env
- Restore pg_dump
- Set up Cloudflare DNS + CDN
- SSL via Certbot
- Configure Cloudflare WAF (see `BACKEND-PLAN.md` §Security — Cloudflare WAF section)

### 6E. Accessibility (WCAG 2.2 AA)

| Area | Requirements |
|------|-------------|
| Screen readers | Map: `role="application"` + `aria-label`. `aria-live="polite"` for search results count, layer toggles, score updates. Proper heading hierarchy (H1→H2→H3). Score gauge: `aria-label="Risk score: 42 out of 100, Low Risk"` |
| Keyboard | Tab order: Skip nav → Search → Map → Layers → Report → Accordions → CTAs. Enter = open, Escape = close. All interactive elements: visible focus rings (`ring-2 ring-primary ring-offset-2`). Layer chips: arrow key navigation, Space/Enter toggle |
| Color | Okabe-Ito palette for map overlays. Pattern + texture on polygons (never color alone). Text contrast ≥4.5:1, graphics ≥3:1. All score labels include text ("Low Risk") |
| Reduced motion | `prefers-reduced-motion: reduce`: `flyTo`→`jumpTo`, CSS animations disabled, score gauge shows final state immediately, bottom sheet snaps without transition |
| Zoom/reflow | Report panel reflows at 200% and 400% zoom (relative units). Map canvas exempt per WCAG 1.4.10 |

---

## What to Build First (Next Session)

**Start with Phase 1 + 2A-2C**: Crime meshblock fix → TOAST → views → mat views → area_profiles table → PL/pgSQL function → FastAPI skeleton + .env + health → search + report endpoint.

**AI features (Phase 2G)** can run in parallel: set up Azure OpenAI resource, run `generate_area_profiles.py` for Wellington SA2s while building Phases 1-2. The AI summary endpoint plugs into the report endpoint once it exists.

**WCC rates (Phase 2H)** can also be built independently — it's a separate endpoint with its own service. The `wcc_rates_cache` table should be created in Phase 1D alongside area_profiles. A bulk pre-population script (`scripts/populate_wcc_rates.py`) can seed the cache for all Wellington addresses before the API is built.

This gives you a working API you can test with `curl` before touching any frontend code. The PL/pgSQL function is the critical path — everything else wraps it.

```bash
# After Phase 1+2, test with:
curl "http://localhost:8000/health"
curl "http://localhost:8000/api/v1/search/address?q=162+Cuba"
curl "http://localhost:8000/api/v1/property/1753062/report"
curl "http://localhost:8000/api/v1/nearby/1753062/schools?radius=1500"
curl "http://localhost:8000/api/v1/property/1753062/market"
curl "http://localhost:8000/api/v1/property/1753062/rates"

# AI summary is included in the report response:
# response.ai_summary = "Mt Victoria is a hilly, characterful..."
# response.area_profile = "Pre-generated suburb description..."
```

## Key Document References

When implementing each phase, consult these files:

| Phase | Key References |
|-------|---------------|
| **All phases** | `docs/DATABASE-SCHEMA.md` (42 tables, all columns/types/indexes, SQL execution order) |
| Phase 1 (DB) | `BACKEND-PLAN.md` §Phase 1. Also: `RISK-SCORE-METHODOLOGY.md`, `FAIR-PRICE-ENGINE.md` §11, `PROGRESS.md` Known Issues |
| Phase 2 (API) | `BACKEND-PLAN.md` §Phase 2. Also: `SEARCH-GEOCODING-RESEARCH.md`, `FAIR-PRICE-ENGINE.md` §10-12, `RISK-SCORE-METHODOLOGY.md` §4-8 |
| Phase 2 (Security) | `BACKEND-PLAN.md` §Security & Hardening (middleware stack, per-endpoint rate limits, bot detection, OWASP Top 10, Cloudflare WAF) |
| Phase 3-5 (Frontend) | `FRONTEND-PLAN.md`. Also: `ux-design-specification.md`, `MOBILE-UX-RESEARCH.md`, `SEARCH-GEOCODING-RESEARCH.md` §Frontend |
| Phase 6 (Deploy) | This file §Phase 6. `PROGRESS.md` session 16 (Vultr Sydney, Docker Compose, Cloudflare CDN, $48/mo) |

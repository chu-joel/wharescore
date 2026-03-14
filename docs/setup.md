# WhareScore — Architecture & UX Design Plan

_Last Updated:_ 2026-03-08
_Status:_ Research complete, awaiting implementation

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [System Architecture](#system-architecture)
3. [Database Layer](#database-layer)
4. [API Design](#api-design)
5. [Frontend Architecture](#frontend-architecture)
6. [Visual Design Language](#visual-design-language)
7. [Screens & Components](#screens--components)
8. [Risk Score Visualization](#risk-score-visualization)
9. [Map Design](#map-design)
10. [Mobile UX](#mobile-ux)
11. [First-Use Experience](#first-use-experience)
12. [Data Coverage Gaps](#data-coverage-gaps)
13. [Trust & Credibility](#trust--credibility)
14. [Feedback System](#feedback-system)
15. [Sharing & Export](#sharing--export)
16. [Accessibility](#accessibility)
17. [Performance Targets](#performance-targets)
18. [Animation & Micro-interactions](#animation--micro-interactions)
19. [Implementation Priority](#implementation-priority)

---

## Tech Stack

| Layer                | Technology                        | Why                                                                         |
| -------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| _Database_           | PostgreSQL 18.2 + PostGIS 3.6.1   | Already loaded with 35 tables, 18.5M records                                |
| _Vector tiles_       | _Martin_ (Rust, by MapLibre)      | Fastest PostGIS tile server, benchmarked ahead of pg_tileserv and Tegola    |
| _API_                | _FastAPI_ + async psycopg3        | Native async, Pydantic validation, auto-docs, best Python spatial ecosystem |
| _Cache_              | _Redis_                           | Property reports cached 24h, nearby queries 1h                              |
| _Frontend framework_ | _Next.js 15_ (App Router)         | React Server Components, API routes, ISR for static pages                   |
| _Map_                | _MapLibre GL JS v4+_              | Free (BSD-3), WebGL2, native vector tiles, zero licensing risk              |
| _React map wrapper_  | _react-map-gl v8_ (MapLibre mode) | Mature, lightweight, vis.gl ecosystem                                       |
| _Advanced viz_       | _deck.gl_ (when needed)           | Heatmaps, large point clouds, 3D extrusions                                 |
| _Charts/gauges_      | _Recharts_ or _Nivo_              | D3-powered, React-native                                                    |
| _State: UI/map_      | _Zustand_                         | Lightweight, intuitive for map viewport + layer toggles                     |
| _State: server data_ | _TanStack Query v5_               | Caching, stale-while-revalidate, spatial query keys                         |
| _UI components_      | _Tailwind CSS + shadcn/ui_        | Rapid dev, accessible primitives, zero runtime cost                         |
| _Basemap_            | _LINZ Basemaps_ (topolite-v2)     | Free, authoritative NZ data, MapLibre-native, CC BY 4.0                     |
| _Aerial imagery_     | _LINZ Aerial_                     | Free, 5cm urban resolution, NZ-complete                                     |
| _Bottom sheet_       | _Vaul_ or _react-modal-sheet_     | Framer Motion-based, snap points, gesture handling                          |

---

## System Architecture

              React (Next.js 15) + MapLibre GL JS
                   /                         \
        Vector Tiles                    REST API
        (map overlays)              (property data)
              |                           |
        [CDN / nginx]              [nginx / Cloudflare]
              |                           |
        Martin (Rust)              FastAPI (Python)
        port 3000                  port 8000
              |                           |
              |                    Redis Cache
              |                           |
              +----------+    +-----------+
                         |    |
                   PostgreSQL + PostGIS
                   +-- 35 tables (~18.5M rows)
                   +-- GIST spatial indexes on all geom columns
                   +-- Regular views (reusable spatial joins)
                   +-- Materialized views (pre-computed scores)
                   +-- PL/pgSQL functions (composite reports)
                   +-- pg_cron (scheduled mat view refreshes)

### Data Flow

1. _Map overlays_: MapLibre requests vector tiles from Martin, which queries PostGIS on-the-fly via ST_AsMVT(). Tiles cached at CDN (24h TTL for static layers like zones).
2. _Property reports_: React calls FastAPI endpoints, which call PL/pgSQL functions or query materialized views. Results cached in Redis (24h for reports, 1h for nearby queries).
3. _Search/autocomplete_: FastAPI queries the addresses table (2.4M rows) with trigram index for fuzzy matching.

---

## Database Layer

### Three Tools for Three Jobs

#### 1. Regular Views — Reusable Spatial Joins (Always Fresh)

Use LATERAL JOIN pattern to avoid cartesian products. Each subquery uses its own GIST index.

CREATE VIEW v_location_hazards AS
SELECT a.address_id, a.geom,
fz.flood_category, lz.liquefaction_susceptibility,
tz.tsunami_zone_category, wz.wind_zone
FROM addresses a
LEFT JOIN LATERAL (
SELECT flood_zone_category AS flood_category
FROM flood_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) fz ON true
LEFT JOIN LATERAL (
SELECT liquefaction_susceptibility
FROM liquefaction_zones WHERE ST_Intersects(geom, a.geom) LIMIT 1
) lz ON true
-- ... etc for each hazard layer

#### 2. Materialized Views — Pre-computed Scores (Refresh Weekly)

CREATE MATERIALIZED VIEW mv_meshblock_scores AS
SELECT
mb.meshblock_id, mb.geom, nd.nzdep_decile,
COALESCE(crime_stats.crime_count, 0) AS crime_count_3yr,
COALESCE(crime_stats.crime_count / NULLIF(ST_Area(mb.geom::geography)/1e6, 0), 0)
AS crime_density_per_km2,
COALESCE(transit_stats.stop_count, 0) AS transit_stops_nearby,
COALESCE(school_stats.school_count, 0) AS nearby_schools
FROM meshblocks mb
LEFT JOIN nzdep nd ON mb.meshblock_id = nd.meshblock_id
LEFT JOIN LATERAL (...) crime_stats ON true
LEFT JOIN LATERAL (...) transit_stats ON true
LEFT JOIN LATERAL (...) school_stats ON true;

CREATE UNIQUE INDEX idx_mv_meshblock_scores_id ON mv_meshblock_scores(meshblock_id);
CREATE INDEX idx_mv_meshblock_scores_geom ON mv_meshblock_scores USING GIST(geom);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_meshblock_scores; (via pg_cron weekly)

_Performance_: Complex spatial join ~4s live -> ~30ms from materialized view.

#### 3. PL/pgSQL Function — Composite Property Report (~20-50ms)

Single function call, single round-trip, returns the full report. Each ST_Intersects against a GIST index is sub-millisecond.

CREATE FUNCTION get_property_report(p_address_id BIGINT) RETURNS TABLE(...)
LANGUAGE plpgsql STABLE AS $$
-- Step 1: Get address geometry
-- Step 2: Core property info (parcel, title, building) via LATERAL joins
-- Step 3: Hazard overlays (flood, tsunami, liquefaction, wind, coastal, wildfire)
-- Step 4: Planning (zone, height, contamination, EPB, heritage)
-- Step 5: Pre-computed scores from mv_meshblock_scores
-- Step 6: Rental market from mv_rental_market

$$
;

*Why not one giant view*: A view joining 35 tables would choke the planner. The function executes each lookup independently.

### Database Optimization

- *TOAST storage*: Set to EXTERNAL for parcels, building_outlines, flood_zones (5x spatial join speedup per Paul Ramsey's research)
- *Connection pooling*: psycopg3 AsyncConnectionPool (min 5, max 20), add PgBouncer at scale
- *Bounding box pre-filter*: Always use && + ST_Expand() before ST_DWithin on large tables
- *Statistics*: ALTER TABLE addresses ALTER COLUMN geom SET STATISTICS 1000; ANALYZE;

### Application Tables (Not Spatial Data)

These tables support app features beyond the core spatial data pipeline.

-- User-contributed anonymous rent reports (crowdsourced per-building data)
CREATE TABLE user_rent_reports (
  id SERIAL PRIMARY KEY,
  address_id BIGINT NOT NULL REFERENCES addresses(address_id),
  building_address TEXT,              -- base street address (e.g. "30 Taranaki Street")
  sa2_code VARCHAR(10),               -- for area-level fallback
  dwelling_type VARCHAR(20) NOT NULL, -- House, Flat, Apartment, Room
  bedrooms VARCHAR(5) NOT NULL,       -- 1, 2, 3, 4, 5+
  reported_rent INTEGER NOT NULL,     -- $/week
  is_outlier BOOLEAN DEFAULT FALSE,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash VARCHAR(64),                -- SHA-256 of IP, for rate limiting only
  source VARCHAR(20) DEFAULT 'web'
);
CREATE INDEX idx_rent_reports_address ON user_rent_reports(address_id);
CREATE INDEX idx_rent_reports_building ON user_rent_reports(building_address);
CREATE INDEX idx_rent_reports_sa2 ON user_rent_reports(sa2_code);

-- Bug reports, feature requests, and general feedback
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL,          -- bug, feature, general
  description TEXT NOT NULL,
  context TEXT,
  page_url TEXT,
  property_address TEXT,
  importance VARCHAR(20),
  satisfaction INTEGER,               -- 1-5 for general feedback
  email VARCHAR(255),
  browser_info JSONB,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'new'    -- new, reviewed, resolved, wontfix
);

-- Out-of-coverage email signups
CREATE TABLE email_signups (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  requested_region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

---

## API Design

### Modular Domain-Grouped Endpoints

# Property report (PL/pgSQL function -- fast summary)
GET /api/v1/property/{address_id}/report

# Map-tap lightweight summary (no full report load)
GET /api/v1/property/{address_id}/summary

# Lazy-loaded detail sections (5 sections, matches UX spec accordion)
GET /api/v1/property/{address_id}/hazards          # Risk & Hazards
GET /api/v1/property/{address_id}/neighbourhood     # Neighbourhood & Liveability
GET /api/v1/property/{address_id}/market            # Market & Rental
GET /api/v1/property/{address_id}/transport         # Transport & Access
GET /api/v1/property/{address_id}/planning          # Planning & Development

# Proximity queries (return GeoJSON FeatureCollections)
GET /api/v1/nearby/{address_id}/schools?radius=2000
GET /api/v1/nearby/{address_id}/crashes?radius=500&years=5
GET /api/v1/nearby/{address_id}/crime?radius=500&years=3
GET /api/v1/nearby/{address_id}/transit?radius=1000
GET /api/v1/nearby/{address_id}/consents?radius=500
GET /api/v1/nearby/{address_id}/amenities?radius=500  # OSM amenities

# Search / geocoding
GET /api/v1/search/address?q=123+Cuba+St

# Rent market data
GET /api/v1/market/{sa2_code}/rent-overview          # Area overview (all types)
GET /api/v1/market/{sa2_code}/rent-filtered?type=Apartment&beds=2  # Filtered by type+beds
GET /api/v1/market/hpi                                # National HPI trend (RBNZ)

# User-contributed rent reports
POST /api/v1/rent-reports                             # Submit anonymous rent report
GET  /api/v1/rent-reports/{building_address}          # Get crowd data for a building (3+ threshold)

# Feedback
POST /api/v1/feedback                                 # Bug report, feature request, general feedback

# Admin (password-protected)
GET  /api/v1/admin/dashboard                          # Key metrics overview
GET  /api/v1/admin/analytics                          # Search volume, engagement
GET  /api/v1/admin/data-health                        # Dataset freshness, service status
GET  /api/v1/admin/feedback?type=bug&status=new       # Feedback list (filterable)
PATCH /api/v1/admin/feedback/{id}                     # Update feedback status
GET  /api/v1/admin/emails                             # Out-of-coverage email signups
GET  /api/v1/admin/content                            # Banners, demo addresses, FAQ
PUT  /api/v1/admin/content/{key}                      # Update content item

# Vector tiles (direct from Martin, not through FastAPI)
GET /tiles/{layer}/{z}/{x}/{y}.pbf

### Vector Tiles vs GeoJSON

| Vector Tiles (Martin) | GeoJSON (FastAPI) |
|---|---|
| Parcels (4.3M polygons) | Nearby schools (20 points) |
| Building outlines (3.2M) | Nearby crashes (filtered) |
| Flood/tsunami/liquefaction zones | Search results |
| District plan zones, school zones | Property report data |
| Noise contours, height controls | Resource consents nearby |
| Transmission lines | Infrastructure projects nearby |

*Rule*: Map display layer = vector tiles. Query response with rich attributes = GeoJSON.

### Caching Strategy

| Tier | Tool | TTL | What |
|------|------|-----|------|
| API response | Redis | 24h reports, 1h nearby | Full JSON responses keyed by address_id + params |
| HTTP | Cache-Control headers | 5min nearby, 1h reports | Browser / TanStack Query respects these |
| CDN/Edge | nginx proxy_cache | 24h tiles | Vector tiles from Martin |

---

## Frontend Architecture

### Component Tree

    **Canonical source**: See UX Design Specification (`ux-design-specification.md`) Appendix: Component File Map for the full component inventory with inline design notes. This is a summary.



src/
  app/                                 # Next.js App Router
    page.tsx                           # Landing / search
    property/[id]/page.tsx             # Property report (+ out-of-coverage variant)
    help/page.tsx                      # Help / FAQ
    methodology/page.tsx               # Methodology & data sources
    coverage/page.tsx                  # Coverage map
    about/page.tsx                     # About
    privacy/page.tsx                   # Privacy policy
    terms/page.tsx                     # Terms of use
    contact/page.tsx                   # Contact
    changelog/page.tsx                 # What's new / changelog
    admin/                             # Admin portal (password-protected)
      layout.tsx                       # Admin shell + tab nav + auth gate
      page.tsx                         # Dashboard overview
      analytics/page.tsx               # Analytics charts
      data-health/page.tsx             # Data pipeline health
      feedback/page.tsx                # Bug reports, feature requests, ratings
      emails/page.tsx                  # Out-of-coverage email signups
      content/page.tsx                 # Banners, demo addresses, FAQ mgmt
  components/
    ui/                                # shadcn/ui primitives
      accordion.tsx, badge.tsx, button.tsx, card.tsx, dialog.tsx,
      input.tsx, select.tsx, separator.tsx, sheet.tsx, skeleton.tsx,
      toggle.tsx, tooltip.tsx
    layout/
      AppHeader.tsx                    # Header: logo, nav, dark mode, help
      AppFooter.tsx                    # Footer: govt logos, legal, disclaimer
      SplitView.tsx                    # Desktop: map 60% + report 40%
      MobileDrawer.tsx                 # Mobile: bottom sheet (3 snap points, Vaul)
      TabletPanel.tsx                  # Tablet: push-style side panel (320px)
      AnnouncementBanner.tsx           # Top-of-page info/warning/success banner
    map/
      MapContainer.tsx                 # MapLibre instance + LINZ basemap
      MapLayerChipBar.tsx              # Horizontal scrolling layer preset chips
      MapLayerPicker.tsx               # Full-screen layer picker modal (mobile)
      MapLegend.tsx                    # Floating collapsible legend (active layers only)
      MapPopup.tsx                     # Mini-preview popup on parcel tap
      MapControls.tsx                  # Zoom +/-, locate me, satellite toggle
      layers/                          # One file per vector tile layer config
    search/
      SearchBar.tsx                    # Address autocomplete input
      SearchOverlay.tsx                # Full-screen autocomplete (mobile)
      RecentSearches.tsx               # localStorage recent searches list
      SavedProperties.tsx              # Bookmarked properties list
    property/
      PropertyReport.tsx               # Full report container (all sections)
      PropertySummaryCard.tsx          # Address, score gauge, score strip, metadata
      ScoreGauge.tsx                   # 240-degree SVG arc gauge (0-100)
      ScoreStrip.tsx                   # Horizontal row of category score circles
      ScoreCircle.tsx                  # Individual 36px colored score circle
      ScoreContextSignals.tsx          # Percentile, prevalence, trend display
      AISummaryCard.tsx                # AI-generated property + area summary
      NearbyAmenitiesCard.tsx          # Walkability grid (OSM data)
      IndicatorCard.tsx                # Individual risk indicator card
      CriticalFinding.tsx              # High-score indicator with alert treatment
      KeyTakeaways.tsx                 # Post-report summary + CTAs
      BuildingInfoBanner.tsx           # Multi-unit transparency notice
      # Premium tier
      BetaBanner.tsx                   # "Free during beta" banner with launch date
      PremiumBadge.tsx                 # "FREE BETA" / Lock icon on accordion headers
      UpgradeCard.tsx                  # Paywall card inside locked sections (post-beta)
      # Market components
      RentFairnessCard.tsx             # "Is Your Rent Fair?" headline + verdict
      RentComparisonFlow.tsx           # 3-state container (A: inputs, B: filtered, C: full)
      RentDistributionBar.tsx          # Horizontal LQ-Med-UQ bar with user marker
      PropertyTypeSelector.tsx         # Pill toggles: House, Flat, Apartment, Room
      BedroomSelector.tsx              # Pill toggles: 1, 2, 3, 4, 5+
      CrossTypeComparison.tsx          # Cross-type rent comparison table
      UserRentContribution.tsx         # Anonymous sharing opt-out checkbox
      CrowdsourcedRentCard.tsx         # Crowd data display (3+ reports threshold)
      RentHistoryChart.tsx             # SA2-level rent trend chart (Recharts)
      HPITrendChart.tsx                # National HPI chart (Recharts)
      CouncilValuationCard.tsx         # CV/LV/IV display (Wellington only)
      DistanceToCard.tsx               # Distance to CBD + nearest train station
      RentInput.tsx                    # Inline rent entry ($ /week input)
      ReportDisclaimer.tsx             # Inline legal disclaimer
      sections/                        # 5 accordion sections (NOT 7)
        RiskHazardsSection.tsx         # Section 1: Risk & Hazards
        NeighbourhoodSection.tsx       # Section 2: Neighbourhood & Liveability
        MarketSection.tsx              # Section 3: Market & Rental
        TransportSection.tsx           # Section 4: Transport & Access
        PlanningSection.tsx            # Section 5: Planning & Development
    feedback/
      FeedbackWidget.tsx               # Rotating thumbs up/down per section
      FeedbackFAB.tsx                  # Floating action button (bottom-right)
      FeedbackDrawer.tsx               # Sheet with bug/feature/general forms
      BugReportForm.tsx                # Bug report form fields
      FeatureRequestForm.tsx           # Feature request form fields
      GeneralFeedbackForm.tsx          # Satisfaction rating + comment
    error/
      NetworkError.tsx                 # Full-page network failure
      TimeoutError.tsx                 # API timeout state
      SectionError.tsx                 # Inline section load failure + retry
      NotFoundError.tsx                # Address not found
      OutOfCoverage.tsx                # Out-of-coverage with email capture
      RateLimitError.tsx               # Rate limiting state
      StaleCacheBanner.tsx             # "Data may be outdated" banner
    empty/
      NoRecentSearches.tsx             # First-time user, no history
      NoRiskDetected.tsx               # Checked, all clear
      DataNotAvailable.tsx             # Layer not available for area
    common/
      DataSourceBadge.tsx              # Per-section source attribution
      CoverageBadge.tsx                # "Full / Standard / Basic" per region
      LoadingSkeleton.tsx              # Generic shimmer skeleton shapes
      ReportSkeleton.tsx               # Full report loading skeleton
      AnalyticsConsent.tsx             # Cookie/analytics consent banner
    admin/
      AdminAuthGate.tsx                # Password entry + session management
      DashboardOverview.tsx            # Key metrics, charts, recent errors
      AnalyticsPanel.tsx               # Search volume, engagement charts
      DataHealthPanel.tsx              # Service status, dataset freshness
      FeedbackPanel.tsx                # Bug/feature/general feedback list
      EmailSignupsPanel.tsx            # Out-of-coverage email list + export
      ContentPanel.tsx                 # Banner, demo addresses, FAQ management
  hooks/
    usePropertyReport.ts               # TanStack Query for /report
    usePropertySummary.ts              # TanStack Query for /summary (map-tap)
    useNearbyQuery.ts                  # TanStack Query for /nearby/*
    useRentHistory.ts                  # TanStack Query for /rent-history
    useHPITrend.ts                     # TanStack Query for /market/hpi
    useRentReports.ts                  # TanStack Query + mutation for rent reports
    usePropertyDetection.ts            # Auto-detect apartment/flat from address signals
    useMapViewport.ts                  # Debounced viewport state (300ms)
    useLayerVisibility.ts              # Which layers are toggled on
    useRecentSearches.ts               # localStorage read/write for recent searches
    useSavedProperties.ts              # localStorage bookmarked properties (max 20)
    useFirstUseHints.ts                # localStorage-tracked onboarding hints
    useAdminAuth.ts                    # Admin session cookie check
    useFeedback.ts                     # Submit feedback API mutation
  stores/
    mapStore.ts                        # Zustand: viewport, layers, selectedProperty
    searchStore.ts                     # Zustand: search query, selected address
  api/
    properties.ts                      # API client: /report, /summary, /sections
    search.ts                          # API client: /search/address
    nearby.ts                          # API client: /nearby/*
    market.ts                          # API client: /rent-history, /market/hpi
    rentReports.ts                     # API client: POST /rent-reports, GET /rent-reports
    feedback.ts                        # API client: POST /feedback
    admin.ts                           # API client: admin endpoints

### State Management

| Category | Tool | What |
|----------|------|------|
| Map/UI state | Zustand | Viewport, visible layers, selected property, interaction mode |
| Server data | TanStack Query v5 | All API data, automatic caching, stale-while-revalidate |
| Fine-grained derived | Jotai (optional, if needed) | Complex cross-source derived scores |

---

## Visual Design Language

### Color Palette: "Ocean Intelligence" — Teal + Copper

| Role | Hex | Usage |
|------|-----|-------|
| Primary Dark | #0A4D4D | Headers, navigation, primary actions |
| Primary | #0D7377 | Buttons, links, active states |
| Primary Light | #B2DFDB | Card backgrounds, light fills |
| Surface Light | #F5F7F8 | Page background (light mode) |
| Surface Dark | #1A1E2E | Page background (dark mode — not pure black) |
| Surface Elevated | #242838 | Card background (dark mode) |
| Accent Warm | #D4863B | Attention markers, CTA emphasis |
| Accent Hot | #E85D4A | Critical risk, urgent states |
| Text Primary | #111827 | Body text (light mode) |
| Text Secondary | #6B7280 | Labels, captions |
| Text on Dark | #E5E7EB | Body text (dark mode) |
| Success | #059669 | Positive indicators |

*Why teal*: Differentiates from banking apps (navy), Zillow (blue #006AFF), Domain (purple). Evokes the Pacific, distinctive for NZ. Teal + copper = "intelligence meets nature."

### Typography: Inter (Variable Font)

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page Title | 28px | 700 Bold | 1.2 |
| Section Header | 20px | 600 SemiBold | 1.3 |
| Card Title | 16px | 600 SemiBold | 1.4 |
| Body Text | 14px | 400 Regular | 1.5 |
| Table Data | 13px | 400 Regular | 1.4 |
| Small Label | 12px | 500 Medium | 1.4 |
| Score Display | 48-64px | 700 Bold | 1.0 |

All numerical displays: font-variant-numeric: tabular-nums

*Fallback*: Source Sans 3 (superior Windows hinting) or IBM Plex Sans (enterprise feel).

### Spacing System (4px base grid)

space-1 4px | space-2 8px | space-3 12px | space-4 16px | space-6 24px | space-8 32px | space-10 40px

### Card & Component Design

| Component | Border Radius |
|-----------|---------------|
| Chips/tags | 6px |
| Buttons, inputs | 8px |
| Cards | 12px |
| Panels, modals, bottom sheet | 16px |
| Pill/toggle buttons | 9999px |

*Card shadow (light)*: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)
*Card shadow (dark)*: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)

### Glass Effect (ONLY for panels floating over map)

.glass-panel {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 16px;
}

Use glass for: map overlay panels, tooltips, floating action bars.
Stay flat/opaque for: data tables, score displays, forms, navigation.

---

## Screens & Components

### Screen 1: Landing / Search

+----------------------------------------------------------+
|  [Logo] WhareScore                      [Dark Mode] [?]  |
|                                                           |
|  "Everything the listing doesn't tell you"                |
|                                                           |
|  [  Type any NZ address...                    ] [Search]  |
|                                                           |
|  Try: 162 Cuba Street, Wellington                         |
|       15 Queen Street, Auckland                           |
|                                                           |
|  =================== LIVE MAP ==========================  |
|  =   Wellington pre-loaded with sample risk layers     =  |
|  =   showing flood zones, school catchments, transit   =  |
|  ========================================================  |
|                                                           |
|  Built from 12+ NZ government data sources                |
|  [LINZ] [Stats NZ] [MBIE] [NIWA] [data.govt.nz]         |
+----------------------------------------------------------+

- Landing page IS the map (with thin marketing overlay)
- Pre-loaded demo property shows "aha moment" in <5 seconds
- No login required
- Government source logos for instant credibility

### Screen 2: Map + Property Report (Core Experience)

*Desktop (60/40 split)*:

+------------------------------------+-------------------------+
|                                    | 162 Cuba St, Te Aro     |
|        MapLibre GL JS              | Wellington 6011         |
|                                    |                         |
|  [Hazards] [Schools] [Transport]   |     ___________         |
|  [Crime] [Zoning] [More...]        |    /   42/100  \        |
|                                    |   / LOW RISK    \       |
|       [selected property pin]      |   \_____________/       |
|                                    |                         |
|  [Satellite toggle]               | [Flood] [Quake] [Zone]  |
|  [Zoom +/-]                        |  -20-    -35-    -55-   |
|                                    |                         |
|                                    | > Risk & Hazards     G  |
|                                    | > Neighbourhood      G  |
|                                    | > Market & Rental    Y  |
|                                    | > Transport & Access G  |
|                                    | > Planning & Dev     Y  |
|                                    |                         |
|                                    | [Share] [PDF] [Compare] |
+------------------------------------+-------------------------+

### Report Panel — Progressive Disclosure (2 Levels Max)

*Level 1: Summary card* (always visible):
- Address, land area, zone, title type
- *Score gauge*: 240-degree arc, 0-100 composite risk
- *Score strip*: 5-7 colored circles for category sub-scores
- *AI summary*: 4-6 sentence natural language summary blending area profile (terrain, character, vibe) with property-specific data insights (key risks, market position, practical takeaway). Light teal background, sparkle icon. Generated by Azure OpenAI GPT-4o-mini per request, cached 24h. Gracefully hidden if unavailable.
- Coverage badge ("Full Coverage: 35 layers")

*Level 2: Accordion sections* (5 sections — see UX spec for full wireframes):

| Section | Header Preview (collapsed) | Contents |
|---------|---------------------------|----------|
| Risk & Hazards | "G No significant risks" or "R 2 of 5 risks" | Flood, tsunami, liquefaction, earthquake, coastal, wildfire, wind, noise, solar, climate |
| Neighbourhood & Liveability | "G Deprivation 6, crime below avg" | NZDep, crime density, demographics, schools, amenities |
| Market & Rental | "Y Median rent $620/wk, +8% YoY" | 3-state rent comparison flow, council valuation, rent history, HPI, crowdsourced data |
| Transport & Access | "G 17 transit stops within 400m" | Stops, crash hotspots, distance to CBD/stations |
| Planning & Development | "Y City Centre Zone, 24m height" | Zone, height controls, EPBs, contaminated land, heritage, consents, infrastructure |

Each section includes: "Show on map" toggle, DataSourceBadge, feedback widget (on ~15% of sections).

### Screen 3: Compare View (V2 — design API for it now)

Side-by-side 2-3 properties with aligned score strips and shared map.

---

## Risk Score Visualization

### Composite Score: 240-Degree Arc Gauge

         ___________
       /    42/100   \
      /   LOW RISK    \         <- gradient: teal -> amber -> coral
     |                 |
      \               /
       \_____________/
     Low            High

- Arc angle: 240 degrees (Credit Karma style)
- Stroke width: 12-16px
- Score number: 48-64px Inter Bold
- Label: 14px Inter Medium
- Animate on first view: 1000ms arc fill + number count-up

### Colorblind-Safe Risk Palette (Okabe-Ito Derived)

| Score | Label | Hex | Map Pattern |
|-------|-------|-----|-------------|
| 0-20 | Very Low | #0D7377 teal | Solid (no pattern) |
| 21-40 | Low | #56B4E9 sky blue | Dots |
| 41-60 | Moderate | #E69F00 amber | Horizontal lines |
| 61-80 | High | #D55E00 vermillion | Wide diagonal hatching |
| 81-100 | Very High | #C42D2D coral | Dense diagonal hatching |

*Never red-green.* Blue and orange are universally distinguishable. Always supplement color with pattern/texture on map and text labels everywhere.

### Score Strip

[Flood: 20] [Quake: 35] [Zone: 55] [Crime: 28] [Climate: 61]
   teal       sky blue     amber     sky blue    vermillion

36px circles, 8px gaps, horizontal row.

### Making Scores Trustworthy

1. Neutral language: "Moderate" not "Warning"
2. Show breakdown: sub-factors as horizontal bars
3. Context: "Similar to 65% of Wellington properties"
4. Methodology link: "How is this calculated?" inline expand
5. Cool color dominance: teal/blue dominates, warm only at high end

---

## Map Design

### Basemap: LINZ Topolite V2 (Free, Authoritative)

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.linz.govt.nz/v1/styles/topolite-v2.json?api=YOUR_API_KEY',
  center: [174.7762, -41.2865],
  zoom: 13
});

- *Free*, no rate limits with developer key (email basemaps@linz.govt.nz)
- Standard key: 1M tiles/month free (no registration needed)
- Attribution required: LINZ CC BY 4.0
- Vector tiles (PBF) using Shortbread schema
- Aerial toggle: basemaps.linz.govt.nz/v1/tiles/aerial/.../webp (5cm urban res)

### Custom Basemap Colors (Muted for Overlay Readability)

Light mode:                     Dark mode:
  Land:      #f5f5f3              Land:      #1a1a2e
  Water:     #d4e4f7              Water:     #16213e
  Roads:     #e0ddd8              Roads:     #2a2a3e
  Buildings: #ebe8e3              Buildings: #232338
  Parks:     #e2ead5              Labels:    #8888aa
  Labels:    #6b6b6b

Use Maputnik (maplibre.org/maputnik) to customize the LINZ style JSON.

### Layer Styling

| Layer | Fill Opacity | Border | Color |
|-------|-------------|--------|-------|
| Selected property | 15% | 2px solid | #0D7377 teal |
| Flood zone | 20% | 1px dashed | #56B4E9 sky blue |
| Tsunami zone | 20% | 1px dashed | #0072B2 dark blue |
| Earthquake fault | -- | 2px solid | #D55E00 vermillion |
| Erosion/landslide | 25% | 1px solid | #E69F00 amber |
| Heritage | 15% | 1px dotted | #CC79A7 reddish purple |
| Noise contour | 15% | 1px solid | #6B7280 grey |

Different border styles (solid/dashed/dotted) as secondary differentiator for colorblind users. Use TextureMap library for MapLibre fill-pattern overlays.

---

## Mobile UX

### Bottom Sheet (3 Snap Points)

| State | Height | Map | Sheet Content |
|-------|--------|-----|---------------|
| Peek | 120-148px | Fully interactive | Address + key scores |
| Half | 50% (~355px) | Visible, interactive | Accordion headers visible |
| Full | 92-95% | 44-56px strip at top | Full report scrollable |

*Gesture disambiguation*: Top 48px (drag handle) = always controls sheet. Map area = always controls map. Sheet content = drags sheet at peek/half, scrolls content at full.

### Mobile Search

- Fixed top search bar (NOT in bottom sheet)
- Autocomplete: full-screen overlay (keyboard takes 50% of screen on mobile)
- After selection: keyboard dismisses, 1200ms flyTo zoom 17, pin bounce, sheet to peek

### Layer Controls: Horizontal Chip Bar

[Hazards] [Schools] [Transport] [Crime] [Planning] [Property] [More...]

36px tall chips, 8px gaps, horizontal scroll with fade gradient on right. "More" opens full-screen picker. *Limit: 5-8 simultaneous layers* before map becomes unreadable.

### Responsive Breakpoints

| Width | Layout |
|-------|--------|
| < 640px | Full map + bottom sheet |
| 640-1023px | Collapsible side panel |
| >= 1024px | 60/40 split view |

### Mobile Performance

- Parcels: visible zoom >= 14 only. Building outlines: zoom >= 15
- Service worker: stale-while-revalidate tiles (500 cached, 7-day), network-first API (50 reports, 24h)
- Intersection Observer (200px margin) for lazy-loading report sections
- Detect navigator.connection.effectiveType -- downgrade layers on slow connections
- Debounce viewport queries 300-500ms

---

## First-Use Experience

### Landing Page IS the Map

No separate marketing page. Thin hero overlay on live interactive map.

*30-second aha moment path*:
- 0-3s: Page loads, map visible, hero text clear
- 3-10s: Pre-loaded Wellington property shows risk scores
- 10-20s: User types own address or clicks suggested one
- 20-30s: Property report loads with real data

### Pre-Loaded Demo

Auto-load a Wellington address (35-layer coverage) showing flood zones, school catchments, transit stops, deprivation, and risk gauge.

### Contextual Hints (No Tours)

- Pulsing dot on first accordion section
- Tooltips on first interaction per feature
- "What is this?" inline expansion in section headers

### Signup Wall Placement

AFTER the user sees one full report: Land -> Demo -> Own address -> Partial report -> "Sign up free for all layers"

---

## Data Coverage Gaps

### Critical Distinction: "No Risk" vs "No Data"

*No Risk Detected* (we checked, it's fine):
- Green checkmark icon
- "No Flood Risk Detected"
- "This property is outside all mapped flood zones."
- Source: NIWA, updated Jan 2026

*Data Not Available* (we don't have this here):
- Grey question mark icon, dashed border
- "Flood Risk: Data Not Available"
- "This dataset isn't available for Auckland yet."
- "Available for: Wellington, Hutt Valley"
- [Notify me when Auckland is added]

*Rules*:
- Green checkmark + positive language = checked, safe
- Grey question mark + dashed border + neutral language = no data
- NEVER hide unavailable layers -- show muted with explanation
- NEVER use red/warning for "no data"
- Show coverage fraction: "Data coverage: 15 of 35 layers"

### Coverage Badges

Top of every property report:
Coverage: Full (35 of 35 layers)     -- Wellington
Coverage: Standard (15 of 35 layers) -- Auckland

Dedicated /coverage page with city-by-city map and expansion roadmap.

---

## Trust & Credibility

### Layer 1: Government Logos (Footer)

DATA SOURCES: [LINZ] [Stats NZ] [MBIE] [NIWA] [data.govt.nz]
"WhareScore combines data from 12+ NZ government sources.
We don't collect, estimate, or modify any data."

### Layer 2: Per-Section Attribution (MBIE Compliant)

Source: NIWA  |  Updated: 15 Jan 2026  |  [i]

[i] expands to: dataset name, source link, methodology, caveats.

*MBIE requirement*: "Data sourced from the [Register name]" + search date/time.

### Layer 3: Methodology Page (/methodology)

Every data source, refresh schedule, known limitations, how we make money.

### Layer 4: Micro-Trust Signals

- Data freshness dates on every section
- "Government data" badge next to govt-sourced sections
- No login required for basic data
- No ads in initial product (ads reduce credibility of free tools)
- Clean, professional design (visual quality = #1 credibility proxy in first 200ms)

---

## Feedback System

### Rotating Feedback (Not on Every Section)

*Problem*: 35 sections with thumbs up/down = fatigue.
*Solution*: Show feedback on 3-5 sections per visit, rotating targets.

*Rules*:
- Only show on sections user has expanded AND scrolled through
- Maximum 5 prompts per session
- Cool-down after 3 interactions in one visit
- Position: bottom of section content, inside accordion, above source attribution

*Thumbs up*: Inline "Thanks!" fades after 3s.
*Thumbs down*: Expands 4 radio buttons + optional text:
1. Data seems inaccurate
2. Not relevant to my decision
3. Hard to understand
4. Missing information I need

Also track implicit: which sections expanded, time spent, re-collapsed without scrolling.

---

## Sharing & Export

### 1. Shareable URL (Primary)

https://wharescore.co.nz/property/162-cuba-street-wellington

Works without authentication. Open Graph meta for rich WhatsApp/Facebook previews:

<meta property="og:title" content="162 Cuba Street, Wellington - WhareScore" />
<meta property="og:description" content="Low risk | CCZ Zone | 10 schools nearby" />
<meta property="og:image" content="https://wharescore.co.nz/og/162-cuba-st.png" />

### 2. Web Share API (Mobile)

navigator.share({ title, text, url }) for native share sheet.

### 3. PDF Export

- Page 1: Executive summary -- address, scores, mini-map, top 5 highlights
- Pages 2-N: Detailed sections with visualizations
- Final page: Methodology & sources (MBIE compliance)
- QR code linking to live report

### 4. QR Code (Cross-Device)

In share drawer and PDF corner. Dynamic QR for future URL changes.

---

## Accessibility

### WCAG 2.2 AA Compliance

*Screen readers*:
- Map: role="application" with descriptive aria-label
- Report panel IS the text alternative for the map
- aria-live="polite" for search results and layer toggle announcements
- Semantic HTML with proper heading hierarchy

*Keyboard*:
- MapLibre built-in: arrow keys pan, +/- zoom, Shift+arrows pitch/rotate
- Tab order: Skip nav -> Search -> Map -> Layer controls -> Report
- Custom feature nav: Enter = open popup, N/ArrowRight = next feature

*Color*:
- Okabe-Ito palette for all map overlays (colorblind-safe)
- Pattern/texture on map polygons + text labels (never color alone)
- Text: 4.5:1 contrast min. Graphics: 3:1 contrast min
- Use TextureMap library for MapLibre fill-pattern

*Reduced motion*:
- MapLibre auto-converts flyTo to jumpTo when prefers-reduced-motion: reduce
- All CSS animations disabled via media query
- Score arc shows final state immediately

*Zoom/reflow*:
- Report panel reflows at 200% and 400% (relative units throughout)
- Map canvas exempt per WCAG 1.4.10 (2D scrollable content)
- Side panel collapses below map at narrow widths

---

## Performance Targets

| Metric | Target | How |
|--------|--------|-----|
| Address search -> full report | < 3 seconds | PL/pgSQL function (~30ms) + Redis cache |
| Map layer toggle | < 500ms | Vector tiles cached at CDN (24h) |
| Accordion section expand | < 200ms | TanStack Query cache (5min stale) |
| Mobile first paint | < 1.5s | Next.js RSC, code-split sections |
| Parcels rendering (4.3M) | 60fps | Martin vector tiles, zoom >= 14 |
| Autocomplete response | < 100ms | Trigram index on addresses table |

---

## Animation & Micro-interactions

### Timing Guidelines (from NN/G research)

| Action | Duration | Easing |
|--------|----------|--------|
| Button press, toggle | 100ms | ease-out |
| Modal/panel appear | 200-300ms | ease-out |
| Accordion expand | 250ms height + 200ms opacity | ease-out |
| Accordion collapse | 200ms | ease-in (faster exit) |
| Map fly-to (property selection) | 600-800ms | ease-in-out |
| Report panel slide-in | 300ms | ease-out |
| Score arc fill + count-up | 1000ms | cubic-bezier(0.25, 0.1, 0.25, 1) |
| Sub-score bars stagger | 150ms each, 80ms delay | ease-out |
| Map layer fade in | 400ms opacity | ease-in |
| Map layer fade out | 300ms opacity | ease-out |

*Rules*:
- Never exceed 500ms for any single element
- Prefer ease-out for entrances, ease-in for exits
- Score animation: only on first view (IntersectionObserver trigger), not on tab switch
- Map layers: opacity only, never slide/scale (unnatural on geographic surface)

*Reduced motion override*:
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

### Loading Skeletons

- Shimmer animation: opacity 0.4-1.0 over 1.5s ease-in-out
- Skeleton shapes must match exact layout of loaded content
- Map placeholder: grey rectangle (#E5E7EB light / #374151 dark) with centered spinner
- Score gauge: grey semicircular arc outline (empty, no fill)

---

## Implementation Priority

### Phase 1: Core MVP

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | Database views + materialized views + report function | Medium | Foundation |
| 2 | Application tables (user_rent_reports, feedback, email_signups) | Low | Feature support |
| 3 | FastAPI: /report, /summary, /search, /nearby, /market endpoints | Medium | Core data access |
| 4 | Martin vector tile server setup | Low | Map overlays |
| 5 | Next.js app + MapLibre + LINZ basemap | Medium | Core UI shell |
| 6 | Search bar with autocomplete | Low | Entry point |
| 7 | Property report panel (desktop split view) | High | Core experience |
| 8 | Score gauge + score strip + context signals | Medium | Visual centerpiece |
| 9 | Accordion sections (5 categories) | Medium | Data presentation |
| 10 | Market section: 3-state rent comparison flow | High | "Is your rent fair?" hook |
| 11 | Multi-unit property detection + building info banner | Medium | Apartment UX |
| 12 | Error states (7 scenarios) + empty states | Medium | Polish / zero dead ends |
| 13 | Pre-loaded demo property on landing | Low | First aha moment |
| 14 | Source attribution per section | Low | MBIE compliance + trust |
| 15 | Shareable URL + OG meta tags | Medium | Sharing / growth |

### Phase 2: Mobile + Polish

| # | Task | Effort |
|---|------|--------|
| 16 | Mobile bottom sheet (3 snap points) | High |
| 17 | Mobile layer chip bar + layer picker | Medium |
| 18 | Feedback system (FAB + drawer + bug/feature forms) | Medium |
| 19 | User-contributed rent reports (POST + validation + crowd display) | Medium |
| 20 | Coverage badges per region | Low |
| 21 | Dark mode (map + UI) | Medium |
| 22 | Loading skeletons (report + section) | Low |
| 23 | First-use experience (hints, demo property) | Low |
| 24 | Help/FAQ, About, Contact, Privacy, Terms pages | Low |
| 25 | Government logos footer + announcement banner | Low |

### Phase 3: Admin + Scale (V2)

| # | Task |
|---|------|
| 26 | Admin portal (6 tabs: dashboard, analytics, data health, feedback, emails, content) |
| 27 | User accounts + save-to-list |
| 28 | Side-by-side property comparison |
| 29 | Premium reports ($10-25) |
| 30 | Commute calculator (Valhalla/OSRM) |
| 31 | Expand hazard data: Auckland, Canterbury |
| 32 | Methodology / transparency page |
| 33 | deck.gl heatmap layers |
| 34 | PDF export |
| 35 | Full accessibility audit |

---

## Key Research Sources

*Architecture*: Crunchy Data (PostGIS performance, vector tiles), Paul Ramsey (TOAST EXTERNAL 5x speedup), Martin GitHub, FastAPI + PostGIS patterns

*UX/Design*: Nielsen Norman Group (progressive disclosure, animation, skeletons), Baymard Institute (split-view vs list), Carbon Design System (empty states, loading), Credit Karma (arc gauge pattern)

*Map*: LINZ Basemaps (basemaps.linz.govt.nz), MapLibre GL JS, Okabe-Ito colorblind palette, ColorBrewer, TextureMap library

*Mobile*: Google Maps 2025 bottom sheet redesign, Vaul/react-modal-sheet, supercluster

*Accessibility*: WCAG 2.2 AA, MapLibre keyboard + reduced-motion, FIREANTSTUDIO accessible maps guide, WebAIM contrast checker
$$

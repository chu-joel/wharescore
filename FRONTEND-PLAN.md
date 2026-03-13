# WhareScore — Frontend Implementation Plan

**Split from:** IMPLEMENTATION-PLAN.md | **Phases covered:** 3 (Shell) + 4 (Report UI) + 5 (Search)

**See also:** `IMPLEMENTATION-PLAN.md` (overview, project structure), `BACKEND-PLAN.md` (Phases 1-2, Security), `ux-design-specification.md` (wireframes, design system)

## Phase 3: Frontend Shell

### 3A. Martin Tile Server Setup

Martin serves vector tiles directly from PostGIS. Install via single Windows binary from GitHub releases (`martin-x86_64-pc-windows-msvc.zip`). Zero-config auto-discovery works but configure `martin.yaml` for minzoom control.

**Reference:** PROGRESS.md session 16 for full research findings.

**Install & run (dev):**
```bash
# Download from https://github.com/maplibre/martin/releases (latest v1.x)
martin.exe "postgresql://postgres:postgres@localhost:5432/wharescore"
# Auto-discovers all tables with geometry + GIST index, serves at http://localhost:3000
```

**`martin.yaml` config** (critical — controls tile zoom ranges):
```yaml
postgres:
  connection_string: postgresql://postgres:postgres@localhost:5432/wharescore
  auto_publish:
    tables:
      from_schemas: public
  tables:
    parcels:
      minzoom: 12
    building_outlines:
      minzoom: 13
    addresses:
      minzoom: 14
    flood_zones:
      minzoom: 8
    tsunami_zones:
      minzoom: 8
    liquefaction_zones:
      minzoom: 10
    district_plan_zones:
      minzoom: 10
    height_controls:
      minzoom: 12
    noise_contours:
      minzoom: 11
    school_zones:
      minzoom: 10
    transmission_lines:
      minzoom: 8
    contaminated_land:
      minzoom: 12
    coastal_erosion:
      minzoom: 8
    wind_zones:
      minzoom: 8
    earthquakes:
      minzoom: 6
    transit_stops:
      minzoom: 12
    heritage_sites:
      minzoom: 12
    crashes:
      minzoom: 13
    resource_consents:
      minzoom: 13
    infrastructure_projects:
      minzoom: 10
    council_valuations:
      minzoom: 14
    air_quality_sites:
      minzoom: 8
    water_quality_sites:
      minzoom: 8
    osm_amenities:
      minzoom: 13
    conservation_land:
      minzoom: 10
    sa2_boundaries:
      minzoom: 8
```

**Performance:** At zoom 14 (~1km² tiles), PostGIS serves 100-500 parcels in 10-50ms. Martin is the fastest of 6 tile servers benchmarked. Cache 256-512MB in-memory, Cloudflare CDN in front for production.

### 3A-1. Map Layer Styling — Risk Patterns (not just colors)

Map polygon fills MUST use **color + pattern** (never color alone — WCAG compliance + colorblind safety). Reference: UX spec "Risk Score Color Palette" and "Accessibility" sections.

```typescript
// lib/mapStyles.ts — MapLibre fill-pattern definitions
// Patterns are generated as tiny canvas images and added to the map style

const RISK_PATTERNS = {
  "very-low":  { color: "#0D7377", pattern: "solid",            textColor: "#FFFFFF" },
  "low":       { color: "#56B4E9", pattern: "dots",             textColor: "#1A1A1A" },
  "moderate":  { color: "#E69F00", pattern: "horizontal-lines", textColor: "#1A1A1A" },
  "high":      { color: "#D55E00", pattern: "wide-diagonal",    textColor: "#FFFFFF" },
  "very-high": { color: "#C42D2D", pattern: "dense-diagonal",   textColor: "#FFFFFF" },
};

// Generate pattern images on map load:
function addRiskPatterns(map: maplibregl.Map) {
  for (const [key, { color, pattern }] of Object.entries(RISK_PATTERNS)) {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;  // semi-transparent over basemap
    ctx.fillRect(0, 0, 16, 16);
    ctx.globalAlpha = 0.6;
    // Draw pattern overlay
    if (pattern === 'dots') { ctx.beginPath(); ctx.arc(4,4,2,0,Math.PI*2); ctx.arc(12,12,2,0,Math.PI*2); ctx.fill(); }
    if (pattern === 'horizontal-lines') { ctx.fillRect(0,6,16,2); ctx.fillRect(0,12,16,2); }
    if (pattern === 'wide-diagonal') { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4,16); ctx.lineTo(16,-4); ctx.stroke(); }
    if (pattern === 'dense-diagonal') { ctx.strokeStyle = color; ctx.lineWidth = 2; for (let i=-16;i<32;i+=6) { ctx.beginPath(); ctx.moveTo(i,16); ctx.lineTo(i+16,0); ctx.stroke(); } }
    map.addImage(`risk-${key}`, canvas);
  }
}

// Usage in Layer style:
// { 'fill-pattern': ['match', ['get', 'risk_level'], 'very-low', 'risk-very-low', ...] }
```

### 3A-2. Animation Timing Constants

All animation timings defined centrally. Reference: UX spec "Animation Timing" section.

```typescript
// lib/animations.ts — shared timing constants

export const TIMING = {
  // Micro-interactions
  BUTTON_PRESS: 100,           // ms, ease-out
  TOOLTIP_APPEAR: 150,         // ms, ease-out
  TOAST_APPEAR: 200,           // ms, ease-out (slide up + fade)
  TOAST_DISMISS: 150,          // ms, ease-in (slide down + fade)

  // Layout transitions
  ACCORDION_EXPAND: 250,       // ms height + 200ms opacity, ease-out
  ACCORDION_COLLAPSE: 200,     // ms height + 150ms opacity, ease-in
  MODAL_APPEAR: 250,           // ms, cubic-bezier(0.32, 0.72, 0, 1)
  REPORT_SLIDE_IN: 300,        // ms, ease-out (desktop side panel)

  // Map animations
  MAP_FLY_TO: 1200,            // ms, MapLibre flyTo duration
  MAP_LAYER_FADE: 400,         // ms, opacity transition for tile layers

  // Score animations
  SCORE_ARC_FILL: 1000,        // ms, EASING.EASE_OUT — smooth fill, no overshoot
  SCORE_BAR_DURATION: 150,     // ms per category bar, ease-out
  SCORE_BARS_STAGGER: 80,      // ms delay between each of 5 category bars (total: 150 + 4*80 = 470ms)

  // Skeleton
  SKELETON_SHIMMER: 1500,      // ms, ease-in-out, infinite, opacity 0.4→1.0

  // Post-selection sequence (SEARCH-GEOCODING-RESEARCH.md §Frontend)
  // 0ms: dismiss keyboard
  // 0-1200ms: map flyTo
  // 800ms: pin bounce animation starts
  // 1000ms: bottom sheet slides to half / panel slides in
  POST_SELECT_PIN_DELAY: 800,
  POST_SELECT_SHEET_DELAY: 1000,
} as const;

// Easing curves
export const EASING = {
  DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  SCORE_ARC: 'cubic-bezier(0.25, 0.1, 0.25, 1)',  // score gauge smooth fill (UX spec canonical)
  SHEET: 'cubic-bezier(0.32, 0.72, 0, 1)',        // bottom sheet / modal
} as const;
```

### 3B. Project Setup

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir
cd frontend
npx shadcn@latest init
npm install maplibre-gl react-map-gl @tanstack/react-query zustand vaul recharts sonner @dnd-kit/core @dnd-kit/sortable
# vaul    = bottom sheet with snap points (MobileDrawer.tsx)
# recharts = D3-powered charts (RentHistoryChart, HPITrendChart, crime bars, crash bars)
# sonner  = toast notifications (shadcn/ui uses Sonner by default)

# Add all required shadcn/ui primitives:
npx shadcn@latest add accordion badge button card dialog input select \
  separator sheet skeleton toggle tooltip
# accordion  — 5 report sections (type="multiple", custom header with score badge)
# badge      — risk level badges (Very Low → Very High, 5 color variants)
# button     — primary/secondary/ghost/icon (44x44 hit target for icon)
# card       — all data cards (rounded-xl shadow-sm border-border)
# dialog     — full-screen layer picker (mobile), share options (desktop)
# input      — search bar, rent entry, feedback forms (h-12 rounded-lg)
# select     — dwelling type + time range filters (Rent History Chart)
# separator  — dividers between accordion sections
# sheet      — feedback drawer (slides from bottom/right)
# skeleton   — all loading states (shimmer, shapes match final layout)
# toggle     — "Show on map" per section, layer toggles, property type pills
# tooltip    — score explanations, methodology hints, icon-only buttons
```

**next.config.ts:**
```typescript
const config = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
      { source: '/tiles/:path*', destination: 'http://localhost:3000/:path*' },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js requires unsafe-eval in dev
              "style-src 'self' 'unsafe-inline'",                  // Tailwind injects inline styles
              "img-src 'self' data: blob: https://basemaps.linz.govt.nz",
              "font-src 'self'",
              "connect-src 'self' https://basemaps.linz.govt.nz http://localhost:*",
              "worker-src 'self' blob:",                           // MapLibre web workers
              "frame-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

### 3C. MapContainer with LINZ Basemap + Martin Tiles

```typescript
// components/map/MapContainer.tsx
import Map, { Source, Layer } from 'react-map-gl/maplibre';

const LINZ_STYLE = `https://basemaps.linz.govt.nz/v1/styles/topolite-v2.json?api=${LINZ_KEY}`;

export function MapContainer() {
  const { viewport, setViewport, layers } = useMapStore();

  return (
    <Map
      {...viewport}
      onMove={e => setViewport(e.viewState)}
      mapStyle={LINZ_STYLE}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Martin vector tile sources — all tables with GIST indexes are auto-published.
          Key layers: parcels, building_outlines, flood_zones, tsunami_zones,
          liquefaction_zones, district_plan_zones, school_zones, noise_contours,
          height_controls, contaminated_land, coastal_erosion, transmission_lines,
          osm_amenities, conservation_land, sa2_boundaries.
          transmission_lines is a non-scoring context layer (RISK-SCORE-METHODOLOGY.md)
          displayed as 2px line on map when toggled.
          osm_amenities: points — cafes, shops, parks, etc. (94,991 nationally).
          conservation_land: polygons — DOC reserves, national parks (11,025 nationally). */}
      {TILE_LAYERS.map(layer => (
        layers[layer.id] && (
          <Source key={layer.id} type="vector" url={`/tiles/${layer.id}`}>
            <Layer {...layer.style} />
          </Source>
        )
      ))}
    </Map>
  );
}
```

### 3D. SplitView Layout (Desktop)

```typescript
// components/layout/SplitView.tsx
export function SplitView({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <div className="w-[60%] relative">
        <MapContainer />
      </div>
      <div className="w-[40%] overflow-y-auto border-l">
        {children}
      </div>
    </div>
  );
}
```

### 3E. Zustand Store

```typescript
// stores/mapStore.ts
import { create } from 'zustand';

interface MapState {
  viewport: { longitude: number; latitude: number; zoom: number };
  selectedPropertyId: number | null;
  layers: Record<string, boolean>;
  setViewport: (v: MapState['viewport']) => void;
  selectProperty: (id: number, lng: number, lat: number) => void;
  toggleLayer: (id: string) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { longitude: 174.776, latitude: -41.290, zoom: 14 },
  selectedPropertyId: null,
  layers: { parcels: true },
  setViewport: (viewport) => set({ viewport }),
  selectProperty: (id, longitude, latitude) =>
    set({ selectedPropertyId: id, viewport: { longitude, latitude, zoom: 17 } }),
  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setLayers: (layers: Record<string, boolean>) => set({ layers }),
  resetViewport: () => set({ viewport: { longitude: 174.776, latitude: -41.290, zoom: 14 }, selectedPropertyId: null }),
}));

// Note: useLayerVisibility hook (listed in project structure) is a thin wrapper
// around mapStore.layers/toggleLayer/setLayers — it adds the "Show on Map"
// toggle behavior (save prior state, bulk-toggle section layers, restore on
// toggle-off). See §4D "Show on Map" for the full state management spec.
// The hook does NOT duplicate mapStore — it reads/writes mapStore.layers.
```

**`stores/searchStore.ts`** — Search UI state, separate from map state:
```typescript
// stores/searchStore.ts
import { create } from 'zustand';

interface SearchState {
  query: string;                          // current search input value
  isOverlayOpen: boolean;                 // mobile full-screen autocomplete overlay
  selectedAddress: {                      // the address the user selected from results
    addressId: number;
    fullAddress: string;
    lng: number;
    lat: number;
  } | null;

  setQuery: (q: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  selectAddress: (addr: SearchState['selectedAddress']) => void;
  clearSelection: () => void;             // "Search Another Address" resets here
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  isOverlayOpen: false,
  selectedAddress: null,

  setQuery: (query) => set({ query }),
  openOverlay: () => set({ isOverlayOpen: true }),
  closeOverlay: () => set({ isOverlayOpen: false, query: '' }),
  selectAddress: (addr) => set({ selectedAddress: addr, isOverlayOpen: false, query: '' }),
  clearSelection: () => set({ selectedAddress: null, query: '' }),
}));
```

**Store interaction flow:**
1. User types → `searchStore.setQuery()` updates query → triggers `useSearch` hook (debounced)
2. User selects result → `searchStore.selectAddress()` + `mapStore.selectProperty()` (both fire)
3. "Search Another Address" CTA → `searchStore.clearSelection()` + `mapStore` resets `selectedPropertyId` to null
4. Mobile search tap → `searchStore.openOverlay()` → renders `SearchOverlay` full-screen

### 3F. Mobile Layout — Bottom Sheet + Responsive Breakpoints

**Reference:** `MOBILE-UX-RESEARCH.md` (full research) and `Plan.md` "Mobile UX" section.

The desktop `SplitView` (60/40) does not work on mobile. Implement a responsive layout that switches between desktop split view and mobile bottom sheet.

**Breakpoints** (from `MOBILE-UX-RESEARCH.md` section 1):
```
< 640px  → Full map + bottom sheet (MobileDrawer.tsx)
640-1023px → Collapsible side panel
>= 1024px → 60/40 SplitView (already built in 3D)
```

**`components/layout/MobileDrawer.tsx`** — Bottom sheet using [Vaul](https://github.com/emilkowalski/vaul):
```tsx
import { Drawer } from 'vaul';

export function MobileDrawer({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<string | number>('148px');

  return (
    <Drawer.Root
      snapPoints={['148px', '355px', 1]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}  // critical: allows map interaction while sheet is open
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-10 rounded-t-2xl bg-white">
          <Drawer.Handle className="mx-auto mt-2 h-1 w-12 rounded-full bg-gray-300" />
          <div className="overflow-y-auto">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**Three snap points:**

| Snap | Height | Map | Content |
|------|--------|-----|---------|
| Peek | 148px | Fully interactive | Address + key scores |
| Half | 355px (~50%) | Visible, interactive, re-center pin | Accordion headers visible |
| Full | 92-95% | 44-56px strip at top | Full report scrollable |

**Critical Vaul config:**
- `fadeFromIndex={1}` — fades overlay starting from snap index 1 (half). Keeps peek state overlay-free.
- `modal={false}` — allows map interaction while sheet is open. Without this, map is blocked.
- Fast swipe handling: Vaul snaps to the nearest point by default. To enforce sequential snapping (peek→half→full, never peek→full), clamp in `setActiveSnapPoint` callback — if current is peek and target is full, override to half.

**Gesture rules** (from `MOBILE-UX-RESEARCH.md` section 1):
- Top 48px (drag handle zone): always controls sheet — velocity >500px/s snaps to next level
- Map area above sheet: always controls map (pan/zoom/tap)
- Sheet content at peek/half: vertical drag controls sheet snap
- Sheet content at full: vertical scroll controls content, not sheet (touch-action: pan-y)

**Mobile back button progressive collapse** (browser `popstate` event):
```ts
// hooks/useMobileBackButton.ts — manage history state for bottom sheet
useEffect(() => {
  const handleBack = (e: PopStateEvent) => {
    e.preventDefault();
    if (autocompleteOpen) { closeAutocomplete(); }
    else if (subPanelOpen) { closeSubPanel(); }
    else if (snap === 1) { setSnap('355px'); }      // full → half
    else if (snap === '355px') { setSnap('148px'); } // half → peek
    else { /* peek → do nothing, browser navigates */ }
    // Push new state to keep back button functional
    if (snap !== '148px') window.history.pushState({sheet: snap}, '');
  };
  window.addEventListener('popstate', handleBack);
  return () => window.removeEventListener('popstate', handleBack);
}, [snap, autocompleteOpen, subPanelOpen]);

// Push history entry when sheet expands
useEffect(() => {
  if (snap !== '148px') window.history.pushState({sheet: snap}, '');
}, [snap]);
```

**Layer chip bar** — `components/map/MapLayerChipBar.tsx`:
- Desktop: toggle panel sidebar
- Mobile (< 640px): horizontal scrolling chip bar below search bar
- Chip dimensions: 36px tall, `rounded-md`, 8px gaps, `px-3 text-xs font-medium`
- Right-edge fade gradient: `linear-gradient(to left, white 0%, transparent 100%)` over last 40px
- Preset groups: Hazards (flood, tsunami, liquefaction), Schools (zones, locations), Transport (transit, crashes), Crime, Planning (zones, heritage, contamination), Property (parcels, buildings, titles), More (noise, wind, conservation)
- Active chip: `bg-primary text-white`. Inactive: `bg-border text-secondary`
- Reference: `MOBILE-UX-RESEARCH.md` section 3

**Mobile autocomplete overlay** (from `MOBILE-UX-RESEARCH.md` section 2):
- Renders as full-screen overlay (not inline dropdown) — appears ABOVE virtual keyboard
- Max 5-6 results on mobile (vs 8 on desktop) — smaller viewport
- Escape/back button closes overlay and returns to map
- Recent searches shown when input is focused but empty

**Map camera adjustment** when sheet expands:
```ts
// Recenter property pin in visible map area above sheet
const visibleMapHeight = window.innerHeight - sheetHeight;
const targetY = visibleMapHeight * 0.25; // pin at 25% from top of visible area
map.easeTo({
  center: propertyLatLng,
  padding: { bottom: sheetHeight },
  duration: 300
});
```

### 3G. Layout Components (AppHeader, AppFooter, Dark Mode, StaticPageLayout)

**Rationale:** These are foundational shell components — every page depends on them. Build during Phase 3 alongside the map shell, not Phase 5.

**`AppHeader.tsx`:**
- Desktop (>= 1024px): 56px tall, fixed top, `z-50`. Left: "WhareScore" wordmark (20px Inter Bold, `text-primary-dark`). Right: "Methodology" ghost link, dark mode toggle (`Moon`/`Sun` 20px icon button), help (`HelpCircle` 20px icon button).
- Mobile (< 640px): 56px tall, fixed top, `z-50`. Compact logo (icon or "PIQ"), search bar takes remaining width (tap opens full-screen overlay), help icon (44x44px target). No dark mode toggle in mobile header.
- Tablet: same as desktop with tighter spacing.
- Background: white (light) / `--surface-dark` (dark), 1px bottom border.

**`AppFooter.tsx`:**
- Data source logos row: LINZ, Stats NZ, MBIE, NIWA, data.govt.nz — for credibility
- "WhareScore combines data from 12+ NZ government sources." (`text-sm text-secondary`)
- `Separator`
- 6 footer links: About, Help, Methodology, Privacy, Terms, Contact. Mobile: 2-column wrap.
- Legal: "(c) 2026 WhareScore. Not financial or legal advice. Data is indicative only." (`text-xs text-secondary`)
- All external links use `rel="noopener noreferrer"` + `target="_blank"`

**Dark mode implementation:**
- Toggle stored in localStorage (`theme` key) + respects `prefers-color-scheme` on first visit
- Use Tailwind `dark:` variant classes throughout — no runtime CSS-in-JS
- CSS variables for palette switching defined in `tailwind.config.ts` (see §3H)
- Glass effect dark variant: `background: rgba(26, 30, 46, 0.85)`, `border: 1px solid rgba(255, 255, 255, 0.08)`
- Charts: `CHART_THEME.colors.gridDark` (#374151) replaces grid color in dark mode
- Map: LINZ basemap does not have a dark variant — map stays light, surrounding UI goes dark

**`StaticPageLayout.tsx`** (shared wrapper for /help, /about, /privacy, /terms, /contact, /changelog):
- Max-width prose container (`max-w-3xl mx-auto px-4 py-8`)
- Back-to-map link at top: "< Back to map" ghost button
- Includes `AppHeader` + `AppFooter`
- Content: hardcoded TSX or loaded from markdown files

### 3H. Tailwind & Design System Configuration

**`tailwind.config.ts`** — CSS custom properties enabling dark mode, design system colors, and spacing:
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',   // toggle via <html class="dark">
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Design system semantic tokens (from UX spec Color Palette)
        primary:        { DEFAULT: '#0D7377', light: '#B2DFDB', dark: '#0A5C5F' },
        'accent-warm':  '#D4863B',    // ONLY for user-specific data (rent marker)
        'accent-hot':   '#C42D2D',    // ONLY for danger/critical (hazards, alerts)
        success:        '#2D6A4F',    // ONLY for positive outcomes (no risk, clear)
        secondary:      '#6B7280',    // Muted text, supporting info
        surface: {
          DEFAULT:  '#FFFFFF',
          elevated: '#F9FAFB',
          dark:     '#1A1E2E',
          'elevated-dark': '#242838',
        },
        border: {
          DEFAULT: '#E5E7EB',
          dark:    '#374151',
        },
        // Risk score palette (Okabe-Ito colorblind-safe)
        risk: {
          'very-low':  '#0D7377',
          low:         '#56B4E9',
          moderate:    '#E69F00',
          high:        '#D55E00',
          'very-high': '#C42D2D',
        },
      },
      spacing: {
        // 4px grid system (base-4)
        '4.5': '18px',
        '13':  '52px',
        '15':  '60px',
      },
      borderRadius: {
        xl:  '12px',
        '2xl': '16px',
      },
      boxShadow: {
        glass: '0 4px 6px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],  // shadcn/ui requirement
};
export default config;
```

**Dark mode CSS variables** (in `globals.css`, referenced by Tailwind config):
```css
:root {
  --text-on-dark: #E5E7EB;
}
.dark {
  --surface-dark: #1A1E2E;
  --surface-elevated: #242838;
  --border-dark: #374151;
}
```

### 3I. Shared Type Definitions

**`lib/types.ts`** — TypeScript types mirroring backend Pydantic schemas. Source of truth for all API response shapes. Generate from OpenAPI spec (`openapi-typescript`) or maintain manually.

```typescript
// lib/types.ts — frontend type definitions (mirrors backend schemas/)

// --- Search ---
export interface SearchResult {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  lng: number;   // for zero-latency flyTo
  lat: number;
}
export interface SearchResponse {
  results: SearchResult[];
  count: number;
}

// --- Property Report ---
export interface PropertyReport {
  address: AddressInfo;
  property: PropertyInfo;
  hazards: HazardData;
  environment: EnvironmentData;
  liveability: LiveabilityData;
  planning: PlanningData;
  market: MarketData;
  scores: CompositeScore;
  ai_summary: string | null;
  area_profile: string | null;
  property_detection: PropertyDetection | null;
  coverage: CoverageInfo;
}

export interface AddressInfo {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  ta: string;
  sa2_code: string;
  sa2_name: string;
  lng: number;
  lat: number;
}

export interface PropertyInfo {
  building_area_sqm: number | null;
  land_area_sqm: number | null;
  capital_value: number | null;
  land_value: number | null;
  improvement_value: number | null;
  title_ref: string | null;
  cv_valuation_id: string | null;  // WCC valuation reference (may be unit-specific)
  cv_address: string | null;       // valuation address (may differ from LINZ address format)
}

// --- Scores ---
export interface CompositeScore {
  overall: number;               // 0-100
  rating: RatingBin;
  categories: CategoryScore[];
  percentile: number | null;     // within SA2
}

export interface CategoryScore {
  name: 'risk' | 'liveability' | 'market' | 'transport' | 'planning';
  score: number;
  rating: RatingBin;
  indicators: IndicatorScore[];
}

export interface IndicatorScore {
  name: string;
  score: number;                 // 0-100
  rating: RatingBin;
  value: string;                 // display value ("3 zones within 500m")
  source: string;
  updated: string;               // ISO date
  is_available: boolean;
}

export type RatingBin = 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';

// --- Property Summary (lightweight — used for map-tap popup + saved properties) ---
// Returned by: GET /api/v1/property/{id}/summary (fast endpoint, no PL/pgSQL)
export interface PropertySummary {
  address_id: number;
  full_address: string;
  overall_score: number;
  rating: RatingBin;
  categories: Pick<CategoryScore, 'name' | 'score' | 'rating'>[];
  notable_findings: string[];    // indicators with score 60+
  unit_count: number | null;     // for multi-unit display
  is_multi_unit: boolean;        // true = show unit badge on popup/saved list
}

// --- Market ---
export interface MarketData {
  rent_assessment: RentAssessment | null;
  trend: TrendData | null;
  market_heat: 'cold' | 'cool' | 'neutral' | 'warm' | 'hot';
}

export interface RentAssessment {
  median: number;
  lower_quartile: number;
  upper_quartile: number;
  bond_count: number;
  dwelling_type: string;
  bedrooms: string;
  confidence_stars: 1 | 2 | 3 | 4 | 5;
  user_percentile: number | null;
  is_outlier: boolean;
}

export interface TrendData {
  cagr_1yr: number | null;
  cagr_5yr: number | null;
  cagr_10yr: number | null;
}

// --- Property Detection ---
export interface PropertyDetection {
  detected_type: 'house' | 'flat' | 'apartment' | 'room' | null;
  detected_bedrooms: number | null;
  unit_type: string | null;
  unit_value: string | null;
  is_multi_unit: boolean;
  unit_count: number | null;
  base_address: string | null;
  sibling_valuations: SiblingValuation[] | null;  // other units at same building
}

export interface SiblingValuation {
  address: string;            // "Unit 1 45 Cuba Street, Te Aro"
  capital_value: number;
  land_value: number;
  valuation_id: string;
}

// --- Nearby (GeoJSON) ---
export interface NearbyFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: number[] };
  properties: Record<string, unknown>;
}

export interface NearbyResponse {
  type: 'FeatureCollection';
  features: NearbyFeature[];
  count: number;
}

// --- Coverage ---
export interface CoverageInfo {
  available: number;
  total: number;           // 27
  percentage: number;
  per_category: Record<string, number>;
}

// --- Feedback ---
export interface FeedbackCreate {
  type: 'bug' | 'feature' | 'general';
  description: string;
  email?: string;
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  importance?: 'low' | 'medium' | 'high' | 'critical';
  page_url?: string;
  context?: string;
  browser_info?: Record<string, unknown>;  // Backend expects dict/object, not string
  property_address?: string;
}

// --- Email Signup ---
// Backend field is `requested_region` (not `city`). No `source` field.
export interface EmailSignupCreate {
  email: string;
  requested_region?: string;  // e.g. "Auckland", "Christchurch"
}

// --- Rent Report ---
// Backend field is `reported_rent` (not `weekly_rent`).
// `bedrooms` is a string pattern: "1" | "2" | "3" | "4" | "5+"
export interface RentReportCreate {
  address_id: number;
  dwelling_type: 'House' | 'Flat' | 'Apartment' | 'Room';
  bedrooms: '1' | '2' | '3' | '4' | '5+';
  reported_rent: number;  // $/week, 50-5000
}

// --- Property Summary for SSR / OpenGraph meta (extended with location context) ---
// Used by: SSR page metadata, OpenGraph tags, sitemap. NOT used for popups (use PropertySummary).
export interface PropertySummaryMeta {
  address_id: number;
  full_address: string;
  suburb: string;
  city: string;
  sa2_name: string | null;
  unit_type: string | null;
  scores: { composite: number; rating: string } | null;
  median_rent: number | null;
  notable_findings: string[];
}
```

### 3J. Constants & Configuration

**`lib/constants.ts`** — Extend beyond `CHART_THEME` with all runtime constants:
```typescript
// lib/constants.ts — all frontend constants

// --- Rating bins (score → label + color) ---
export const RATING_BINS = [
  { min: 0,  max: 20,  rating: 'very-low'  as const, label: 'Very Low',  color: '#0D7377' },
  { min: 21, max: 40,  rating: 'low'       as const, label: 'Low',       color: '#56B4E9' },
  { min: 41, max: 60,  rating: 'moderate'  as const, label: 'Moderate',  color: '#E69F00' },
  { min: 61, max: 80,  rating: 'high'      as const, label: 'High',      color: '#D55E00' },
  { min: 81, max: 100, rating: 'very-high' as const, label: 'Very High', color: '#C42D2D' },
] as const;

export function getRatingBin(score: number) {
  return RATING_BINS.find(b => score >= b.min && score <= b.max) ?? RATING_BINS[2];
}

// --- Category metadata ---
export const CATEGORIES = [
  { name: 'risk',       label: 'Risk & Hazards',         icon: 'ShieldAlert', iconColor: 'text-accent-hot' },
  { name: 'liveability', label: 'Neighbourhood',          icon: 'TreePine',    iconColor: 'text-success' },
  { name: 'market',     label: 'Market & Rental',         icon: 'TrendingUp',  iconColor: 'text-primary' },
  { name: 'transport',  label: 'Transport & Access',      icon: 'TrainFront',  iconColor: 'text-primary' },
  { name: 'planning',   label: 'Planning & Development',  icon: 'Landmark',    iconColor: 'text-primary' },
] as const;

// --- Map layer configuration ---
export const TILE_LAYERS = [
  // Hazards
  { id: 'flood_zones',       group: 'Hazards',   label: 'Flood Zones',       minzoom: 8 },
  { id: 'tsunami_zones',     group: 'Hazards',   label: 'Tsunami Zones',     minzoom: 8 },
  { id: 'liquefaction_zones', group: 'Hazards',  label: 'Liquefaction',      minzoom: 10 },
  { id: 'coastal_erosion',   group: 'Hazards',   label: 'Coastal Erosion',   minzoom: 8 },
  { id: 'wind_zones',        group: 'Hazards',   label: 'Wind Zones',        minzoom: 8 },
  // Schools
  { id: 'school_zones',      group: 'Schools',   label: 'School Zones',      minzoom: 10 },
  // Transport
  { id: 'transit_stops',     group: 'Transport',  label: 'Transit Stops',    minzoom: 12 },
  { id: 'crashes',           group: 'Transport',  label: 'Crashes',          minzoom: 13 },
  // Crime
  // (future: crime heatmap layer)
  // Planning
  { id: 'district_plan_zones', group: 'Planning', label: 'District Zones',  minzoom: 10 },
  { id: 'heritage_sites',    group: 'Planning',   label: 'Heritage',         minzoom: 12 },
  { id: 'contaminated_land', group: 'Planning',   label: 'Contamination',    minzoom: 12 },
  { id: 'infrastructure_projects', group: 'Planning', label: 'Infrastructure', minzoom: 10 },
  { id: 'transmission_lines', group: 'Planning',  label: 'Transmission Lines', minzoom: 8 },
  // Property
  { id: 'parcels',           group: 'Property',   label: 'Parcels',          minzoom: 12 },
  { id: 'building_outlines', group: 'Property',   label: 'Buildings',        minzoom: 13 },
  // More
  { id: 'noise_contours',    group: 'More',       label: 'Noise',            minzoom: 11 },
  { id: 'conservation_land', group: 'More',       label: 'Conservation',     minzoom: 10 },
  { id: 'osm_amenities',     group: 'More',       label: 'Amenities',        minzoom: 13 },
  { id: 'sa2_boundaries',    group: 'More',       label: 'SA2 Areas',        minzoom: 8 },
] as const;

// --- Chart theme (already defined, extended here) ---
export const CHART_THEME = {
  colors: {
    primary: '#0D7377',
    primaryLight: '#B2DFDB',
    accentWarm: '#D4863B',
    grid: '#E5E7EB',
    gridDark: '#374151',
  },
  font: { family: 'Inter, sans-serif', size: 12 },
  axis: { tickLine: false, axisLine: false, tick: { fill: '#6B7280', fontSize: 12 } },
  tooltip: {
    contentStyle: {
      borderRadius: '12px', border: '1px solid #E5E7EB',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      fontFamily: 'Inter, sans-serif', fontSize: '13px',
    },
  },
  animation: { duration: 800, easing: 'ease-out' },
} as const;

// --- Misc ---
export const MAX_RECENT_SEARCHES = 10;
export const MAX_SAVED_PROPERTIES = 20;
export const COVERAGE_TOTAL = 27;  // total risk indicators
export const LINZ_KEY = process.env.NEXT_PUBLIC_LINZ_API_KEY!;
```

### 3K. Formatting Utilities

**`lib/format.ts`** — All display formatting in one place. No formatting logic in components.
```typescript
// lib/format.ts — display formatting utilities

/** "$1,250,000" — NZD currency with commas, no decimals */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(value);
}

/** "$580/week" — weekly rent display */
export function formatRent(weeklyRent: number): string {
  return `$${weeklyRent.toLocaleString('en-NZ')}/week`;
}

/** "42" — score with no decimals */
export function formatScore(score: number): string {
  return Math.round(score).toString();
}

/** "1.2km" or "350m" — distance display */
export function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)}km`
    : `${Math.round(metres)}m`;
}

/** "+2.4%" or "-1.1%" — percentage change with sign */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** "23 of 27" — coverage display */
export function formatCoverage(available: number, total: number): string {
  return `${available} of ${total}`;
}

/** "Jan 2026" — month + year for data source dates */
export function formatDataDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
}

/** "2,403,583" — large number with commas */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-NZ');
}

/** "4.5 M" — abbreviated magnitude for earthquake display */
export function formatMagnitude(mag: number): string {
  return `${mag.toFixed(1)} M`;
}

/** "64 dB" — noise level display */
export function formatDecibels(db: number): string {
  return `${Math.round(db)} dB`;
}
```

---

## Phase 4: Property Report UI

**Development note:** Phase 4 components can be built with **mock data** before the backend (Phase 2) or search (Phase 5) exist. Create a `lib/mockData.ts` file with sample `PropertyReport`, `MarketData`, and `PropertySummary` objects matching the types in `lib/types.ts`. This enables parallel frontend/backend development and visual QA without API dependencies.

### 4A-0. PropertyReport Wrapper

`PropertyReport.tsx` is the top-level container that orchestrates the full report panel. It owns the TanStack Query call and distributes data to child components.

```typescript
// components/property/PropertyReport.tsx
// Wrapper: fetches report via usePropertyReport(addressId), renders panel
//
// Data flow:
//   1. usePropertyReport(addressId) → GET /api/v1/property/{id}/report
//   2. Backend: PL/pgSQL get_property_report() returns raw JSONB
//   3. Backend: Python risk_score.py computes scores (normalization + WAM/softmax)
//   4. Backend: ai_summary.py generates AI text (3s timeout, nullable)
//   5. Frontend receives fully-scored PropertyReport — no score computation on client
//
// Layout (top to bottom):
//   PropertySummaryCard → ScoreGauge → ScoreStrip → AISummaryCard →
//   NearbyAmenitiesCard → CoverageBadge → Accordion (5 sections) →
//   KeyTakeaways → ReportDisclaimer
//
// Error handling:
//   - Loading: <ReportSkeleton />
//   - NotFoundError: <NotFoundError />
//   - RateLimitError: <RateLimitError retryAfter={n} />
//   - Network/other: <NetworkError /> with retry
//
// Props: addressId: number (from URL param or map selection)
```

### 4A. ScoreGauge (240° Arc)

SVG-based, animated with CSS transitions.

```typescript
// components/property/ScoreGauge.tsx
interface ScoreGaugeProps {
  score: number;           // 0-100
  label: string;           // "Low Risk"
  color: string;           // hex from RATING_BINS
  animated?: boolean;      // default true — false for skeleton/instant render
}

// SVG layout:
//   viewBox="0 0 200 200", center (100,100), radius 80
//   Background arc: stroke #E5E7EB (light) / #374151 (dark), stroke-width 12
//   Score arc: stroke {color}, stroke-width 12, 240° total sweep
//   Score text: centered, font-size 48, tabular-nums, font-semibold
//   Label text: below score, font-size 14, text-secondary
//   Percentile context: below label, "Top 15% in [SA2 name]", text-xs text-secondary
//
// Animation:
//   - "First view" = when `animated` prop is true AND component mounts.
//     Every mount animates — navigating to a new property remounts the component
//     (React key={addressId} on PropertyReport forces remount).
//   - Arc fill: 0° → target° over TIMING.SCORE_ARC_FILL (1000ms), EASING.SCORE_ARC
//   - Score number: counts from 0 to score using requestAnimationFrame over 1000ms
//   - prefers-reduced-motion: skip animation, render final state immediately
//   - animated={false}: render final state immediately (used in skeletons, PDF export)
```

### 4B. ScoreStrip

Row of 5 circles, one per category. Each shows score + bin color.

```
Props: categories: { name, score, color, label }[]
```

### 4C. AISummaryCard

Displays the AI-generated property summary (from `report.ai_summary`) below the score strip, above the accordion sections. This is the first thing users read after seeing the scores.

```
Props: summary (string | null), loading (boolean)
```

**Layout:**
- Sits between ScoreStrip and accordion sections
- Light teal background (`#B2DFDB` at 20% opacity), 12px border-radius
- Small sparkle/AI icon + "AI Summary" label (12px, muted)
- Summary text: 14px Inter Regular, flowing prose (4-6 sentences)
- Skeleton: 4 lines of shimmer while AI generates (~1-2s)
- If `summary` is null (Azure OpenAI unavailable), component hidden — not an error state

**PropertySummaryCard multi-unit CV display:**
- Single-unit: `"CV $380,000"` (plain `text-sm text-secondary`, no qualifier)
- Multi-unit: `"CV $380,000"` + `Badge` variant="secondary" text-xs beside it: `"Unit valuation"`
  This tells the user their CV is unit-specific, not the whole building. Uses `isMultiUnit` from `usePropertyDetection`.
- If `capital_value` is null: show `"CV —"` with `Tooltip`: "No council valuation found for this address"
- BuildingInfoBanner renders directly below the address line in PropertySummaryCard (inside the same Card), above ScoreGauge.

**Report panel order (top to bottom):**
```
PropertySummaryCard  — Address, bookmark, CV (+ "Unit valuation" badge if multi-unit), footprint, Street View link
  └─ BuildingInfoBanner (inside card, only for multi-unit properties)
ScoreGauge           — 240° arc, composite score, percentile context
ScoreStrip           — 5 category circles (Risk, Liveable, Market, Transport, Plan)
AISummaryCard        — AI property + area summary (4-6 sentences, cached 24h)
NearbyAmenitiesCard  — What's Nearby (500m): 6 category counts + nearest essentials
CoverageBadge        — "23 of 27 indicators" (Info tooltip: "This report covers {n} of 27 risk indicators. Missing indicators: [list]. Coverage depends on available data for this location.")
Accordion            — 5 collapsible data sections (+ Rates for Wellington)
KeyTakeaways         — "2 things to investigate, 3 things that look good" + CTAs
ReportDisclaimer     — Legal disclaimer (non-dismissible)
```

### 4D. Accordion Sections

5 collapsible sections using shadcn/ui `Accordion` type="multiple". Each section:
- Header: Section-specific Lucide icon (see 4D-1 accordion table: `ShieldAlert`, `TreePine`, `TrendingUp`, `TrainFront`, `Landmark`, `Receipt`) + title (`text-base font-semibold`) + score `Badge` (colored by risk level) + "Show on map" `Toggle` (right-aligned)
- Preview text below title: 1-line summary (`text-sm text-secondary`)
- Content loads via TanStack Query with two-tier lazy strategy:
  - **Tier 1 (prefetch):** IntersectionObserver on accordion headers with `rootMargin: '200px'`. When a header scrolls within 200px of viewport, `queryClient.prefetchQuery()` fires the section's API call in the background. This pre-warms the cache before the user expands.
  - **Tier 2 (on expand):** When accordion expands, the section component mounts and calls `useQuery()`. If prefetch already cached data, it renders instantly. If not, it shows the section skeleton.
  - First 2 sections (Risk, Neighbourhood) prefetch immediately on report load (no IntersectionObserver needed — they're always near viewport).
  - TanStack Query config: `staleTime: 5 * 60 * 1000` (5 min), `retry: 2`, `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000)`
- Expand/collapse: 250ms height + 200ms opacity (ease-out). Chevron rotates ChevronRight → ChevronDown.
- DataSourceBadge at bottom of each section: "Source: [Name] | Updated: [Date]" (`text-xs text-secondary`)

**Section content overview (maps to UX spec sections 1-5):**

| # | Section Component | Header Icon | Content | shadcn/Recharts Used |
|---|-------------------|-------------|---------|---------------------|
| 1 | `RiskHazardsSection` | `ShieldAlert` (`text-accent-hot`) | Flood, tsunami, liquefaction, earthquake proximity, coastal erosion, wind, wildfire, EPBs. Critical findings (score 60+) get `border-l-4 border-accent-hot` + `AlertTriangle` icon. 2-col grid desktop, 1-col mobile. | `Card`, `Badge`, `Tooltip`, IndicatorCard |
| 2 | `NeighbourhoodSection` | `TreePine` (`text-success`) | Crime density (Recharts `BarChart`), NZDep decile (custom scale bar), schools (sortable table with `CheckCircle2`/`XCircle`/`Minus` zone indicators), noise (gradient scale), conservation land (`Trees` icon, `#2D6A4F`), demographics | `Card`, `Badge`, Recharts `BarChart`, `Table` |
| 3 | `MarketSection` | `TrendingUp` (`text-primary`) | `KeyValueCard` for council valuation (CV/LV/IV — unit-specific when available, with "(Unit valuation)" badge for multi-unit), `UnitComparisonTable` for sibling valuations (2+ units), `PillToggleGroup` for property type + bedrooms, rental overview table, rent fairness (`RentDistributionBar` with `accent-warm` user marker), `TimeSeriesChart` for rent history + HPI, user-contributed rent data | `Card`, `PillToggleGroup`, `KeyValueCard`, `TimeSeriesChart`, `Input`, `Select`, `Badge`, `Table` |
| 3b | `RatesSection` | `Receipt` (`text-primary`) | Annual rates breakdown, CV vs LV, valuation history. Wellington only — hidden for other cities. For multi-unit buildings: rates shown are unit-specific (WCC API returns per-unit rate accounts). If `isMultiUnit`, show valuation ID and "(This unit's rates)" qualifier above breakdown. No cross-unit rate comparison needed — users only see their own unit's rates. | `Card`, custom bars, `Badge` |
| 4 | `TransportSection` | `TrainFront` (`text-primary`) | `KeyValueCard` for distances (`Building2` CBD + `TrainFront` train), transit stops table (`Bus`/`TrainFront` icons), crash history (Recharts stacked `BarChart`, severity colors from risk palette) | `Card`, `KeyValueCard`, Recharts `BarChart` |
| 5 | `PlanningSection` | `Landmark` (`text-primary`) | Zone type, height limit, heritage/contamination checklist (`CheckCircle2` green = clear, `AlertTriangle` amber = flagged), infrastructure projects table, resource consents | `Card`, `Badge`, `Table` |

**"Show on Map" toggle — layer activation per section:**

| Section | Layers Toggled On | Behavior |
|---------|-------------------|----------|
| Risk & Hazards | `flood_zones`, `tsunami_zones`, `liquefaction_zones`, `coastal_erosion`, `earthquake_prone_buildings` | Map zooms to show hazard features around property |
| Neighbourhood | `school_zones`, `osm_amenities`, `conservation_land` | Crime heatmap (future), amenity points, green polygons |
| Market & Rental | *(none — data is tabular)* | Toggle hidden for this section |
| Transport & Access | `transit_stops`, `crashes` | Bus/train icons, crash point clusters |
| Planning & Development | `district_plan_zones`, `heritage_sites`, `contaminated_land`, `infrastructure_projects`, `transmission_lines` | Zone polygons, heritage points, infra markers |

**"Show on Map" toggle state management** (`hooks/useLayerVisibility.ts`):
```typescript
// hooks/useLayerVisibility.ts
// Wraps mapStore.layers with section-toggle behavior.

export function useLayerVisibility() {
  const { layers, setLayers, toggleLayer } = useMapStore();
  // Each section stores its own "prior state" snapshot
  const priorRef = useRef<Record<string, Record<string, boolean>>>({});
  // priorRef.current = { 'risk': { flood_zones: false, tsunami_zones: true, ... }, ... }

  const toggleSection = useCallback((sectionId: string, sectionLayers: string[]) => {
    const isCurrentlyOn = sectionLayers.every(id => layers[id]);

    if (isCurrentlyOn) {
      // Toggle OFF: restore prior state for THIS section's layers only
      const prior = priorRef.current[sectionId] ?? {};
      const restored = { ...layers };
      for (const id of sectionLayers) {
        restored[id] = prior[id] ?? false;  // default to off if no prior
      }
      setLayers(restored);
      delete priorRef.current[sectionId];
    } else {
      // Toggle ON: snapshot current state for this section, then enable all
      priorRef.current[sectionId] = {};
      for (const id of sectionLayers) {
        priorRef.current[sectionId][id] = layers[id] ?? false;
      }
      const updated = { ...layers };
      for (const id of sectionLayers) {
        updated[id] = true;
      }
      setLayers(updated);
    }
  }, [layers, setLayers]);

  return { layers, toggleLayer, toggleSection };
}

// Usage in accordion header:
// <Toggle pressed={allOn} onPressedChange={() => toggleSection('risk', SECTION_LAYERS.risk)} />
// SECTION_LAYERS defined as const map matching the table above.
```
Each section maintains its own independent prior-state snapshot. Toggling section A ON then B ON then A OFF correctly restores only A's layers to their pre-toggle state. B's layers remain on.

**Non-scoring context layers** (displayed in report but not inputs to the 27-indicator risk score):
- `osm_amenities` — Nearby cafes, shops, parks within 500m. Displayed in `NearbyAmenitiesCard` (above accordion) + nearest essentials (supermarket, GP, pharmacy). Source: OpenStreetMap (94,991 nationally).
- `conservation_land` — Nearest DOC reserve/national park within 5km. Displayed in `NeighbourhoodSection`. Source: DOC open data (11,025 polygons nationally).
- `transmission_lines` — Proximity to high-voltage lines. Displayed in `PlanningSection`. Source: Transpower (227 lines nationally).

### 4D-1. Component → Design System Mapping

Every custom component uses shadcn/ui primitives + Tailwind. No CSS-in-JS, no custom component library. This table ensures design consistency. Icon and color choices are defined in the UX spec's **Icon Registry** and **Color Semantics** tables — follow those exactly.

| Component | shadcn Primitives | Recharts / Base | Lucide Icon | Key Tailwind Classes |
|-----------|------------------|----------------|-------------|---------------------|
| `PropertySummaryCard` | `Card`, `Badge`, `Button` (icon, ghost), `Tooltip` | ScoreGauge (SVG) | `Bookmark`/`BookmarkCheck` (20px), `Eye` (14px, Street View), `Share2` (20px) | `rounded-xl shadow-sm p-4`, `tabular-nums` |
| `AISummaryCard` | `Card`, `Skeleton` | — | `Sparkles` (16px, `text-primary`) | `bg-teal-50 rounded-xl p-4` |
| `NearbyAmenitiesCard` | `Card`, `Button` (ghost) | — | `MapPin` (16px), category-specific icons (24px) | 3-col grid, `gap-4` |
| `CouncilValuationCard` | `Card` via `KeyValueCard` | — | `Home` (14px, unit indicator) | `dl/dt/dd`, `tabular-nums` |
| `DistanceToCard` | `Card` via `KeyValueCard` | — | `Building2` (16px, CBD), `TrainFront` (16px, train) | 2-row key-value, `text-secondary` caveat |
| `RentFairnessCard` | `Card`, `Badge`, `Input`, `Button` | RentDistributionBar | `DollarSign` (16px, input), `AlertTriangle` (16px, low confidence) | `accent-warm` marker (user position) |
| `PropertyTypeSelector` | via `PillToggleGroup` | — | — | `rounded-full`, `bg-primary`/`border-primary` |
| `BedroomSelector` | via `PillToggleGroup` | — | — | `rounded-full`, same as above |
| `RentHistoryChart` | `Card`, `Select` via `TimeSeriesChart` | `ComposedChart`, `Area`, `Line` | `TrendingUp`/`TrendingDown` (14px, CAGR badges) | 240px desktop, 200px mobile |
| `HPITrendChart` | `Card` via `TimeSeriesChart` | `AreaChart`, `ReferenceDot` | `Info` (14px, tooltip trigger) | 200px tall, `text-xs` caveat |
| `IndicatorCard` | `Card`, `Badge`, `Tooltip` | Score bar (8px div) | — | 2-col grid desktop, `tabular-nums` |
| `CriticalFinding` | `Card` | — | `AlertTriangle` (20px, `text-accent-hot`) | `border-l-4 border-accent-hot` |
| `KeyTakeaways` | `Card`, `Button` (primary + secondary) | — | `AlertTriangle` (investigate), `CheckCircle2` (positive) | `border-l-4 border-success` / `border-accent-hot` |
| `FeedbackDrawer` | `Sheet`, `Card`, `Input`, `Button`, `Textarea` | — | `MessageSquarePlus` (24px, FAB) | Slides from bottom / right |
| `ScoreGauge` | — | 240° SVG arc | — | `stroke-width: 12`, `tabular-nums` |
| `ScoreCircle` | — | 36px SVG circle | — | Colored by risk level palette |
| `ScoreContextSignals` | — | — | `Users` (14px, prevalence), `BarChart3` (14px, percentile), `TrendingUp`/`Down`/`Minus` (14px, trend) | `text-secondary` |
| `EmptyState` | `Card` | — | Configurable: `CheckCircle2`/`HelpCircle`/`Search` | success: `text-success`; neutral: `text-secondary`, dashed border |
| `ErrorState` | `Card`, `Button` (retry) | — | Configurable: `WifiOff`/`Clock`/`AlertTriangle`/`SearchX` | `text-secondary`, centered layout |
| `UnitComparisonTable` | `Table`, `Badge` | — | `Home` (14px, current unit) | `text-sm`, `tabular-nums`, `bg-primary-light/30` (highlight row) |
| `BuildingInfoBanner` | `Collapsible` | — | `Info` (16px, `text-primary`), `ChevronDown` (14px, disclosure) | `bg-primary-light rounded-lg p-3`, `text-sm`, inline mini-table |

**Accordion section headers — each uses a specific icon from the Icon Registry:**

| Section | Header Icon | Icon Color | Score Badge Colors |
|---------|------------|------------|-------------------|
| Risk & Hazards | `ShieldAlert` | `text-accent-hot` | Risk palette (teal→coral) |
| Neighbourhood | `TreePine` | `text-success` | Risk palette |
| Market & Rental | `TrendingUp` | `text-primary` | Risk palette |
| Transport & Access | `TrainFront` | `text-primary` | Risk palette |
| Planning & Development | `Landmark` | `text-primary` | Risk palette |
| Rates (Wellington) | `Receipt` | `text-primary` | N/A (no sub-score) |

**Recharts configuration:** `CHART_THEME` is defined in `lib/constants.ts` (see §3B-3). `TimeSeriesChart.tsx` applies it automatically to all charts. Color semantics: `primary` = trust/data, `primaryLight` = supporting context, `accentWarm` = user-specific data only.

**`PillToggleGroup` component (shared, reused in 4 places):**
```typescript
// components/common/PillToggleGroup.tsx
// Props: options: {value, label, detected?}[], value: string, onChange, size?: 'sm'|'md'
//
// Used by:
//   PropertyTypeSelector — options: House/Flat/Apartment/Room, supports "(detected)" label
//   BedroomSelector     — options: 1/2/3/4/5+
//   Time range selector — options: 5yr/10yr/All (in RentHistoryChart)
//   MapLayerChipBar     — options: dynamic layer presets
//
// Styling (from shadcn Toggle + rounded-full):
//   Active:   bg-primary text-white rounded-full h-9 px-4
//   Inactive: border border-primary text-primary rounded-full h-9 px-4
//   Disabled: opacity-50 cursor-not-allowed
//   All: font-medium text-sm, 44px min touch target on mobile
```

**`KeyValueCard` component (shared, reused in 2 places):**
```typescript
// components/common/KeyValueCard.tsx
// Props: title?: string, items: {icon?, label, value, format?}[], caveat?: string, source?: string
//
// Used by:
//   CouncilValuationCard — items: CV/LV/IV, caveat: "rateable value, not market", source: WCC
//     Multi-unit context (when isMultiUnit is true):
//       Visual hierarchy (top to bottom within the card):
//         1. Title row: "Council Valuation" (text-base font-semibold) + "(Unit valuation)"
//            Badge (variant="secondary", text-xs) inline to the right of the title
//         2. Key-value pairs: CV / LV / IV as normal dl/dt/dd rows
//         3. Caveat: "Rateable value, not market value." +
//            if cv_address exists and differs from LINZ full_address:
//            second line: "Valuation for: [cv_address]" (text-xs text-secondary)
//         4. Link: if hasSiblings → "Compare all [N] units" (text-primary, underline, text-xs)
//            On click: auto-expand MarketSection accordion if collapsed, then scrollIntoView
//            to UnitComparisonTable. This is the primary navigation path to the full
//            comparison table (the banner has a compact inline preview only).
//         5. Source: DataSourceBadge as usual
//   DistanceToCard       — items: CBD distance (Building2 icon), train distance (TrainFront icon)
//
// Renders: Card > dl/dt/dd pairs, values right-aligned in font-semibold tabular-nums
// Caveat in text-xs text-secondary below items. Source as DataSourceBadge.
```

### 4D-2. Empty States

Two distinct patterns (both use the shared `EmptyState` component):
- **No Risk Detected**: Green check, positive language, source attribution
- **Data Not Available**: Grey question mark, dashed border, coverage note
- **No Recent Searches**: Search icon, neutral, first-time user message

### 4E. 3-State Market Rent Comparison Flow

Reference: UX spec "Section 3: Market & Rental" (States A/B/C).

`RentComparisonFlow.tsx` manages 3 states:
- **State A** (default): Area overview table (All/Houses/Apartments) + "How does your rent compare?" input card with `PropertyTypeSelector` + `BedroomSelector` + rent input + Compare button
- **State B** (type + beds selected, no rent): Filtered medians, `RentDistributionBar` (LQ-Med-UQ), bond count, trend. Inline prompt for rent entry.
- **State C** (full comparison): "Is Your Rent Fair?" headline, user marker on distribution bar (`accent-warm`), percentile verdict, `CrossTypeComparison` table, `UserRentContribution` checkbox (opt-out, checked by default), confidence stars

**Rent data submission flow (State A → C):**
1. User fills type + bedrooms + rent → clicks "Compare" button
2. **On Compare click:** `GET /api/v1/property/{id}/market?dwelling_type=...&bedrooms=...&asking_rent=...` — returns assessment with percentile. No data stored yet.
3. State C renders with `UserRentContribution` checkbox (checked by default, opt-out)
4. **On page unload / report close:** if checkbox still checked AND rent was entered, fire `POST /api/v1/rent-reports` with `{ address_id, dwelling_type, bedrooms, reported_rent }` via `navigator.sendBeacon()` (fire-and-forget, no UI feedback needed). This ensures contribution without requiring an explicit "Submit" step. Note: `bedrooms` must be a string (`"1"`, `"2"`, etc.), not a number.
5. If user unchecks the checkbox before leaving, no POST fires.

Auto-detection: `PropertyTypeSelector` pre-selects based on `property_detection` from report data. "(detected)" label shown, user can override.

**Rent input validation (client-side, mirrors backend):**
- Numeric only — strip non-digit characters on input, allow only integers
- Hard bounds: reject `< $50/week` or `> $5,000/week` immediately with inline error (`text-destructive`, `AlertCircle` icon): "NZ rents are typically $100-$2,000/week."
- Compare button disabled until: property type selected AND bedrooms selected AND (rent empty OR rent within hard bounds)
- Soft flags (SA2 deviation > 3x or < 0.25x median): comparison still works, backend flags `is_outlier = true` on storage
- Rate limiting: if backend returns 429, show inline "You've already contributed today" message

**Rent input validation timing:** Validate on every keystroke (strip non-digits immediately, check hard bounds on each change). Show inline error as soon as value exits bounds — don't wait for blur or submit. Compare button disabled state recalculates on every input change.

**`RentDistributionBar.tsx`** — Horizontal bar showing rent distribution (LQ → Median → UQ):
```typescript
// components/property/RentDistributionBar.tsx
interface RentDistributionBarProps {
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  userRent?: number;           // only in State C — shows accent-warm marker
  confidence: 1 | 2 | 3 | 4 | 5;
}

// Layout: single horizontal bar, 100% width, 24px tall
//   Left label:  "$555" (LQ)    — text-xs text-secondary, left-aligned below bar
//   Center label: "$590" (Med)   — text-sm font-semibold, centered below bar
//   Right label:  "$658" (UQ)    — text-xs text-secondary, right-aligned below bar
//
// Bar segments (rendered as divs with flex, no SVG):
//   [--- LQ-Med range (bg-primary-light, opacity 0.5) ---]
//   [--- Med-UQ range (bg-primary-light, opacity 0.3) ---]
//   Median marker: 2px solid line, bg-primary, full height, positioned at median
//   User marker: 4px wide, bg-accent-warm, full height + 8px overflow top/bottom
//     positioned at user rent's proportional position in the LQ-UQ range
//     Below marker: "Your rent: $600/week" label + percentile: "38th percentile"
//
// Scale: bar spans from (LQ - 10%) to (UQ + 10%) to give visual padding
// If userRent is outside LQ-UQ range, marker still shows at edge with arrow pointing off-bar
//
// Low confidence (1-2 stars): show `AlertTriangle` (14px, text-accent-warm) + "Limited data"
```

**`CrowdsourcedRentCard.tsx`** — Shows community-contributed rent data (when >= 3 reports exist):
```typescript
// components/property/CrowdsourcedRentCard.tsx
// Props: reports: { count: number, median: number, range: string, lastUpdated: string } | null
//
// Shown below RentComparisonFlow in State B/C, only when reports.count >= 3
// Layout:
//   Card with `Users` icon (16px) + "Community Rent Data" header
//   "{count} renters have shared" + median + range
//   "Last updated: {date}" in text-xs text-secondary
//   If null or count < 3: hidden (not rendered)
//   Data: GET /api/v1/rent-reports/{address_id} via useRentReports hook
```

### 4F. Premium Tier Components

Reference: UX spec "Free vs Premium Report Tiers".

- **`BetaBanner.tsx`**: Thin bar above Summary Card. `bg-primary-light`, `Gift` icon. "Full reports are free during beta. Launching at $15/report in [configurable date]." Non-dismissible during beta.
- **`PremiumBadge.tsx`**: Shows "FREE BETA" badge on accordion headers during beta. Post-beta: shows `Lock` icon instead. State driven by config flag.
- **`UpgradeCard.tsx`**: Shown inside locked accordion sections post-beta. `Lock` icon (32px), "Unlock the full report" headline, feature list, "$15 one-time" CTA. `bg-muted rounded-xl p-6`.

**Free tier (always):** Summary Card, Score Gauge, Score Strip, AI Summary, Nearby Amenities (counts only), accordion headers (collapsed with score + preview), Key Takeaways, Share URL.

**Premium tier (free during beta):** Full accordion expansion, 27 indicator cards, rent comparison flow, charts, named amenities, PDF export.

### 4G. Multi-Unit Components

- **`BuildingInfoBanner.tsx`**: Info banner below address in Summary Card. `bg-primary-light`, `Info` icon. Only shown when `isMultiUnit` is true (from `usePropertyDetection`).
  - **Copy (two lines with visual hierarchy):**
    - Line 1 (`text-sm font-medium`): "Unit in a [N]-unit building"
    - Line 2 (`text-xs text-secondary`): "Valuations & rates are for this unit. Risk & neighbourhood data covers the whole building."
  - If `hasSiblings` is true: show inline disclosure toggle "Compare [N] units in this building" (`ChevronDown` 14px) that expands a compact mini-table *inside the banner* (no page scroll). Disclosure uses shadcn `Collapsible`. Mini-table shows: Address | CV columns only (simplified from full `UnitComparisonTable`). Current unit row highlighted with `bg-primary-light/50` + bold text. Max 6 rows in mini-table — if more than 6 siblings, show last row as "[N] more units — see full comparison below" link that scrolls to `UnitComparisonTable` in MarketSection (auto-expand MarketSection accordion if collapsed, then `scrollIntoView({ behavior: 'smooth' })`).
  - Layout: `flex items-start gap-3 rounded-lg p-3 bg-primary-light`. `Info` icon (16px, `text-primary`, flex-shrink-0).

- **`UnitComparisonTable.tsx`**: Sortable table showing all unit valuations at the same building. Rendered inside `MarketSection` below `CouncilValuationCard`, only when `sibling_valuations` has 2+ entries.
  ```typescript
  // components/property/UnitComparisonTable.tsx
  interface UnitComparisonTableProps {
    siblingValuations: SiblingValuation[];  // from PropertyDetection
    currentValuationId: string | null;       // from PropertyInfo.cv_valuation_id
    currentProperty: {                       // from PropertyInfo (fallback if missing from siblings)
      cv_address: string | null;
      capital_value: number | null;
      land_value: number | null;
      cv_valuation_id: string | null;
    };
  }

  // Layout:
  //   Header: "Units in this building" + unit count badge (Badge variant="secondary")
  //   Table columns: Address | Capital Value (with inline relative bar) | Land Value
  //   Current unit's row: highlighted with `bg-primary-light/30` + "(This unit)" Badge
  //   Sort: default by Capital Value descending (user's primary question: "how does my
  //     unit compare?"). Clickable column headers toggle asc/desc. Sort icon: ChevronUp/Down.
  //   Values: formatCurrency() from lib/format.ts, right-aligned, tabular-nums
  //   Relative bar: thin 4px bar next to CV value showing position within min-max range.
  //     Current unit's bar uses `bg-accent-warm`, others use `bg-primary-light`.
  //     Bar width = (value - min) / (max - min) * 100%. Provides instant visual ranking.
  //   Max rows: 20 (backend limit). If exactly 20, show "Showing first 20 units" note.
  //   Empty state: hidden (component not rendered if < 2 entries)
  //
  // Edge case — current unit missing from siblings:
  //   If currentValuationId is NOT found in siblingValuations array, prepend a synthetic
  //   row using currentProperty data (cv_address, capital_value, land_value, cv_valuation_id).
  //   This handles: (a) building has >20 units and current unit is past LIMIT 20,
  //   (b) current unit's address format didn't match the regex filter.
  //   Synthetic row gets the same "(This unit)" highlight. Adjust relative bars to include it.
  //
  // Responsive:
  //   Desktop: full 3-column table with relative bars
  //   Mobile: stack into cards — address on top, CV + LV below in 2-col grid, relative bar
  //     spans full card width below values
  //
  // Interaction:
  //   - No row click action (units share the same report — no linking to other addresses)
  //   - Current unit row is always visible (pinned to top when sorting, then remaining rows
  //     sorted by selected column). This ensures the user's unit is never scrolled out of view.
  //
  // Tailwind: Table via shadcn Table component, `text-sm`, `tabular-nums` on values
  ```

- **`MapPopup.tsx` (multi-unit variant)**: When tapping parcel with multiple addresses at same coords, show building-level preview with unit count instead of per-unit disambiguation list. Content: building base address + unit count badge + composite score (from first/lowest address_id at coords — arbitrary but deterministic). CTA: "View Building Report" → loads the report for the first address_id at that location. The report's `BuildingInfoBanner` then shows all units, and the user sees building-level data (hazards, neighbourhood) which is identical for all units. If the user came from search (typed a specific unit), they get that unit's report directly — this popup flow only applies to map-tap on a parcel polygon.

### 4H. Feedback Forms

- **`FeedbackFAB.tsx`**: `MessageSquarePlus` icon (24px), fixed bottom-right (16px offset), above bottom sheet on mobile. Opens FeedbackDrawer.
- **`FeedbackDrawer.tsx`**: shadcn `Sheet` (bottom on mobile, right on desktop). Tab selector: Bug / Feature / General.
- **`BugReportForm.tsx`**: Fields: description (required), steps to reproduce, expected vs actual, importance (low/medium/high/critical), email (optional), auto-captured: page URL, browser info.
- **`FeatureRequestForm.tsx`**: Fields: description (required), use case, importance, email (optional).
- **`GeneralFeedbackForm.tsx`**: Fields: satisfaction (1-5 emoji scale: `Frown`/`Meh`/`Smile`/`Laugh`/`Heart`), comment, email (optional).

**Feedback form validation:**
- Description: required, 10-2000 chars, strip HTML tags on submit
- Email: optional, validated with regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — show inline error if malformed
- Screenshot upload: max 5MB, accept `image/png, image/jpeg, image/webp` only — reject other types with inline error
- All text fields: trim whitespace, no script injection (React JSX escaping handles display; strip tags before POST)
- Rate limiting: disable submit button for 30s after successful submission (prevent spam). On 429 from backend, show "Please wait before submitting again."
- Auto-captured fields (`page_url`, `property_address`, `browser_info`) are read-only and not user-editable

### 4I. Error States (Full Catalog)

7 error scenarios using shared `ErrorState` component. Pattern: What happened + Why + What to do.

| Component | Icon | Trigger | CTA |
|-----------|------|---------|-----|
| `NetworkError` | `WifiOff` | No network | Try Again, View Cached |
| `TimeoutError` | `Clock` | API > 5s | Retry, Search Different |
| `SectionError` | `AlertTriangle` | Partial section fail | Retry (inline) |
| `NotFoundError` | `SearchX` | Address not in DB | Search Again |
| `OutOfCoverage` | `MapPinOff` | Outside Wellington | Email capture form (see below) |

**`OutOfCoverage` expanded spec:**
- Heading: "We're not in [detected city] yet"
- Supported cities list: hardcoded array `['Wellington']` (update as coverage expands)
- Email input: validate format, max 254 chars, trim. `useEmailSignup` mutation (§5E)
- Region field: auto-populated from detected city (from search result), read-only. Sent as `requested_region` to backend.
- On success: check response `status` — if `"subscribed"`, show `CheckCircle2` + "Thanks! We'll notify you when we expand to [region]." If `"already_subscribed"`, show "You're already signed up." Keep the message visible (don't dismiss).
- On duplicate (429): "You've already signed up. We'll be in touch!"
- On error: "Something went wrong. Please try again." with retry button
- Below form: "Currently available: Wellington" link list
| `RateLimitError` | `Clock` | Too many requests | Wait message |
| `StaleCacheBanner` | `AlertTriangle` | Cached data > 7 days | Inline banner |

### 4J. Map Components (MapPopup, MapControls, PropertyPin, MapLegend)

**`MapPopup.tsx`** — Mini-preview on parcel tap (map exploration flow):
- Desktop: MapLibre popup positioned adjacent to tapped parcel polygon
- Mobile: bottom sheet snaps to peek (148px) with same content
- Content: address, composite score + rating label, top 4 category score circles, notable findings (any indicator 60+), "View Full Report" CTA
- Data: lightweight API call `GET /api/v1/property/{id}/summary` (< 200ms)
- Multi-unit variant: if parcel has >4 addresses at same coords, show base street address + "N units at this address" + "View Building Report" CTA. Do NOT list individual units.
- Parcel identification: `map.queryRenderedFeatures(point, { layers: ['parcels'] })` — only works at zoom >= 12 (parcels minzoom). Below zoom 12, tap does nothing.

**`MapControls.tsx`** — Floating control cluster:
- Position: bottom-right of map (desktop), top-right (mobile — avoids bottom sheet overlap)
- Buttons: Zoom in (+), Zoom out (-), Locate me (geolocation), Satellite toggle
- All buttons: 44x44px hit target, `rounded-lg`, glass effect background, `shadow-sm`
- Locate me: uses `navigator.geolocation.getCurrentPosition()` — if denied, button dims with tooltip "Location access denied"
- Satellite toggle: switches LINZ basemap style (`topolite-v2` ↔ `aerial`)

**`PropertyPin.tsx`** — Selected property marker:
- Custom MapLibre marker at selected property coordinates
- Teal (#0D7377) pin icon, 32px, with subtle drop shadow
- Bounce animation on placement: CSS keyframe 600ms (translateY -20px → 0 with ease-out)
- `prefers-reduced-motion`: no bounce, instant placement
- Removed when property is deselected or new property selected

**`MapLegend.tsx`** — Floating collapsible panel showing ONLY active layers:
- Desktop: bottom-left of map, 16px from edges, 240px wide, max-height 300px with internal scroll, glass effect background
- Mobile: collapsed single-line above bottom sheet ("Legend: Flood Zones, Fault Lines"), tap to expand to max 50% viewport height. Auto-collapses when bottom sheet passes half snap.
- Only shows entries for layers currently toggled ON
- Each entry: color swatch (20x14px rectangle showing fill + pattern) + label text
- Grouped by layer category with `Separator` between groups
- Collapse toggle: `ChevronDown`/`ChevronUp` in header, minimizes to title bar only
- Legend items per layer defined in UX spec (17 layer types with swatches + labels)

### 4K. Tablet Layout

**`TabletPanel.tsx`** (640-1023px): Push-style side panel:
- Width: 320px fixed, slides in from right edge
- Map compresses to fill remaining width (push layout, not overlay)
- Toggle button: `ChevronLeft`/`ChevronRight` icon (44x44px) on panel's left edge, always visible
- Panel content: search bar at top, report content scrollable below, layer controls in collapsible section
- When panel is closed: floating search bar + layer chip bar appear over the map (same layout as mobile)
- Animation: 300ms slide, `ease-out`
- Reference: UX spec responsive layout section

### 4L. Cookie/Analytics Consent

`AnalyticsConsent.tsx`: Bottom banner on first visit. "We use anonymous analytics. No personal data." + "OK, got it" button. Stored in localStorage. Links to /privacy. Non-blocking.

### 4M. Key Takeaways + Report CTAs

`KeyTakeaways.tsx` renders at the bottom of every report, below the accordion sections. Auto-generated from the report data:

| Element | Logic |
|---------|-------|
| "Things to investigate" | Any indicator scoring 60+ (High/Very High). `AlertTriangle` icon, `border-l-4 border-accent-hot`. Each item includes an action step ("Ask the landlord about...") |
| "Things that look good" | Any indicator scoring ≤20 (Very Low), capped at 3. `CheckCircle2` icon, `border-l-4 border-success` |
| Zero concerns | "No significant concerns identified across [N] indicators. This property has a clean risk profile." |
| Confidence | "85% (23 of 27 indicators available)" — from coverage count |

**CTA button row** (below takeaways):

| Button | Type | Behavior |
|--------|------|----------|
| Search Another Address | Primary | See "Search Another" flow below |
| Share Report | Secondary | Web Share API on mobile (native sheet), copy-link fallback on desktop |
| Export PDF | Secondary (premium) | See PDF export spec below |

**PDF export architecture:**
- **Generator:** FastAPI backend endpoint `GET /api/v1/property/{id}/export/pdf` (behind rate limit: 5/hour per IP)
- **Approach:** Returns self-contained printable HTML with `@media print` CSS. User clicks "Print / Save as PDF" button in the page (or Ctrl+P). No `weasyprint` dependency needed for POC — avoids GTK/Pango system deps on Windows. Can upgrade to server-side PDF generation later.
- **Content:** Single-page HTML with address, composite score badge, category score table, hazards list, market summary, property info, planning zone, AI summary, disclaimer. **Multi-unit:** If `is_multi_unit`, include "Unit in a [N]-unit building" note below address. CV/LV labeled as "Unit valuation". `UnitComparisonTable` included as a compact table in the Market section (all siblings, no sort interaction — static snapshot).
- **Styling:** Inline CSS with `@media print` rules — hides the print button, sets page margins, uses system fonts.
- **Frontend trigger:** "Export PDF" button → `window.open('/api/v1/property/{id}/export/pdf')` (browser opens printable HTML page)
- **Premium gate:** If not beta period, backend checks premium status before generating. Returns 403 if not authorized.

Mobile: stacked full-width buttons (12px gap). Desktop: horizontal auto-width row (8px gap).

**"Search Another Address" flow:**
1. `searchStore.clearSelection()` — clears selected address
2. `mapStore` resets `selectedPropertyId` to null — removes PropertyPin
3. Desktop: report panel slides out (300ms). Map expands to full width.
4. Mobile: bottom sheet snaps to peek, content replaced by empty state / recent searches
5. Search bar focuses (auto via `inputRef.current?.focus()`) — cursor in input, ready to type
6. Map viewport stays at current position (don't reset to default Wellington view)
7. URL changes from `/property/[id]` back to `/` via `router.push('/')`

**Bookmark flow:**
- `PropertySummaryCard` renders `Bookmark` (unsaved) or `BookmarkCheck` (saved) icon button
- On click: toggle bookmark state via `useSavedProperties` hook
- Visual feedback: icon swaps instantly (optimistic), `Sonner` toast appears: "Property saved" or "Bookmark removed" (2s auto-dismiss)
- Saved data: `{ addressId, fullAddress, score, rating, isMultiUnit, savedAt }` stored in localStorage via `writeJSON`
- Landing page: if `useSavedProperties().items.length > 0`, render `SavedProperties` section below search bar
- Compare feature: V2 scope — bookmarks are purely for quick re-access in MVP

### 4N. Loading & Skeleton States

All loading states use shadcn `Skeleton` shaped to match final content. No generic spinners.

| State | Skeleton Pattern |
|-------|-----------------|
| Initial page load | Search bar skeleton + map placeholder (`bg-border`) with centered `Loader2` (24px) |
| Report loading | See `ReportSkeleton` below |
| Accordion expand | `Loader2` (16px) replaces score badge in header + 2-col card skeletons matching indicator card dimensions |
| Map layer loading | Chip icon replaced by `Loader2` (14px). Tiles fade in 400ms. If >3s: warning dot + toast |

**`LoadingSkeleton.tsx`** — Generic shimmer skeleton shapes (used across all skeletons):
```typescript
// components/common/LoadingSkeleton.tsx
// Exports shape presets that wrap shadcn Skeleton with consistent sizing:
//
// <SkeletonText width="60%" />       — single text line, h-4, rounded
// <SkeletonText width="40%" />       — shorter line
// <SkeletonCircle size={36} />       — circle (for score circles)
// <SkeletonRect w="100%" h={48} />   — rectangle (for accordion bars, cards)
// <SkeletonArc />                    — 200x200 circle outline (score gauge placeholder)
//
// All shapes: bg-border, shimmer animation:
//   @keyframes shimmer { 0% { opacity: 0.4 } 50% { opacity: 1 } 100% { opacity: 0.4 } }
//   animation: shimmer 1.5s ease-in-out infinite
// prefers-reduced-motion: no shimmer, static 60% opacity
```

**`ReportSkeleton.tsx`** — Full report loading skeleton (matches report panel layout exactly):
```typescript
// components/common/ReportSkeleton.tsx
// Renders the skeleton version of the full report panel:
//
// Layout (mirrors PropertyReport panel order):
//   1. Address bar:      SkeletonText w="70%" (address) + SkeletonText w="40%" (metadata)
//   2. Score gauge:      SkeletonArc (200x200 grey arc outline, no fill)
//   3. Score strip:      5x SkeletonCircle (36px) in a row, 8px gaps
//   4. AI summary:       4x SkeletonText (100%, 90%, 95%, 60%) in bg-teal-50 card
//   5. Nearby amenities: 6x SkeletonCircle (40px) in 3×2 grid
//   6. Coverage badge:   SkeletonText w="30%"
//   7. Accordion bars:   5x SkeletonRect (h=48, w=100%) with 8px gaps
//
// No interactive elements. Fades out when real content arrives (200ms opacity transition).
// Used by: app/property/[id]/loading.tsx (Next.js loading state)
//          PropertyReport.tsx (when usePropertyReport is loading)
```

### 4O. First-Use Hints & Announcement Banner

**First-use hints** (`useFirstUseHints.ts`): Contextual hints shown once per user, tracked in localStorage (`hint_score_seen`, `hint_accordion_seen`, etc.). No onboarding tour.

| Hint | Trigger | Content | Dismissal |
|------|---------|---------|-----------|
| Score explanation | First score gauge render | Tooltip: "This score combines 27 risk indicators. Lower is safer." | Auto-dismiss 5s or any interaction |
| Accordion hint | Report loads, no expand after 3s | Pulsing dot on first accordion + tooltip: "Tap to explore details" | First accordion expand |
| Layer hint | First map load | Tooltip on chip bar: "Toggle data layers to explore the map" | Auto-dismiss 5s or first chip tap |
| Show on map | First section with map data expanded | Brief highlight of "Show on Map" toggle | Toggle interaction |

All hints respect `prefers-reduced-motion` (no pulsing animation).

**Announcement Banner** (`AnnouncementBanner.tsx`): Admin-managed banner at the very top of every page, above header. 40px tall. Three variants: Info (`bg-primary-light`), Warning (`bg-amber-50`), Success (`bg-emerald-50`). Dismiss button stores banner ID in localStorage. Content managed via Admin Content tab.

**Report Disclaimer** (`ReportDisclaimer.tsx`): Persistent legal disclaimer at the very bottom of every report, below Key Takeaways, above footer. Non-dismissible. `bg-muted`, `text-xs text-secondary`, `Info` icon (14px). Collapsed to 2 lines by default: "This report is for informational purposes only. Data is sourced from NZ government agencies and may not reflect current conditions." + "Full disclaimer" ghost link expands to full text (risk scores are indicative, not financial/legal advice, always get professional advice). Content is hardcoded TSX — not admin-editable.

---

## Phase 5: Search & Integration

### 5A. SearchBar with Autocomplete

```typescript
// components/search/SearchBar.tsx
// - 200ms debounce
// - Min 3 chars, max 200 chars (reject silently beyond limit)
// - Max 8 results (desktop), 5-6 results (mobile)
// - Pin icon + bold matched portion (match highlighting uses text nodes, never innerHTML)
// - On select: flyTo zoom 17, load report
// - Abort controller: cancel in-flight requests on new keystroke
// - Input sanitization: strip HTML tags before sending to API
// - URL param validation: if navigating to /property/[id], validate id is a positive integer
//   before making API call. Non-numeric ids → redirect to landing page.
```

### 5A-1. SearchOverlay (Mobile Full-Screen Autocomplete)

```typescript
// components/search/SearchOverlay.tsx
// Mobile-only (< 640px) full-screen autocomplete overlay
//
// Props: none (reads from searchStore)
//
// Layout:
//   - Fixed full-screen overlay, z-50, bg-white (covers map entirely)
//   - Top: 56px search bar with auto-focus input + "Cancel" text button (right)
//   - Below: results list OR recent searches (when input empty)
//   - Results: max 5-6 items (smaller viewport), each 56px row with MapPin icon + address
//   - Recent searches: "Recent" header + list from useRecentSearches + "Clear all" ghost button
//   - Keyboard: overlay MUST appear ABOVE the virtual keyboard (position: fixed handles this)
//
// Interactions:
//   - Opens when: searchStore.openOverlay() fires (mobile search bar tap)
//   - Closes when: result selected, "Cancel" tapped, or back button (popstate)
//   - On result select: searchStore.selectAddress() → closeOverlay → triggers 5B flow
//   - Escape key: closeOverlay (for external keyboards)
//   - Input auto-focuses on mount — keyboard opens immediately
//
// Animation: slide up from bottom, 200ms ease-out. Dismiss: fade out 150ms.
```

### 5A-2. RecentSearches & SavedProperties Components

**`RecentSearches.tsx`:**
```typescript
// components/search/RecentSearches.tsx
// Props: onSelect: (result: SearchResult) => void
//
// Reads from useRecentSearches hook. Renders list of recent addresses.
// Each row: MapPin icon (16px) + full address + score badge (colored) + relative time ("2h ago")
// "Clear all" ghost button at bottom — calls clearAll() from hook
// Empty state: hidden (don't show "No recent searches" — just show nothing)
```

**`SavedProperties.tsx`:**
```typescript
// components/search/SavedProperties.tsx
// Props: onSelect: (result: SearchResult) => void
//
// Reads from useSavedProperties hook. Renders bookmarked properties on landing page.
// Each row: BookmarkCheck icon (16px) + full address + score badge
// Swipe to remove (mobile) or X button (desktop) — calls remove(addressId)
// Empty state: hidden on landing page. If user has no saved properties, section not rendered.
// Max 20 items (enforced by hook). Newest first.
```

### 5B. Full User Flow — Post-Selection Animation Sequence

Precise timing from `SEARCH-GEOCODING-RESEARCH.md` §Frontend and `MOBILE-UX-RESEARCH.md` §2:

```
0ms      Dismiss keyboard (mobile), clear autocomplete overlay
0ms      Start API call: GET /property/{id}/report
0-1200ms Map flyTo (zoom 17, duration: TIMING.MAP_FLY_TO)
800ms    Pin bounce animation starts (CSS keyframe, 600ms)
1000ms   Desktop: report panel slides in from right (300ms, ease-out)
         Mobile: bottom sheet snaps from peek → half (Vaul snap)
~50ms    API response arrives (report + scores)
1000ms   ScoreGauge arc fills (1000ms, spring easing)
1080ms   ScoreStrip bars stagger in (5 × 80ms delay)
1200ms   AISummaryCard fades in (200ms)
1400ms   Accordion headers visible, lazy-load armed via IntersectionObserver
         (prefetch first 2 sections, lazy-load rest with 200px rootMargin)
```

**Search result response MUST include `lng`/`lat`** in every result — this enables zero-latency `flyTo` without a second geocoding call. Already available from `addresses.gd2000_xcoord` / `gd2000_ycoord`.

**Mobile autocomplete:** Full-screen overlay (not inline dropdown), max 5-6 results, recent searches shown when input focused but empty. Reference: `MOBILE-UX-RESEARCH.md` §2.

**Pre-loaded demo** (Phase 6A): On first visit (no `recent_searches` in localStorage), auto-load 162 Cuba Street report with flood zones + school zones visible on map. Shows the "aha moment" in < 5 seconds. Subtle label above report: "Demo property — search your own address above" (`text-xs text-secondary`, `bg-muted`, dismissible). Demo address configurable via Admin Content tab.

**Known spatial simplification:** All proximity uses Euclidean distance (`ST_DWithin`), not network/road distance. This is a known V2 enhancement — accurate enough for urban areas, less so for hilly terrain or divided roads.

### 5C. Map-Tap Exploration Flow

Users can explore properties by tapping parcels directly on the map (without searching). This is a discovery flow complementing the search flow in 5A.

**Flow:**
1. User taps/clicks on a parcel polygon (zoom >= 12, parcels layer must be active)
2. `map.queryRenderedFeatures(point, { layers: ['parcels'] })` identifies the tapped parcel
3. Extract `address_id` from feature properties
4. **Desktop:** Show `MapPopup` adjacent to parcel polygon
5. **Mobile:** Bottom sheet snaps to peek (148px) with same content as popup
6. Fetch lightweight data: `GET /api/v1/property/{id}/summary` (< 200ms, see BACKEND-PLAN.md §2C-1)
7. Display: address, composite score + rating, top 4 category circles, notable findings (score 60+)
8. "View Full Report" CTA → triggers full post-selection flow (5B): flyTo + full report load

**Edge cases:**
- Tap below zoom 12 (parcels not visible): nothing happens
- Tap on parcel with no address: "No address data available" in popup
- Multi-unit parcel (>4 units): show base street address + "N units" + "View Building Report" CTA
- Tap while report is open: on desktop, close report panel (300ms slide-out), show new MapPopup. On mobile, snap bottom sheet from full/half to peek, replace content with new popup data. Do NOT immediately load full report — let user click "View Full Report" CTA first. This prevents accidental taps from losing their current report.
- Rapid taps: debounce 200ms, abort in-flight summary requests

### 5D. URL Routing & Direct Navigation

`/property/[id]` supports direct links, browser refresh, and shared URLs via Next.js App Router.

```typescript
// app/property/[id]/page.tsx
// Server component — provides SSR metadata for OG/social sharing

export async function generateMetadata({ params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) redirect('/');

  // Fetch minimal data server-side for OG tags
  const summary = await fetch(`${API_BASE}/property/${id}/summary`).then(r => r.json()).catch(() => null);
  if (!summary) return { title: 'WhareScore' };

  return {
    title: `${summary.full_address} | WhareScore`,
    description: `Risk score: ${summary.overall_score}/100. ${summary.notable_findings[0] ?? ''}`,
    openGraph: {
      title: `${summary.full_address} — WhareScore Report`,
      description: `Composite risk score: ${summary.overall_score}/100 (${summary.rating})`,
    },
  };
}

// Client component renders:
// 1. Parse id from URL params → validate positive integer
// 2. Invalid id → redirect to / (landing page)
// 3. Valid id → usePropertyReport(id) fetches full report
// 4. Map centers on property coordinates (from report response)
// 5. Browser back button returns to previous page (no special handling needed)
```

**Direct link scenarios:**
- Fresh visitor with `/property/123` URL → loads map + report simultaneously
- Shared link on social media → SSR metadata provides OG title/description (from `/summary`)
- Browser refresh → re-fetches report (TanStack Query handles caching)
- Invalid id (non-numeric, negative, not in DB) → redirect to landing page

### 5E. `useEmailSignup` Hook

Missing hook for the `OutOfCoverage` error component's email capture form:

```typescript
// hooks/useEmailSignup.ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { EmailSignupCreate } from '@/lib/types';

export function useEmailSignup() {
  return useMutation({
    mutationFn: async (data: EmailSignupCreate) => {
      const res = await apiFetch('/email-signups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;  // { status: "subscribed" | "already_subscribed" }
    },
    // No cache invalidation needed — fire-and-forget
    // On success: check response body `status` field (both return HTTP 201):
    //   "subscribed" → "Thanks! We'll notify you when we expand to [region]."
    //   "already_subscribed" → "You're already signed up. We'll be in touch!"
    // On rate limit (HTTP 429): "Please wait before signing up again."
  });
}
```

### 5F. Hook Specifications

All TanStack Query hooks follow a consistent pattern: `queryKey` includes all params, `staleTime: 5 * 60 * 1000` (5 min), `retry: 2`. Mutations use `onSuccess`/`onError` for UI feedback via Sonner toasts.

**`useRecentSearches.ts`** — localStorage-backed recent searches:
```typescript
// hooks/useRecentSearches.ts
import { readJSON, writeJSON } from '@/lib/storage';
import { MAX_RECENT_SEARCHES } from '@/lib/constants';

interface RecentSearch {
  addressId: number;
  fullAddress: string;
  score: number | null;
  rating: string | null;
  timestamp: number;       // Date.now()
}

export function useRecentSearches() {
  const [items, setItems] = useState<RecentSearch[]>(() => {
    const raw = readJSON<RecentSearch[]>('recent_searches', []);
    // Validate each entry: must have addressId (number) + fullAddress (string)
    return raw.filter(r =>
      typeof r.addressId === 'number' &&
      typeof r.fullAddress === 'string'
    ).slice(0, MAX_RECENT_SEARCHES);
  });

  const add = useCallback((search: Omit<RecentSearch, 'timestamp'>) => {
    setItems(prev => {
      const filtered = prev.filter(r => r.addressId !== search.addressId);
      const next = [{ ...search, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      writeJSON('recent_searches', next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    writeJSON('recent_searches', []);
  }, []);

  return { items, add, clearAll };
}
// Called by: SearchBar on result selection (add), SearchOverlay (display), landing page (display)
```

**`useSavedProperties.ts`** — localStorage-backed bookmarks:
```typescript
// hooks/useSavedProperties.ts
import { readJSON, writeJSON } from '@/lib/storage';
import { MAX_SAVED_PROPERTIES } from '@/lib/constants';

interface SavedProperty {
  addressId: number;
  fullAddress: string;     // LINZ format includes unit (e.g. "1/45 Cuba Street, Te Aro")
  score: number;
  rating: string;
  isMultiUnit: boolean;    // show "Unit" badge on landing page saved list
  savedAt: number;         // Date.now()
}

export function useSavedProperties() {
  const [items, setItems] = useState<SavedProperty[]>(() => {
    const raw = readJSON<SavedProperty[]>('saved_properties', []);
    return raw.filter(r =>
      typeof r.addressId === 'number' &&
      typeof r.fullAddress === 'string'
    ).slice(0, MAX_SAVED_PROPERTIES);
  });

  const toggle = useCallback((prop: Omit<SavedProperty, 'savedAt'>) => {
    setItems(prev => {
      const exists = prev.some(p => p.addressId === prop.addressId);
      const next = exists
        ? prev.filter(p => p.addressId !== prop.addressId)
        : [{ ...prop, savedAt: Date.now() }, ...prev].slice(0, MAX_SAVED_PROPERTIES);
      writeJSON('saved_properties', next);
      return next;
    });
  }, []);

  const isSaved = useCallback((addressId: number) =>
    items.some(p => p.addressId === addressId), [items]);

  const remove = useCallback((addressId: number) => {
    setItems(prev => {
      const next = prev.filter(p => p.addressId !== addressId);
      writeJSON('saved_properties', next);
      return next;
    });
  }, []);

  return { items, toggle, isSaved, remove };
}
// Called by: PropertySummaryCard (toggle), SavedProperties landing section (display, remove)
```

**`usePropertyDetection.ts`** — Auto-detect property type from report data:
```typescript
// hooks/usePropertyDetection.ts
// This hook does NOT call a separate endpoint — it reads property_detection
// from the PropertyReport response (computed server-side in services/property_detection.py).
//
// Usage:
//   const report = usePropertyReport(addressId);
//   const detection = usePropertyDetection(report.data?.property_detection);
//
// Returns:
//   { detectedType, detectedBedrooms, isMultiUnit, unitCount, showBanner,
//     buildingAddress, siblingValuations, hasSiblings }
//
// Logic:
//   - If property_detection is null: return all nulls (no auto-detection available)
//   - detectedType maps to PillToggleGroup pre-selection in RentComparisonFlow
//   - detectedBedrooms maps to BedroomSelector pre-selection
//   - isMultiUnit: if true, render BuildingInfoBanner in PropertySummaryCard
//   - "(detected)" label: append to the pre-selected pill's label text
//   - User can always override detection by clicking a different pill
//   - siblingValuations: array of other units' valuations at same building (for UnitComparisonTable)
//   - hasSiblings: true when siblingValuations has 2+ entries (convenience flag)
//   - buildingAddress: base street address for BuildingInfoBanner display
//
// This is a thin hook — it just reads data, no API calls, no side effects.
export function usePropertyDetection(detection: PropertyDetection | null) {
  const siblings = detection?.sibling_valuations ?? null;
  return {
    detectedType: detection?.detected_type ?? null,
    detectedBedrooms: detection?.detected_bedrooms ?? null,
    isMultiUnit: detection?.is_multi_unit ?? false,
    unitCount: detection?.unit_count ?? null,
    showBanner: detection?.is_multi_unit ?? false,
    buildingAddress: detection?.base_address ?? null,
    siblingValuations: siblings,
    hasSiblings: (siblings?.length ?? 0) >= 2,
  };
}
```

**`useFirstUseHints.ts`** — localStorage-tracked onboarding hints:
```typescript
// hooks/useFirstUseHints.ts
import { readJSON, writeJSON } from '@/lib/storage';

// localStorage keys — all boolean flags
const HINT_KEYS = {
  score: 'hint_score_seen',
  accordion: 'hint_accordion_seen',
  layer: 'hint_layer_seen',
  showOnMap: 'hint_show_on_map_seen',
} as const;

export function useFirstUseHints() {
  const [seen, setSeen] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (const [key, storageKey] of Object.entries(HINT_KEYS)) {
      const val = localStorage.getItem(storageKey);
      result[key] = val === 'true';  // non-boolean resets to false
    }
    return result;
  });

  const dismiss = useCallback((hint: keyof typeof HINT_KEYS) => {
    setSeen(prev => ({ ...prev, [hint]: true }));
    localStorage.setItem(HINT_KEYS[hint], 'true');
  }, []);

  const shouldShow = useCallback((hint: keyof typeof HINT_KEYS) => !seen[hint], [seen]);

  return { shouldShow, dismiss };
}

// Hint trigger implementations:
//   Score:     useEffect in ScoreGauge — on mount, if shouldShow('score'),
//             show tooltip after 500ms delay, auto-dismiss after 5s or on any click
//   Accordion: useEffect in PropertyReport — setTimeout 3s after report loads,
//             if no accordion expanded yet AND shouldShow('accordion'), show pulsing dot
//             Dismiss: listen for first accordion expand event
//   Layer:    useEffect in MapContainer — on mount, if shouldShow('layer'),
//             show tooltip on chip bar after 1s delay, dismiss on first chip tap or 5s
//   ShowOnMap: useEffect in accordion section — on first expand of section with map data,
//             if shouldShow('showOnMap'), briefly highlight toggle (scale 1.1, 300ms)
//
// Pulsing dot animation:
//   @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.3); opacity: 0.7 } }
//   8px circle, bg-primary, positioned top-right of target element, animation: pulse 1.5s infinite
//   prefers-reduced-motion: no pulse, static dot
```

**`useFeedback.ts`** — Feedback submission mutation:
```typescript
// hooks/useFeedback.ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { FeedbackCreate } from '@/lib/types';

export function useFeedback() {
  return useMutation({
    mutationFn: (data: FeedbackCreate) =>
      apiFetch('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          page_url: window.location.href,
          browser_info: {  // Backend expects object, not string
            userAgent: navigator.userAgent,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
          },
        }),
      }),
    // On success: close FeedbackDrawer, show Sonner toast "Thanks for your feedback!"
    // On 429: show "Please wait before submitting again." inline
    // On error: show "Something went wrong. Please try again." inline, keep form open
  });
}
// Called by: BugReportForm, FeatureRequestForm, GeneralFeedbackForm
// Screenshot upload: use FormData instead of JSON if screenshot is attached
//   apiFetch('/feedback', { method: 'POST', body: formData, headers: {} })
//   (remove Content-Type header — browser sets multipart/form-data boundary automatically)
```

**`useAdminAuth.ts`** — Admin session management:
```typescript
// hooks/useAdminAuth.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useAdminAuth() {
  // Check if current session is valid (cookie-based)
  const session = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: () => apiFetch<{ authenticated: boolean }>('/admin/dashboard'),
    retry: false,
    staleTime: 60_000,  // re-check every 60s
  });

  const login = useMutation({
    mutationFn: (password: string) =>
      apiFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => session.refetch(),
    // On 401: "Incorrect password"
    // On 429: "Too many attempts. Wait {n} seconds."
  });

  const isAuthenticated = session.data?.authenticated ?? false;
  const isLoading = session.isLoading;

  return { isAuthenticated, isLoading, login };
}
// Called by: AdminAuthGate.tsx (wraps all /admin/* pages)
//
// Brute-force protection:
//   Client-side: track failed attempts in component state. After 3 failures,
//   disable password input + submit button for 30s (countdown timer).
//   Server-side: returns 429 after 10 failures per IP per hour.
```

---

## Admin Portal Frontend

**Scope:** Internal-only dashboard at `/admin/*`. Password-protected (single shared password, no user accounts). Not linked from any public UI — accessed by direct URL only. All data read from `/api/v1/admin/*` endpoints (see BACKEND-PLAN.md §2K).

### Admin-1. AdminAuthGate

```typescript
// components/admin/AdminAuthGate.tsx
// Wraps all admin page content. If not authenticated, shows login form.
//
// Layout:
//   Centered card (max-w-sm), WhareScore logo, "Admin Access" heading
//   Password input (type="password", max 128 chars), "Sign In" button
//   Error message below input (inline, text-destructive)
//   After 3 failed attempts: button disabled, countdown timer "Try again in {n}s"
//
// On success: cookie is set by backend (httpOnly, secure, sameSite strict, 24h expiry)
//   AdminAuthGate re-renders, useAdminAuth.isAuthenticated becomes true, children render
// On page load: useAdminAuth checks session by calling GET /admin/dashboard
//   If 401: show login form. If 200: render children.
```

### Admin-2. Admin Layout & Navigation

```typescript
// app/admin/layout.tsx
// Wraps all admin pages in a consistent shell:
//   - AdminAuthGate (blocks content until authenticated)
//   - Top bar: "WhareScore Admin" + "Sign Out" button (clears cookie via POST /admin/logout)
//   - Tab navigation: Dashboard | Analytics | Data Health | Feedback | Emails | Content
//   - Active tab: underline + font-semibold. Tabs map to sub-routes:
//     /admin          → Dashboard
//     /admin/analytics → Analytics
//     /admin/data-health → Data Health
//     /admin/feedback  → Feedback
//     /admin/emails    → Emails
//     /admin/content   → Content
//   - No AppHeader/AppFooter (admin is a separate shell)
//   - Responsive: tabs wrap to 2 rows on narrow screens, no mobile bottom sheet
```

### Admin-3. DashboardOverview

```typescript
// components/admin/DashboardOverview.tsx
// Data: useQuery(['admin', 'dashboard'], () => apiFetch('/admin/dashboard'))
//
// Layout: 2-row grid of stat cards + mini charts
//
// Row 1 — Key metrics (4 cards):
//   | Total Searches (24h) | count, sparkline trend (7 days) |
//   | Unique IPs (24h)     | count                           |
//   | Reports Generated    | count (24h), cache hit rate %   |
//   | Errors (24h)         | count, breakdown by type        |
//
// Row 2 — Lists:
//   | Top 10 Searched Addresses | address + count, last 7 days |
//   | Recent Errors             | timestamp + endpoint + status code, last 20 |
//
// Each stat card: shadcn Card, value in text-3xl font-bold tabular-nums,
//   label in text-sm text-secondary, optional trend arrow (TrendingUp/Down)
// Sparklines: tiny Recharts LineChart, 80x24px, no axes, primary color
// Auto-refresh: refetchInterval: 30_000 (30s)
```

### Admin-4. AnalyticsPanel

```typescript
// components/admin/AnalyticsPanel.tsx
// Data: useQuery(['admin', 'analytics'], () => apiFetch('/admin/analytics'))
//   (Note: /admin/analytics endpoint needs to be added to BACKEND-PLAN.md
//    if not already present — returns time-series aggregates)
//
// Charts (Recharts):
//   1. Search volume — BarChart, daily, last 30 days
//   2. Top suburbs — horizontal BarChart, top 20 suburbs by search count
//   3. Report generation — LineChart, daily, success vs error
//   4. Coverage distribution — pie chart: searches inside vs outside coverage area
//
// Filters: date range picker (last 7d / 30d / 90d / All), city filter
// All charts: CHART_THEME applied, responsive (flex-wrap grid, 2-col desktop, 1-col mobile)
```

### Admin-5. DataHealthPanel

```typescript
// components/admin/DataHealthPanel.tsx
// Data: useQuery(['admin', 'data-health'], () => apiFetch('/admin/data-health'))
//
// Layout: table of data sources with health status
//
// Columns:
//   | Source Name | Records | Last Updated | Freshness | Status |
//   | LINZ Addresses | 2,403,583 | 2026-01-15 | 52 days ago | ⚠️ Stale |
//   | Crime Data | 1,153,994 | 2026-03-01 | 7 days ago | ✅ Fresh |
//
// Status logic:
//   Fresh (green CheckCircle2): updated within expected refresh interval
//   Stale (amber AlertTriangle): overdue by > 1.5x expected interval
//   Error (red XCircle): last refresh failed
//
// "Refresh Views" button: POST /admin/refresh-views — triggers materialized view refresh
//   Shows Loader2 spinner during refresh, success/error toast on completion
//
// Martin tile server status: ping /tiles/health, show "Tiles: Online/Offline"
// Redis status: from /admin/data-health response, show "Cache: Online/Offline"
```

### Admin-6. FeedbackPanel

```typescript
// components/admin/FeedbackPanel.tsx
// Data: useQuery(['admin', 'feedback'], () => apiFetch('/admin/feedback'))
//
// Layout: filterable table of feedback submissions
//
// Filters: type (Bug/Feature/General/All), status (New/In Progress/Resolved/All)
// Columns: | Date | Type | Status | Description (truncated 100 chars) | Email | Actions |
// Row click: expands to full description + all fields
//
// Status dropdown: shadcn Select with options: new, in_progress, resolved, wont_fix
//   On change: PATCH /admin/feedback/{id} with { status: newStatus }
//   Optimistic update: update UI immediately, revert on error
//   Error: Sonner toast "Failed to update status"
//
// Actions: "Delete" button (with confirmation dialog) — DELETE /admin/feedback/{id}
// Pagination: 20 items per page, "Load more" button (offset-based)
// CSV export: "Export CSV" button — client-side generation from loaded data
```

### Admin-7. EmailSignupsPanel

```typescript
// components/admin/EmailSignupsPanel.tsx
// Data: useQuery(['admin', 'emails'], () => apiFetch('/admin/emails'))
//
// Layout: table of email signups from OutOfCoverage form
// Columns: | Date | Email | City | Source |
// Sortable by date (default: newest first) and city
// Search/filter: text input filtering by email or city
//
// CSV export: "Export CSV" button — generates CSV client-side:
//   email,city,source,signed_up_at
//   Downloads as email-signups-{date}.csv
//
// Stats row above table: total signups, unique cities, signups this week
// Pagination: 50 items per page, offset-based
```

### Admin-8. ContentPanel

```typescript
// components/admin/ContentPanel.tsx
// Data: useQuery(['admin', 'content'], () => apiFetch('/admin/content'))
//
// Three sub-sections:
//
// 1. Announcement Banner management:
//   - Current banner: show/edit/delete. Fields: text, type (info/warning/success), active (toggle)
//   - "Create Banner" button → inline form: text input + type Select + "Save" Button
//   - On save: PUT /admin/content/announcement_banner
//   - Only one active banner at a time
//
// 2. Demo address configuration:
//   - Current: shows address ID + full address
//   - Edit: address ID input (positive integer) + "Update" button
//   - On save: PUT /admin/content/demo_address
//   - Validation: must be a valid address_id (server validates existence)
//
// 3. FAQ management:
//   - List of Q&A pairs, each with: question input, answer textarea, drag handle
//   - Reordering: drag-and-drop using @dnd-kit/sortable (lightweight, accessible)
//   - Add: "Add Question" button appends empty row at bottom
//   - Delete: X button per row (with confirmation if text exists)
//   - Save: "Save All" button → PUT /admin/content/faq with full ordered array
//   - No auto-save — explicit save prevents accidental partial updates
```

---

## Frontend Security

**Principle: Don't trust user input. Don't trust API responses. Don't trust localStorage.**

### Input Validation (all user-facing inputs)

| Input | Validation Rules | Error UX |
|-------|-----------------|----------|
| **Search bar** | Max 200 chars. Strip HTML tags before API call. Min 3 chars to trigger search. | Silent truncation at 200. No results shown below 3 chars. |
| **Rent input** | Numeric only (strip non-digits). Hard bounds: $50-$5,000/week. | Inline error with `AlertCircle`: "NZ rents are typically $100-$2,000/week." Red border. Compare button disabled. |
| **Email inputs** (feedback, out-of-coverage) | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Max 254 chars. Trim whitespace. | Inline error: "Please enter a valid email address." |
| **Feedback text fields** | Required: 10-2000 chars. Strip HTML tags before POST. Trim whitespace. | Inline char count. Error if < 10: "Please provide more detail." |
| **Screenshot upload** | Max 5MB. Accept: `image/png, image/jpeg, image/webp`. | Inline error: "File too large" or "Unsupported format." |
| **URL params** (`/property/[id]`) | Validate `id` is a positive integer (`/^\d+$/`). | Non-numeric → redirect to landing page. |
| **Admin password** | Max 128 chars. No other client-side rules (server validates). | "Incorrect password" on 401. Disable button for 5s after 3 failures. |

### XSS Prevention

- **Never use `dangerouslySetInnerHTML`** with any API data. All dynamic content rendered via JSX text nodes (React auto-escapes).
- **Search autocomplete highlighting**: bold matched portions using `<mark>` tags built from known query string positions, never from server-supplied HTML.
- **AI summary**: rendered as plain text (`<p>{summary}</p>`), never parsed as HTML/markdown.
- **Error messages from API**: display user-friendly fallback text, never raw server error messages (which may contain stack traces or SQL).

### API Communication (`lib/api.ts`)

```typescript
// lib/api.ts — fetch wrapper with security defaults

const API_BASE = '/api/v1';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'same-origin',  // send cookies for admin auth only
  });

  if (res.status === 429) {
    throw new RateLimitError(res.headers.get('Retry-After'));
  }
  if (res.status === 404) {
    throw new NotFoundError();
  }
  if (!res.ok) {
    // Never expose raw error body to UI — log it, show generic message
    const body = await res.text().catch(() => '');
    console.error(`API error ${res.status}: ${path}`, body);
    throw new ApiError(res.status, 'Something went wrong. Please try again.');
  }

  return res.json();
}

// Custom error classes for TanStack Query error handling
export class RateLimitError extends Error {
  retryAfter: number;
  constructor(retryHeader: string | null) {
    super('Rate limited');
    this.retryAfter = parseInt(retryHeader ?? '30', 10);
  }
}
export class NotFoundError extends Error {
  constructor() { super('Not found'); }
}
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
```

**TanStack Query error handling** — each hook maps error types to error components:

| Error Class | HTTP Status | Component | User Message |
|-------------|-------------|-----------|-------------|
| `RateLimitError` | 429 | `<RateLimitError />` | "You're making requests too quickly. Please wait {n} seconds." |
| `NotFoundError` | 404 | `<NotFoundError />` | "We couldn't find that address. Try searching again." |
| `ApiError` | 500, 502, 503 | `<NetworkError />` | "Something went wrong on our end. Please try again." |
| `ApiError` | 400 | *(inline error)* | "Invalid request. Please check your input." |
| `TypeError` (fetch) | N/A (offline) | `<NetworkError />` | "No internet connection. Check your network and try again." |
| `AbortError` | N/A (timeout) | `<TimeoutError />` | "This is taking longer than expected. Please try again." |
| Any unknown | Any | `<NetworkError />` | "Something went wrong. Please try again." |

**Section-level error handling** (accordion sections that fail independently):
- Each accordion section wraps its content in a React error boundary + TanStack Query error state
- On section fetch failure: show `<SectionError sectionName="Risk & Hazards" onRetry={refetch} />`
- `SectionError` displays: `AlertTriangle` icon + "Couldn't load {sectionName}" + "Retry" ghost button
- TanStack Query retry: `retry: 2`, `retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000)` (1s, 2s)
- After 2 retries fail: section shows permanent error state with manual retry button
- Other sections continue to work — failures are isolated per section
- Never show raw API error text — `ApiError.message` is always the user-friendly fallback

### localStorage Safety

```typescript
// lib/storage.ts — safe localStorage read/write

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Validate structure matches expected shape (prevents tampered data from crashing app)
    if (typeof parsed !== 'object' && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    // Corrupted data — reset to fallback
    localStorage.removeItem(key);
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full — silently fail (non-critical feature)
  }
}
```

- Recent searches: max 10 entries, validate each has `addressId` (number), `address` (string), `score` (number). Purge invalid entries on read.
- Saved properties: max 20 entries. Same validation pattern.
- Hints: boolean flags only (`hint_score_seen`, etc.). Non-boolean values reset to `false`.
- Analytics consent: boolean. Non-boolean resets to `false` (re-shows banner).
- Layer preferences: `Record<string, boolean>`. Saved on each `toggleLayer()` call. Restored on app mount into `mapStore.layers`. Reset to `{ parcels: true }` only when user clicks "Reset layers" (if added) or clears site data. Layer preferences persist across address changes — if user enables flood zones, they stay visible when switching properties.

### External Links

- All `target="_blank"` links must include `rel="noopener noreferrer"` — prevents `window.opener` access.
- Google Street View link: construct URL from validated lat/lng numbers only. Pattern: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`. If either coordinate is NaN/undefined, omit link entirely.

### Admin Portal Security

- Password entry: max 3 attempts before 30s lockout (client-side timer + server returns 429).
- Session cookie: `httpOnly`, `secure` (HTTPS only), `sameSite: 'strict'`, 24h expiry. Set by backend, not JavaScript.
- All admin mutations (status changes, content updates, banner edits) use POST/PATCH with the session cookie — CSRF protection via `sameSite: 'strict'` cookie + `Content-Type: application/json` (blocks form-based CSRF).
- Admin routes (`/admin/*`) are not linked from any public UI — accessed by direct URL only.

### Rate Limit Handling

When backend returns 429:
- Search: show "Slow down a bit" inline below search bar, disable input for `Retry-After` seconds.
- Report: show `<RateLimitError />` full-page with countdown timer on retry button.
- Feedback: disable submit button, show "Please wait before submitting again."
- Rent contribution: show "You've already contributed today. Thanks!" inline.
- Admin: show lockout message with countdown.

---

## Key Best Practices

### Frontend
- **Code-split sections** — each accordion section is a lazy-loaded component (`React.lazy` + `Suspense`)
- **TanStack Query** — automatic caching, stale-while-revalidate, retry logic (max 3 retries, exponential backoff)
- **Abort controller** — cancel in-flight search requests on new keystroke
- **Debounce** — 200ms on search, 300ms on viewport changes
- **Skeleton loaders** — match exact layout of loaded content (no generic spinners)
- **tabular-nums** — all numerical displays use `font-variant-numeric: tabular-nums`
- **Error boundaries** — React error boundary wrapping report panel and each accordion section (isolates failures)
- **No `dangerouslySetInnerHTML`** — all dynamic content rendered as text nodes
- **Strict CSP** — Content Security Policy headers in `next.config.ts` (see §3B)

### Type Safety
- FastAPI auto-generates OpenAPI spec
- Consider `openapi-typescript` to generate frontend types from spec
- Or maintain shared type definitions manually (simpler for solo dev)
- All API response types defined in `lib/types.ts` — validate shape matches expectations at runtime for critical paths (report data)

---

## Backend-Frontend API Contract — Corrections Applied

The following mismatches between this frontend plan and the actual backend implementation were identified and corrected:

### Field Name Corrections (updated in types above)

| Frontend (was) | Backend (actual) | Location |
|---|---|---|
| `RentReportCreate.weekly_rent` | `reported_rent` | `POST /api/v1/rent-reports` |
| `RentReportCreate.bedrooms: number` | `bedrooms: string` (`"1"\|"2"\|"3"\|"4"\|"5+"`) | Same |
| `EmailSignupCreate.city` | `requested_region` | `POST /api/v1/email-signups` |
| `EmailSignupCreate.source` | *(removed — not in backend schema)* | Same |
| `FeedbackCreate.browser_info: string` | `browser_info: Record<string, unknown>` (object) | `POST /api/v1/feedback` |

### Email Signup Duplicate Handling

Backend returns HTTP **201** with `{"status": "already_subscribed"}` for duplicate signups — NOT HTTP 429. Frontend must check the response body `status` field, not the HTTP status code.

### New Backend Endpoints (implemented)

**`GET /api/v1/property/{address_id}/summary`** — Lightweight summary for map popups and SSR metadata (< 200ms target). Returns:
```json
{
  "address_id": 2404283,
  "full_address": "1/9 Gibbons Street, Upper Hutt Central, Upper Hutt",
  "suburb": "Upper Hutt Central",
  "city": "Upper Hutt",
  "sa2_name": "Elderslea",
  "unit_type": null,
  "scores": { "composite": 33.9, "rating": "Low" },
  "median_rent": 615,
  "notable_findings": ["High hazards risk", "Low liveability risk"]
}
```
Rate limit: 60/minute. Tries cached full report first, falls back to minimal DB query.

**`GET /api/v1/property/{address_id}/export/pdf`** — Printable HTML report with `@media print` CSS. Returns `text/html`. User clicks "Print / Save as PDF" button or uses Ctrl+P. Rate limit: 5/hour.

### Implementation Notes for Frontend

1. **Rent report `bedrooms` dropdown** must send string values (`"1"`, `"2"`, `"3"`, `"4"`, `"5+"`) — not numbers.
2. **Email signup form** only needs `email` + `requested_region` fields. No `source` field.
3. **Feedback `browser_info`** should be sent as an object: `{ userAgent, screenWidth, screenHeight }`.
4. **PDF export** opens in new tab via `window.open()` — user sees printable HTML with a "Print / Save as PDF" button.
5. **Map popup** uses `GET /property/{id}/summary` — fast, no PL/pgSQL function call. Falls back to cached report data when available.
6. **Report response `scores.rating`** is an object `{ label: string, color: string }` — extract `.label` for display text.

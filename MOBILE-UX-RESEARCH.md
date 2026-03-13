# WhareScore Mobile UX Research

**Date:** 2026-03-02
**Purpose:** Detailed interaction design patterns for mobile-first map + report UI

---

## 1. Mobile Map + Report Interaction Model

### Bottom Sheet vs Side Drawer vs Full-Screen Toggle

**Bottom sheet is the industry standard.** Every major map-based app (Google Maps, Apple Maps, Uber, Airbnb, Zillow, Redfin) uses the bottom sheet pattern on mobile. Side drawers are for navigation menus, not map detail panels. Full-screen toggles lose map context entirely.

**Why bottom sheet wins for WhareScore:**
- Thumb-friendly: primary interaction zone is the bottom 40% of the screen (the "thumb zone")
- Maintains map visibility at peek/half states, preserving spatial context
- Non-modal variant allows simultaneous map interaction
- Natural for progressive disclosure of complex data (35+ layers)

### Recommended Breakpoints

Based on 2025-2026 device analytics, these are the widths that matter:

| Breakpoint | Target | Layout |
|------------|--------|--------|
| 320px | iPhone SE, small Android | Single column, minimal chrome |
| 360px | Most mid-range Android (50%+ global share) | Single column |
| 375px | iPhone 12/13/14/15 base | Single column |
| 390-393px | iPhone 14/15/16 Pro, iPhone 17 | Single column |
| 412-430px | Large Android flagships, foldables | Single column, slightly wider cards |
| 768px | iPad portrait, tablets | Split view: map left, report right |
| 1024px | iPad landscape, small laptops | Split view with layer sidebar |
| 1440px | Desktop | Full layout: map + sidebar + report panel |

**Implementation recommendation:** Use 3-4 CSS breakpoints with container queries for component-level responsiveness:
```
--mobile: max-width 767px     (bottom sheet mode)
--tablet: 768px - 1023px      (split view, map top / report bottom or side-by-side)
--desktop: 1024px - 1439px    (three-panel layout)
--wide: 1440px+               (full dashboard layout)
```

### Bottom Sheet Snap Points

Three snap points are standard. Here are the specific values for WhareScore:

| Snap Point | Height | Use Case |
|------------|--------|----------|
| **Peek** | 120-148px (approximately 15-18% of viewport) | Shows property address, summary score, and "swipe up for details" hint. Map is fully interactive. |
| **Half** | 50% of viewport (or 355px on standard phones) | Shows key data sections (accordion headers visible). Map is partially visible and still interactive. |
| **Full** | 92-95% of viewport (not 100%) | Full report scroll. Leave 44-56px of map visible at top as a "sliver" for context (Google Maps does this). |

**Implementation with Vaul (React):**
```tsx
<Drawer.Root
  snapPoints={['148px', '355px', 1]}
  activeSnapPoint={activeSnap}
  setActiveSnapPoint={setActiveSnap}
  modal={false}  // critical: allows map interaction while sheet is open
  snapToSequentialPoint={true}  // prevents skipping snap points on fast swipe
>
  <Drawer.Handle />  {/* 32x4dp pill, tap to cycle snaps, double-tap to close */}
  <Drawer.Content>
    {/* Report sections here */}
  </Drawer.Content>
</Drawer.Root>
```

**Alternative library: react-modal-sheet** (built on Framer Motion/Motion):
```tsx
<Sheet
  snapPoints={[148, window.innerHeight * 0.5, window.innerHeight * 0.95]}
  initialSnap={0}
>
  <Sheet.Container>
    <Sheet.Header />  {/* drag handle area */}
    <Sheet.Content>{/* report */}</Sheet.Content>
  </Sheet.Container>
  <Sheet.Backdrop />  {/* only for modal mode */}
</Sheet>
```

### What Happens to the Map When Sheet Expands

- **Peek (120-148px):** Map occupies full screen minus peek height. Map is fully interactive (pan, zoom, tap pins). Map camera does NOT adjust.
- **Half (50%):** Map compresses to top 50%. Map camera should animate to re-center the selected property pin in the VISIBLE portion of the map (not the geometric center of the screen, but the center of the remaining visible map area). Map remains interactive.
- **Full (92-95%):** Map is a thin strip at top (44-56px visible). Map interaction is effectively disabled. The thin strip shows enough to maintain spatial context (you can still see the neighbourhood). Google Maps 2025 redesign specifically preserves this "sliver" of map.

**Map camera adjustment formula:**
When sheet is at 50%, the visible map center is at 25% from the top of the screen. The selected property pin should be positioned there, not at 50%. This means calling `map.panTo()` with an offset:
```ts
const sheetHeight = window.innerHeight * 0.5;
const mapVisibleHeight = window.innerHeight - sheetHeight;
const targetCenter = mapVisibleHeight / 2;
map.easeTo({
  center: propertyLatLng,
  padding: { bottom: sheetHeight },
  duration: 300
});
```

### Touch Gesture Conflicts: Map Pan vs Sheet Drag

This is the hardest UX problem. Here is the resolution strategy:

**Gesture Disambiguation Rules:**
1. **Drag handle zone (top 48px of sheet):** ALWAYS controls sheet. Map gestures disabled in this region.
2. **Sheet content area (below handle):**
   - If sheet is at peek or half: vertical drag on content area controls sheet position
   - If sheet is at full: vertical drag scrolls sheet content internally (standard scroll behavior)
3. **Map area (above sheet):** ALWAYS controls map. Sheet does not respond to touches in the map region.
4. **Velocity threshold:** If user swipes vertically with velocity > 500px/s on sheet content, it snaps to next/previous snap point rather than scrolling.

**Implementation approach:**
```tsx
// Pseudo-code for gesture disambiguation
const handleTouchStart = (e) => {
  const touchY = e.touches[0].clientY;
  const sheetTop = sheetRef.current.getBoundingClientRect().top;
  const handleZoneBottom = sheetTop + 48; // 48px drag handle zone

  if (touchY < sheetTop) {
    // Touch is on map — let map handle it
    setGestureTarget('map');
  } else if (touchY < handleZoneBottom) {
    // Touch is on drag handle — sheet controls
    setGestureTarget('sheet');
  } else {
    // Touch is on sheet content
    if (activeSnap === 'full') {
      setGestureTarget('scroll'); // scroll content
    } else {
      setGestureTarget('sheet'); // drag sheet
    }
  }
};
```

### How Major Apps Handle Map+Panel on Mobile

| App | Pattern | Peek Height | Half State | Full State | Notable |
|-----|---------|-------------|------------|------------|---------|
| **Google Maps** | Persistent non-modal bottom sheet | ~120px (address + rating) | ~50% (place details) | ~95% (full info, reviews) | 2025 redesign: more rounded corners, removed back button, added X close button, preserved map "sliver" at top |
| **Apple Maps** | Persistent bottom sheet with 3 snaps | ~100px (search bar) | ~45% (results list) | ~90% (full detail) | Sheet cannot be fully dismissed, only minimized |
| **Uber** | Modal bottom sheet for ride details | ~160px (pickup summary) | ~50% (ride options) | ~85% (full ride details) | Sheet animates map camera when expanding |
| **Airbnb** | List/Map toggle on mobile (not split view) | N/A | N/A | N/A | Mobile separates list and map views entirely; bottom sheet only for individual listing detail |
| **Zillow** | Split view: map top, list bottom | Map ~40%, list ~60% | N/A | Full-screen listing page | List auto-updates as map pans. Tap listing = full detail page |
| **Redfin** | Same as Zillow pattern | Map ~40%, list ~60% | N/A | Full-screen listing page | "Search this area" button appears after map pan |

**WhareScore recommendation:** Follow Google Maps pattern (persistent non-modal bottom sheet with 3 snap points) since WhareScore is a single-property intelligence tool, not a listing browser. The user searches ONE address and gets a detailed report.

---

## 2. Mobile Search Experience

### Search Bar Placement

**Recommendation: Fixed top search bar, NOT part of bottom sheet.**

Rationale:
- Search is the primary action — it must be immediately accessible
- Google Maps 2025 redesign REMOVED search from the bottom sheet and kept it at top
- Fixed top placement is familiar from every map app
- On mobile, the search bar should be 48px tall with 12px padding (72px total header area)

**Layout:**
```
[Search bar - fixed top, 48px]     ← always visible
[Map - fills remaining space]       ← main content
[Bottom sheet - peek at bottom]     ← report data
```

### Autocomplete Dropdown on Mobile

**Overlay pattern, NOT inline:**
- Autocomplete results appear as a full-screen overlay or near-full overlay (below search bar)
- This avoids the problem of the soft keyboard consuming 50% of the screen
- Show maximum 5-6 results on mobile (not 10+ like desktop) — the keyboard already takes half the screen
- Bold the matched portion of each suggestion to differentiate from user-typed text
- Include the suburb/city as secondary text: "42 Smith Street" / "Ponsonby, Auckland"
- Show a map pin icon to the left of each result for scannability

**Implementation flow:**
1. User taps search bar -> search bar expands to full width, keyboard appears
2. User types -> autocomplete overlay appears ABOVE the keyboard
3. User taps a suggestion -> keyboard dismisses, overlay closes
4. Map flies to the property with a 1-2 second `flyTo` animation
5. Bottom sheet animates from zero to peek height (120-148px)
6. Property pin pulses/bounces on map for 1 second to draw attention

### Post-Search Animation Sequence

```
1. Dismiss keyboard + autocomplete overlay     [0ms]
2. Map flyTo animation to property             [0-1200ms, ease-in-out]
3. Property pin appears with bounce animation  [800-1400ms]
4. Bottom sheet slides up to peek height       [1000-1400ms]
5. Peek shows: address, property type, key score [stable]
```

**flyTo parameters:**
```ts
map.flyTo({
  center: [lng, lat],
  zoom: 17,         // close enough to see property boundaries
  pitch: 0,         // flat view for data overlay clarity
  bearing: 0,       // north-up for consistency
  duration: 1200,   // milliseconds
  essential: true   // not affected by prefers-reduced-motion
});
```

### Back Button / Navigation Stack

Mobile navigation stack for WhareScore:
```
Home (search) -> Property View (map + sheet) -> [Section Detail]
                                              -> [Layer Settings]
                                              -> [Share]
```

**Back button behavior:**
- If bottom sheet is at full -> back button collapses to half
- If bottom sheet is at half -> back button collapses to peek
- If bottom sheet is at peek -> back button returns to search home (clears property)
- If autocomplete is open -> back button closes autocomplete
- If a sub-panel is open (layer settings) -> back button closes sub-panel

This matches the NNGroup recommendation of using the browser/device back button to collapse accordions and sheets progressively.

---

## 3. Layer Controls on Mobile

### The Problem

35+ data layers is far too many for a mobile layer picker. The desktop sidebar approach will not work.

### Horizontal Scrolling Chip Bar (Primary Control)

Follow the Google Maps filter chip pattern:

```
[Hazards] [Schools] [Transport] [Crime] [Demographics] [Planning] [More ▼]
```

**Specifications:**
- Chip height: 36px (Material Design chip spec)
- Chip horizontal padding: 12px
- Gap between chips: 8px
- Font size: 14px
- Bar position: immediately below the search bar, fixed position
- Bar height: 48px (36px chip + 6px top/bottom padding)
- Horizontal scroll with momentum scrolling (`-webkit-overflow-scrolling: touch`)
- Fade gradient on right edge (16px wide) to indicate more chips are available
- Maximum 7-8 visible chips at once on 375px width (the rest accessible by scrolling)
- Active chip gets filled background color; inactive gets outlined style

**Layer Preset Groups:**

| Chip | Layers Included | Default |
|------|----------------|---------|
| **Hazards** | Flood zones, fault lines, tsunami, landslide, coastal erosion, liquefaction | OFF |
| **Schools** | Primary schools, secondary schools, school zones, decile ratings | OFF |
| **Transport** | Bus routes, bus stops, train stations, cycle paths, road classifications | OFF |
| **Crime** | Crime heatmap, police stations, crime by type | OFF |
| **Demographics** | Population density, median income, age distribution, ethnicity | OFF |
| **Planning** | District plan zones, resource consents, heritage sites, designated areas | OFF |
| **Property** | Title boundaries, building footprints, contours, aerial imagery | ON (default) |
| **Neighbourhood** | Parks, shops, cafes, medical, community facilities | OFF |

### "More" Button / Layer Settings Panel

Tapping "More" or long-pressing any chip opens a full-screen modal layer picker:
- Grouped by category (matching the chips above)
- Toggle switches for individual layers within each group
- "Select All" / "Clear All" per group
- Layer opacity slider (0-100%) for each active layer
- Close button (X) at top right
- Apply button at bottom (sticky, 48px tall, full-width)

### Maximum Layers Recommendation

**Practical limit for mobile: 5-8 visible overlay layers simultaneously.**

This is not a hard rendering limit but a UX limit:
- More than 5-8 overlapping transparent layers become visually incomprehensible
- Each additional layer adds rendering cost (render time is a function of layer count x vertex count)
- Show a soft warning when user enables >6 layers: "Many layers enabled. Map may be slower."
- Automatically disable layer detail at lower zoom levels (e.g., building footprints only at zoom 16+)

**Zoom-based layer visibility thresholds:**
| Zoom Level | Visible Layer Types |
|------------|-------------------|
| 0-10 | Region-level data only (flood zones, demographics choropleth) |
| 11-14 | Suburb-level (school zones, bus routes, crime heatmap, planning zones) |
| 15-16 | Street-level (bus stops, property boundaries, building footprints) |
| 17-19 | Property-level (contour lines, title boundaries, individual features) |

---

## 4. Mobile Report Sections

### Accordion vs Horizontal Swipeable Cards

**Use accordion for the primary report structure, NOT horizontal cards.**

Why:
- WhareScore report sections have highly variable content lengths (some sections have 2 data points, crime has tables, schools has sorted lists)
- Horizontal cards force equal-width sections, wasting space for short sections and truncating long ones
- Accordions support progressive disclosure naturally — users see all section titles and open what interests them
- NNGroup confirms: accordions are the best pattern for mobile when displaying "unrelated content sections where users benefit from seeing overall structure before diving into details"
- Horizontal cards work for HOMOGENEOUS content (photo carousels, similar listings) but NOT for heterogeneous report sections

**Hybrid approach for WhareScore:**
```
Bottom sheet content:
├── Property Summary Card (always visible at peek)
│   ├── Address, property type, land area, floor area
│   └── Key scores (3-4 circular progress indicators, horizontal row)
├── Section Accordions (visible at half/full)
│   ├── [▸] Hazard Assessment         ← accordion
│   │   └── [horizontal card carousel of hazard types inside]
│   ├── [▸] Schools & Education       ← accordion
│   │   └── [sorted list with distance]
│   ├── [▸] Transport & Accessibility ← accordion
│   │   └── [walk score + nearest stops list]
│   ├── [▸] Crime & Safety            ← accordion
│   │   └── [chart + breakdown table]
│   ├── [▸] Demographics              ← accordion
│   │   └── [charts + key stats]
│   ├── [▸] Planning & Zoning         ← accordion
│   │   └── [zone type + rules summary]
│   ├── [▸] Property History           ← accordion
│   │   └── [timeline of sales/consents]
│   └── [▸] Neighbourhood             ← accordion
│       └── [category cards for amenities]
└── Share Report Button (sticky at bottom)
```

### Handling Long Sections on Small Screens

For sections that contain long lists (e.g., 15+ schools, crime data tables):

- **Truncate with "Show More":** Show first 5 items with a "Show all 23 schools" button
- **Virtualized lists:** Use `react-window` or Intersection Observer for lists with 50+ items
- **Sticky section headers:** When scrolling through a long expanded section, keep the section header sticky so the user always knows where they are
- **Inline charts over tables:** Replace data tables with compact charts wherever possible (bar charts for crime, donut charts for demographics)
- **Collapsible sub-sections:** Within a long accordion section, use secondary accordions or tabs

### Pull-to-Refresh

**Not recommended for WhareScore.** Pull-to-refresh is for feeds (social media, email) where content changes frequently. Property data is static for a given address. Instead:
- Show a "Last updated: [date]" label in the property summary
- If data is stale, show a subtle "Refresh data" link

**Caution:** Pull-to-refresh on the bottom sheet will conflict with the sheet drag gesture. This is a known gesture conflict that is very hard to resolve cleanly. Avoid it.

### Share Functionality

Use the Web Share API for native-feeling share on mobile:

```ts
const shareReport = async () => {
  const shareData = {
    title: `WhareScore Report: ${address}`,
    text: `Property intelligence report for ${address}`,
    url: `https://wharescore.co.nz/report/${propertyId}`
  };

  if (navigator.share) {
    await navigator.share(shareData);  // native share sheet
  } else {
    await navigator.clipboard.writeText(shareData.url);  // fallback
    showToast('Link copied to clipboard');
  }
};
```

**Share button placement:**
- Sticky at the bottom of the report (inside the bottom sheet)
- Also available in the property summary card at peek height (as an icon button)
- Share icon: standard share icon (box with arrow on iOS, 3-dot-arc on Android)

---

## 5. Touch-Friendly Map Interactions

### Tap Target Sizes

| Element | Minimum Size | Recommended | Notes |
|---------|-------------|-------------|-------|
| Property pin/marker | 44x44px | 48x48px | Material Design recommends 48dp |
| Map control buttons (zoom +/-) | 44x44px | 48x48px | Position bottom-right, above sheet |
| Layer chip | 36px tall | 36px tall | Horizontal padding ensures width > 44px |
| Locate me button | 44x44px | 48x48px | Position bottom-right |
| Spacing between tappable elements | 8px minimum | 12px | W3C WCAG 2.2 requirement |

### Dense Urban Areas (Overlapping Properties)

This is a critical problem for NZ cities (especially Auckland CBD, Wellington). Solutions:

1. **Supercluster clustering:**
   - Use `supercluster` library with `clusterRadius: 50` (50px grid cells)
   - `maxZoom: 16` — clusters break apart at zoom 17+ into individual properties
   - Cluster markers show count badge: "12 properties"
   - Tap cluster -> map zooms to `getClusterExpansionZoom()` level
   - On mobile, use larger cluster radius (60-80px) than desktop (40-50px) because fingers are less precise than cursors

2. **Spiderfier fallback:**
   - When properties physically overlap at maximum zoom (apartments in same building), use a "spiderfier" pattern
   - Tapping the cluster at max zoom fans out pins in a circular arrangement with connecting lines
   - Each fanned-out pin is 44x44px with 8px spacing

3. **Hit area expansion:**
   - Even if the visual marker is 24x24px, the invisible tap target should be 48x48px
   - Use a transparent hitbox layer above the visual marker layer
   ```ts
   // MapLibre example
   map.on('click', 'properties-hitbox', (e) => {
     // hitbox layer has circle-radius: 24 (48px diameter)
     // visual layer has circle-radius: 12 (24px diameter)
   });
   ```

### Cluster Breakpoints: Mobile vs Desktop

| Zoom Level | Desktop | Mobile | Rationale |
|------------|---------|--------|-----------|
| 0-10 | Clusters with 40px radius | Clusters with 60px radius | Fewer, larger clusters on small screens |
| 11-14 | Clusters with 30px radius | Clusters with 50px radius | Starting to see suburb-level detail |
| 15-16 | Individual markers or small clusters | Clusters with 40px radius | Mobile still needs clustering at this level |
| 17+ | Individual markers | Individual markers | Property-level zoom, show boundaries |

### Pinch-to-Zoom with Overlay Layers

- **Vector layers (polygons, lines):** Scale smoothly with pinch-to-zoom. No special handling needed.
- **Raster overlays (aerial imagery, heatmaps):** May pixelate during zoom transition. Use `rasterFadeDuration: 300` to smooth transitions.
- **Label layers:** Use `textAllowOverlap: false` and `textIgnorePlacement: false` to prevent label collision during zoom.
- **Circle markers (property pins):** Should NOT scale with zoom — keep constant pixel size with `circlePitchScale: 'viewport'`
- **During pinch gesture:** Temporarily reduce layer opacity or hide complex layers (like contour lines) to maintain 30+ FPS. Re-render after gesture ends.

---

## 6. Mobile Performance

### Vector Tile Budget

There is no single "maximum layers" number because performance depends on layer complexity, vertex count, and device GPU. However, here are practical guidelines:

**Rendering budget targets:**
- Target: 60 FPS on mid-range devices (Samsung A-series, Pixel 7a)
- Acceptable: 30 FPS during animations/transitions
- Each additional vector layer adds approximately 1-3ms to render time (varies wildly with data density)
- Each GeoJSON source adds higher overhead than vector tile sources

**Practical layer budget per viewport on mobile:**

| Layer Type | Approximate Budget | Notes |
|------------|-------------------|-------|
| Base map (streets, labels, buildings) | 15-25 layers | This is the base style; it's highly optimized by tile providers |
| Overlay polygon layers (zones, flood, planning) | 3-5 simultaneously | Large polygon fills are GPU-intensive |
| Line layers (roads, bus routes, boundaries) | 3-5 simultaneously | Less expensive than polygons |
| Point/circle layers (schools, stops, crime) | 3-5 simultaneously | Cheap unless >1000 visible points |
| Raster overlays (aerial, heatmap) | 1-2 simultaneously | Very GPU-intensive, especially on mobile |
| **Total overlay layers visible** | **8-12 max** | Beyond this, expect degraded frame rates |

**Key optimization strategies:**
- Convert GeoJSON to vector tilesets (Mapbox/MapTiler) before serving
- Reduce coordinate precision to 6 decimal places (~1cm precision)
- Set appropriate `minzoom` and `maxzoom` per layer to avoid rendering data at wrong zoom levels
- Use `feature-state` for hover/selected effects instead of re-rendering entire data sources
- Simplify geometries at lower zoom levels (Douglas-Peucker simplification)

### Image/Map Quality Trade-offs on Cellular

- **Raster tile size:** Use 256x256 tiles (not 512x512) on cellular/slow connections
- **Vector tiles are inherently smaller** than raster tiles (10-50KB vs 20-100KB per tile) — prefer vectors
- **Retina tiles (@2x):** Only load on WiFi or when `navigator.connection.effectiveType === '4g'`
- **Detect connection quality:**
```ts
const connection = navigator.connection;
const isSlowConnection = connection &&
  (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');

if (isSlowConnection) {
  map.setPixelRatio(1);           // don't use retina tiles
  map.setMaxTileCacheSize(50);    // reduce cache to save memory
  disableNonEssentialLayers();     // only show base map + property boundary
}
```

### Service Worker Caching Strategy

**Recommended: Stale-While-Revalidate for tiles, Cache-First for static assets.**

```ts
// Workbox configuration
registerRoute(
  // Vector tiles
  ({url}) => url.pathname.includes('/tiles/'),
  new StaleWhileRevalidate({
    cacheName: 'map-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,            // ~500 tiles covers a city viewport
        maxAgeSeconds: 7 * 24 * 60 * 60,  // 7 days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Property report API responses
registerRoute(
  ({url}) => url.pathname.includes('/api/report/'),
  new NetworkFirst({
    cacheName: 'property-reports',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,             // cache last 50 property reports
        maxAgeSeconds: 24 * 60 * 60,  // 24 hours
      }),
    ],
  })
);

// Static assets (JS, CSS, fonts)
registerRoute(
  ({request}) => request.destination === 'script' ||
                  request.destination === 'style' ||
                  request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,  // 30 days
      }),
    ],
  })
);
```

**Offline-ish experience:**
- Cache the base map tiles for the user's last-viewed area
- Cache the last 5-10 property reports for offline viewing
- Show an "Offline — showing cached data" banner when no network
- Disable search (requires API call) but allow viewing cached reports
- Store tile cache in IndexedDB for persistence across sessions
- Budget: ~50MB for tile cache, ~5MB for report cache

### Intersection Observer for Lazy-Loading Report Sections

```tsx
const LazyReportSection = ({ sectionId, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();  // only load once
        }
      },
      {
        root: sheetContentRef.current,  // observe within bottom sheet scroll
        rootMargin: '200px 0px',         // preload 200px before visible
        threshold: 0.01,
      }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {isVisible ? children : <SectionSkeleton />}
    </div>
  );
};

// Usage in report
<LazyReportSection sectionId="crime">
  <CrimeDataSection propertyId={id} />
</LazyReportSection>
```

**Lazy-loading strategy:**
- Property Summary: always loaded immediately (shown at peek)
- First 2 accordion sections: pre-loaded (likely visible at half state)
- Remaining sections: lazy-loaded with 200px root margin (start loading when 200px from viewport)
- Heavy components (charts, tables): use `React.lazy()` + `Suspense` for code splitting
- Images in report: use `loading="lazy"` attribute + `srcset` for responsive sizes

---

## Implementation Priority

For WhareScore POC, implement in this order:

1. **Search bar (fixed top) + flyTo animation** — core interaction
2. **Bottom sheet with 3 snap points** — use Vaul or react-modal-sheet
3. **Property summary at peek** — address, type, key scores
4. **Accordion report sections** — progressive disclosure
5. **Layer chip bar** — horizontal scrolling with presets
6. **Marker clustering** — supercluster with mobile-optimized radius
7. **Intersection Observer lazy loading** — for report sections
8. **Service worker caching** — Workbox configuration
9. **Web Share API** — native share for reports
10. **Connection-aware quality switching** — cellular optimizations

---

## Key Library Recommendations

| Purpose | Library | Why |
|---------|---------|-----|
| Bottom sheet | [Vaul](https://github.com/emilkowalski/vaul) | Unstyled, snap points, non-modal mode, tap handle to cycle, React/Next.js native |
| Alternative bottom sheet | [react-modal-sheet](https://github.com/Temzasse/react-modal-sheet) | Built on Motion (Framer Motion), accessibility-focused, pixel+percentage snap points |
| Map | MapLibre GL JS | Open-source, vector tiles, excellent performance, free |
| Clustering | [supercluster](https://github.com/mapbox/supercluster) | Industry standard, used by Mapbox, fast spatial indexing |
| Service worker | [Workbox](https://developer.chrome.com/docs/workbox/) | Google's SW toolkit, strategy-based caching, precaching |
| Virtual lists | [react-window](https://github.com/bvaughn/react-window) | For long lists (schools, crime items) inside accordion sections |
| Animations | Framer Motion / Motion | Spring physics, gesture handling, layout animations |

---

## Sources

- [NNGroup: Bottom Sheet Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [NNGroup: Accordions on Mobile](https://www.nngroup.com/articles/mobile-accordions/)
- [LogRocket: Bottom Sheets for Optimized UX](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)
- [Material Design 3: Bottom Sheets Specs](https://m3.material.io/components/bottom-sheets/specs)
- [Vaul: Snap Points Documentation](https://vaul.emilkowal.ski/snap-points)
- [Vaul GitHub](https://github.com/emilkowalski/vaul)
- [react-modal-sheet GitHub](https://github.com/Temzasse/react-modal-sheet)
- [Mobbin: Bottom Sheet UI Design](https://mobbin.com/glossary/bottom-sheet)
- [BrowserStack: Responsive Breakpoints 2025](https://www.browserstack.com/guide/responsive-design-breakpoints)
- [Framer: Responsive Breakpoints 2026 Guide](https://www.framer.com/blog/responsive-breakpoints/)
- [Phone Simulator: Most Popular Mobile Screen Resolutions 2026](https://phone-simulator.com/blog/most-popular-mobile-screen-resolutions-in-2026)
- [W3C WCAG 2.2: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Baymard: Autocomplete Design](https://baymard.com/blog/autocomplete-design)
- [Algolia: Mobile Search UX Best Practices](https://www.algolia.com/blog/ux/mobile-search-ux-best-practices)
- [MapLibre: Optimising Performance for Large Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/)
- [Mapbox: Performance Troubleshooting](https://docs.mapbox.com/help/troubleshooting/mapbox-gl-js-performance/)
- [Google Maps Marker Clustering](https://developers.google.com/maps/documentation/javascript/marker-clustering)
- [MapUI Patterns](https://mapuipatterns.com/)
- [Pencil & Paper: Mobile Filter UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-mobile-filters)
- [UXPin: Map UI Design Patterns](https://www.uxpin.com/studio/blog/map-ui/)
- [Chrome Developers: Service Worker Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/)
- [web.dev: Web Share API](https://web.dev/articles/web-share)
- [9to5Google: Google Maps iPhone Sheet Redesign (March 2025)](https://9to5google.com/2025/03/07/google-maps-iphone-sheet-redesign/)
- [9to5Google: Google Maps Android Sheet Redesign (April 2025)](https://9to5google.com/2025/04/24/google-maps-sheet-redesign-android/)
- [Turo Engineering: Adjusting Map While Bottom Sheet Moves](https://medium.com/turo-engineering/adjusting-compose-google-map-while-bottom-sheet-moves-4a7465305137)
- [Raw.Studio: Using Maps as Core UX in Real Estate Platforms](https://raw.studio/blog/using-maps-as-the-core-ux-in-real-estate-platforms/)
- [Perpetual: Incorporating Maps into Your App](https://www.perpetualny.com/blog/incorporating-maps-into-your-app-a-practical-designers-guide)

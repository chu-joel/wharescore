# Visual & UX Audit — WhareScore (localhost:3000)
**Date:** 2026-03-21
**Tested at:** ~530px mobile viewport + desktop DOM inspection

---

## Critical Issues

### 1. Three MapContainer instances rendered simultaneously
**File:** `frontend/src/app/page.tsx` lines 33, 47, 58
**Problem:** Three separate `<MapContainer />` components are rendered for desktop, tablet, and mobile breakpoints using CSS `hidden`/`block` classes. All three MapLibre GL instances initialize in the DOM even though only one is visible. This means 3x GPU/memory usage for the map.
**Fix:** Use a single `<MapContainer />` and move it around with a React portal or conditional rendering, or use a shared ref pattern so only one map instance exists.

### 2. Backend rate limiter crash (FIXED)
**File:** `backend/app/routers/property.py` line 34
**Problem:** slowapi 0.1.9 uses `inspect.signature()` to check for a parameter named exactly `request`. The lambda used `req`, so slowapi called it with no arguments → `TypeError`.
**Fix applied:** `lambda req:` → `lambda request:`

---

## Branding Issues

### 3. Hero heading still says "PropertyIQ" (FIXED)
**File:** `frontend/src/app/page.tsx` line 82
**Problem:** The desktop landing panel hero shows "PropertyIQ" but the project was renamed to "WhareScore" on 2026-03-10. The navbar, footer, and page title all correctly say "WhareScore".
**Fix applied:** Changed to `Whare<span>Score</span>`

---

## Overlap / Z-Index Issues

### 4. Search dropdown overlaps layer toggle buttons
**Where:** Navbar search bar autocomplete dropdown
**Problem:** When typing in the navbar search bar, the autocomplete dropdown appears and overlaps with the Hazards/Property/Schools/Planning/Transport layer toggle buttons below it. The dropdown lacks sufficient z-index or the layer buttons are too high.
**Suggested fix:** Increase z-index on the search dropdown or add a backdrop that dismisses it on click outside.

### 5. "1 Issue" dev error banner persistently overlaps bottom content
**Where:** Bottom-left corner, every page
**Problem:** A red "1 Issue" badge (likely Next.js dev overlay) is always visible and overlaps the "Get full report" button and footer content on the property report page. On mobile it's especially problematic as it covers key CTA buttons.
**Note:** This is the Next.js dev error indicator (from the maplibre serialization error). It should not appear in production. The underlying maplibre error (`can't serialize object of unregistered class`) should still be investigated.

### 6. Stray address tooltip on map
**Where:** Map view after navigating to a property
**Problem:** A tooltip showing "2/83 Bolton Street, Kelburn, Wellington" appeared floating on the map when viewing 10 Mulgrave Street. It seems to be a hover tooltip that got stuck or wasn't cleaned up.
**Suggested fix:** Ensure the hover tooltip state is cleared when navigating to a property or when the mouse leaves the map area.

---

## Layout & Presentation Issues

### 7. Mobile: Hero/landing content not visible on homepage
**Where:** Mobile homepage (`sm:hidden` layout)
**Problem:** On mobile, the map takes up 100% of the viewport. The landing panel with the search bar, feature highlights, and value proposition is only available inside the `MobileDrawer` bottom sheet. If the drawer is in its minimized "peek" state, new users see just a map with no context about what the app does.
**Suggested fix:** Consider having the MobileDrawer default to a more prominent peek height on first visit, or show a brief overlay/modal welcoming users.

### 8. MapLibre serialization console errors (3 occurrences)
**Where:** Console
**Problem:** `Error: can't serialize object of unregistered class Zh` appears 3 times. This is a maplibre-gl worker serialization issue, likely caused by passing a non-serializable object (possibly GeoJSON Feature or custom class) to a web worker via `setData()`.
**Impact:** Triggers the Next.js "1 Issue" overlay in dev mode. May indicate data not rendering correctly on the map.

### 9. Property report bottom bar overlap
**Where:** Property report page, bottom
**Problem:** The sticky/fixed "Get full report" CTA bar at the bottom of the property report competes with the "1 Issue" badge and the feedback button for space. In production (without the dev overlay), the feedback button (bottom-right) and the "Get full report" bar may still overlap.
**Suggested fix:** Ensure the feedback button has sufficient margin/offset from the bottom CTA bar.

---

## Minor / Polish Items

### 10. "About" link hidden on mobile
**Where:** Navbar
**Problem:** The "About" link is in the navbar on desktop but may not be visible on narrow mobile viewports (the navbar only shows logo + search + Sign in + dark mode + help).

### 11. Confidence indicator could be more prominent
**Where:** Bottom of property report — "Confidence: 87% (26 of 30 indicators available)"
**Problem:** This is small text at the very bottom. It's useful information that helps users trust the report but is easy to miss.

### 12. "Schools: 101/100" score exceeds max
**Where:** Property report "10 things to investigate" section
**Problem:** The schools indicator shows a score of 101/100, which looks like a bug. Scores should be capped at 100.

### 13. Map popup "Building: Te Aro" tooltip overlaps with property popup
**Where:** Map view, after clicking a property
**Problem:** When clicking a property on the map, the property popup (with score, address, "Get the Full Report" button) appears alongside a separate "Building: Te Aro" hover tooltip. The two overlap, with the building tooltip partially covering the popup's "Risk · Rent · 27 indicators · AI summary" text.
**Suggested fix:** Suppress the building hover tooltip when a property popup is active.

### 14. ~~Mobile: "Get the Full Report" from map popup goes to pricing modal, not report~~
**Status:** Not a bug — pricing modal is designed to pop up randomly as a conversion nudge.

---

## Summary of Changes Made

| # | Issue | Status |
|---|-------|--------|
| 1 | 3 MapContainer instances → single instance via `useBreakpoint()` hook | **Fixed** |
| 2 | slowapi `key_func` lambda parameter name (`req` → `request`) | **Fixed** |
| 3 | "PropertyIQ" → "WhareScore" in hero heading | **Fixed** |
| 4 | Search dropdown overlaps layer chips | Not a bug (z-index is correct, `z-50` > `z-10`) |
| 5 | Next.js "1 Issue" dev overlay | **Fixed** (root cause was #8) |
| 6 | Stray tooltip stuck on map | Likely fixed by #1 (single map instance) |
| 8 | MapLibre serialization errors (`can't serialize unregistered class`) | **Fixed** — strip `MapGeoJSONFeature` to plain GeoJSON before `setData` |
| 12 | Schools score 101/100 | **Fixed** — `quality_points` could go negative from EQI < 400, added `max(0, ...)` clamp. Needs backend restart. |
| 14 | Pricing modal on map CTA | Not a bug (intentional random popup) |
| 9 | Feedback button overlaps bottom CTA | Not a bug (only appeared with dev overlay) |
| 13 | Building hover tooltip overlaps property popup | **Fixed** — hide hover tooltip when popup is active |
| 7 | Mobile drawer not visible on home (peek state off-screen) | **Fixed** — drawer Content needs full viewport height for vaul snap calc; increased peek to 220px |
| 10 | About link hidden on mobile | **Fixed** — changed `hidden md:` to `hidden sm:` |
| 11 | Confidence indicator not prominent enough | **Fixed** — styled as teal pill badge with mini ring SVG |
| 15 | Score Strip "Neighbourhood"/"Transport" labels overlap on mobile | **Fixed** — shortened to "Area"/"Transit" via SHORT_LABELS map |

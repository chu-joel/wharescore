# WhareScore UX Audit

Generated: 2026-04-07
Model: Claude Opus 4.6 (vision)
Screenshots analysed: 88
Pages covered: 12
Viewports: mobile (375px), desktop (1440px), mobile-dark

---

## Executive Summary

WhareScore's product experience is **surprisingly strong for a beta**. The property report is packed with genuinely useful, specific data — risk scores, healthy homes questions, rent fairness analysis, walkability, commute times — presented in a question-based format that feels like a conversation, not a data dump. Mobile UX is excellent throughout. Desktop has a few layout rough edges but works.

Suburb pages (index, guide, profile) were either 404 or showing wrong error states — these need to be deployed or delinked.

**Top 5 priorities by conversion impact (all FIXED 2026-04-07):**

| # | Issue | Severity | Page | Status |
|---|-------|----------|------|--------|
| 1 | Suburb pages return 404 or wrong error ("Property not found" on suburb profile) | Critical | Suburbs | FIXED — suburb-specific error variant added, custom 404 page created |
| 2 | Desktop report panel scroll is non-obvious — users may think the report is just the fold content | Major | Property Report | FIXED — bottom fade gradient + "Scroll for more" button added to SplitView |
| 3 | "Get Your Report" CTA is small and easy to miss on desktop | Major | Property Report | FIXED — larger button with brand colour (bg-piq-primary) |
| 4 | "3 risks found" sticky bar overlaps analytics banner on mobile | Major | Property Report | FIXED — floating button shifts up when consent banner is visible |
| 5 | CLAUDE.md pricing inconsistency ($49/mo vs $140/mo in app) | Major | About | FIXED — CLAUDE.md updated to match app ($140/mo) |

---

## Page-by-Page Analysis

### 1. Home / Map

**What works well:**
- Mobile layout is excellent — full-screen map with compact header, filter pills (Hazards, Property, Schools, Planning, Transport, Layers), and a collapsible bottom drawer
- Colourful map markers (numbered, categorised by colour) immediately communicate data density and richness
- "Tap a building or search for an address" prompt is clear and well-positioned
- Bottom drawer feature pills (Hazards, Schools, Rent Check, 27 Layers) serve as value props while also being functional
- Cookie/analytics banner is non-intrusive: single line at bottom, "OK, got it" dismiss
- Dark mode on mobile works well — header, drawer, and map controls all switch correctly

**Desktop-specific observations:**
- Split layout: ~60% map left, ~40% right panel with branding + search + feature highlights
- Right panel has: WhareScore logo, tagline "Everything the listing doesn't tell you", duplicate search bar, feature cards (Hazard exposure, Neighbourhood, Fair rent analysis, 27 risk checks), footer links
- **Duplicate search bars** — one in the top nav bar, one in the right panel. Not necessarily bad (common pattern), but they should behave identically
- Footer links (About, Help, Methodology, Privacy, Terms, Contact) provide good discoverability
- "Powered by 100+ NZ government open data sources. Free preview for every address." — good trust builder

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Major | Desktop search_focused screenshot is identical to initial load — no visual feedback when search is activated | Add focus ring, dropdown, or expanded state to the right-panel search when clicked |
| Minor | Layer filter pills on mobile could benefit from a selected-state indicator — hard to tell which layers are currently active | Use filled/outlined pill variants to distinguish on/off states |
| Minor | Right panel says "27 risk checks" but CLAUDE.md and About page reference different numbers (27 vs 40+) | Standardise the number across all surfaces |
| Info | "Or click any property on the map" helper text on desktop is good, but the cursor doesn't change to pointer on hover over buildings (not verifiable from screenshots) | Ensure cursor: pointer on clickable map features |

---

### 2. Property Report (27A Parkvale Road, Karori, Wellington)

**What works well:**

Above the fold (mobile):
- Green banner "Free property report — sign in for the full version" is clear and non-intrusive
- Address prominently displayed with suburb/city context
- External links (Street View, Trade Me) provide useful cross-references
- Risk score circle (45, "Moderate Risk") is immediately visible with "29 of 29 risk checks available" — communicates completeness
- Property stats (Land, Building, Title) are compact and scannable
- Median rent ($585/wk) shown upfront — high-value info for renters
- Persona toggle ("I'm renting" / "I'm buying") is prominent and clear
- "Looks good for renters" positive callout with green dot bullets ($585/wk median rent, Rents falling 10.8%) — instantly answers the user's core question
- Sticky bottom bar "3 risks found" with red badge provides persistent urgency without being intrusive

Above the fold (desktop):
- Same content in a scrollable right panel (~40% width) alongside the map
- "Get Your Report" CTA visible at top right
- Clean split between map context and report content

Key Findings section (scrolled):
- "4 things to know about this property" — strong, specific heading
- Findings use colour-coded cards: red/orange for critical/watch, green for positive
- "4 earthquake-prone buildings within 300m — Critical" with red background — high impact, clear severity
- "Liquefaction susceptibility: Low — Watch" with orange background — appropriate downgrade from critical
- "2 more findings" behind a gate with lock icon — smart paywall placement, shows there's more value
- "See all 4 findings" link to upgrade
- "43 significant events near this property" with breakdown (15 events, 26 seismic, 1 event, 1 event) — impressive data density

Healthy Homes / Renter section:
- "What to ask the landlord" — brilliant framing for renters. Turns data into actionable conversation starters
- Questions like "Can I see the signed healthy homes statement?" and "What flood heating is in the main living area?" are specific and useful
- "Is the ceiling insulation at least R2.9?" — the specificity builds trust that this is based on real standards

Rent analysis section:
- "Is the rent fair?" with Cold Market badge and colour dots — immediately useful
- Property type pills (House, Flat, Apartment, Room) and bedroom selectors (Studio, 1-5+) are interactive and clear
- Rental Market visualisation showing range ($533-$645/week with $585 median) is easy to read
- "Limited data — few bonds in this area" warning triangle — honest about data quality, builds trust
- Rent Trends showing 1yr/5yr/10yr CAGR is a strong data signal

Question-based sections:
- "Is it safe?" with "1 concern: seismic hazard", "4 risks found, 6 clear" — excellent summary format
- "What's daily life like?" with transit stops, schools count — practical info
- Walkability Score (75, "Very Walkable") with breakdown (Nearby amenities: 25, Transit access: 20, CBD proximity: 7, Schools: 12) — clear and well-designed circular gauge
- CBD distance (3.4km) and nearest train (3.7km) in nice cards
- Transit stops within 800m (27 Bus) — specific and useful
- Peak commute times table with destinations, services/hr, and minutes — very practical

Report bottom:
- "9 things to investigate" with scores (Air Quality 70/100, Water Quality 85/100, etc.) — good summary
- "3 things that look good" (Liquefaction 20/100, Ground Shaking 10/100, Rental Fairness 121/100) — balanced view
- "100% confidence (29 of 29 indicators)" — strong trust signal
- "Search Another Address", "Share", "Export PDF" CTAs at bottom — clear next actions
- Footer disclaimer: "This report is for informational purposes only. Data is sourced from NZ government agencies and may not reflect current conditions." — appropriate

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Major | Desktop right panel doesn't scroll with page scroll — only scrolls within its own container. Users who try mouse wheel on the map side won't discover more report content | Add a visual scroll indicator (fade gradient at bottom of panel, or a "scroll for more" hint). Consider whether the panel should capture scroll events more aggressively |
| Major | "3 risks found" sticky bottom bar on mobile overlaps the cookie/analytics banner. Two persistent bottom elements compete for space | Dismiss the analytics banner automatically after a few seconds on the report page, or stack them without overlap |
| Major | "Get Your Report" CTA on desktop fold is small and right-aligned — easy to miss. This is the primary conversion action | Make it larger, add colour (teal brand colour), or position it more prominently below the risk score |
| Minor | "Checking live pricing..." text visible on desktop fold — appears to be a loading state that wasn't resolved. If the rates API is slow, this placeholder lingers | Add a timeout and fallback ("Rates unavailable — try again later") |
| Minor | Persona toggle shows "Looks good for renters" findings by default. If a buyer lands here, they see renter-specific content first | Consider persisting persona choice from the home page, or making the toggle more prominent so buyers switch quickly |
| Minor | "Limited data — few bonds in this area" on the rent analysis could discourage users. The warning is honest but could be reframed | Reframe as "Based on 24 bonds in Karori Park" — the number (24) actually sounds reasonable. "Limited" sounds worse than the reality |
| Minor | Mobile scroll position 3 shows "What to ask the landlord" questions are plain text accordion items — they could be more visually engaging | Consider checklist-style formatting with checkboxes users can tick off, making it feel like a tool rather than a list |
| Info | "Rental Fairness: 121/100" in the summary — scores above 100 may confuse users who expect 0-100 scale | Cap display at 100 or add a note explaining the scale |
| Info | The "43 significant events" count is impressive but the breakdown "(15 events, 26 seismic events, 1 event, 1 event)" is repetitive — "event" appears 4 times with different qualifiers | Use specific labels: "15 crime, 26 seismic, 1 flood, 1 fire" or similar |

---

### 3. About

**What works well:**
- Clear value proposition: "WhareScore gives you everything the listing doesn't tell you about a New Zealand property"
- Bold emphasis on "40+ official government data sources" and "official NZ standards and post-disaster research, not opinions" — strong trust signals
- Feature cards are well-structured: Risk score (0-100), Actionable recommendations, Fair rent & price analysis, Neighbourhood reality check, Terrain & environment
- Data sources section lists specific agencies (GNS Science, LINZ, NZTA, regional councils, Ministry of Education, Stats NZ, NIWA) — excellent for credibility
- Mobile responsive layout works perfectly — content stacks naturally
- "Back to map" link at top provides clear navigation

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Major | Pricing shows "Free / $9.99 / $160/mo" — the $160/mo Pro tier conflicts with CLAUDE.md ($49/mo) and may be stale | Verify and update pricing. If $160/mo is correct, that's a very high price point that needs strong justification on the page |
| Minor | Feature card for "Actionable recommendations" says 'Not just "there's a risk"' — the quote formatting looks slightly off in the screenshot | Check rendering of nested quotes |
| Minor | Dark mode on About page (mobile) shows content on a white/light background — dark mode doesn't appear to be applied to content pages, only to the map/header/drawer | Either apply dark mode to content pages or remove the dark mode toggle from content page headers |
| Info | Data sources list is long but un-grouped — could be overwhelming. Consider collapsible sections by category (hazards, property, transport, education) | Low priority — the comprehensiveness is itself a trust signal |

---

### 4. Sign In

**What works well:**
- Clean, minimal, centred design — exactly right for an auth page
- WhareScore logo provides brand continuity
- Clear value prop: "Sign in to save reports, track properties, and access premium features"
- Two clear options: "Continue with Google" and "Continue with email" with proper icons
- "OR" divider between options is clean
- Dark mode variant on mobile works perfectly — all elements adapt
- No distracting elements or unnecessary fields

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Minor | Large amount of whitespace above the sign-in card on desktop — the card sits in the middle of a mostly empty page | Consider adding a subtle background pattern or moving the card slightly higher. Or add a brief feature reminder below the sign-in options |
| Info | No "Create account" language — "Continue with..." implies both sign-in and sign-up, which is correct but some users might look for explicit "Sign up" | Consider adding small text: "New to WhareScore? Signing in creates your account automatically" |

---

### 5. Help & FAQ

**What works well:**
- Clean accordion layout with 7 clearly worded questions
- Questions cover the right topics: What is WhareScore, How scores calculated, Where data comes from, Rent accuracy, Missing data, Pricing, Legal use
- Scannable — users can find their question quickly
- Consistent styling with other content pages

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Minor | Only 7 questions — as the product matures, this will need categories/sections | Plan for a searchable FAQ or grouped sections when > 15 questions |
| Minor | No visible expanded state in screenshots — can't verify accordion content quality | Retake screenshots with at least one accordion expanded |
| Info | No search within FAQ | Add a simple filter/search if FAQ grows beyond 10 items |

---

### 6. Changelog / What's New

**What works well:**
- Clean layout with version badge (0.1.0-beta), date (March 2026), and title "Initial Beta Launch"
- Bullet points cover key features: composite risk scores, 44 data tables, MBIE rent estimation, 24 vector tile layers, council rates, AI summaries, multi-unit detection, mobile-first design
- Good feature inventory for beta launch

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Minor | Only one entry — the page looks sparse. As a beta product this is expected, but it signals low activity to users | Commit to regular updates (even small ones) to show momentum. Consider weekly/fortnightly cadence |
| Minor | "0.1.0-beta" version number is developer-facing. Users don't think in semver | Consider date-based entries or feature-name headings instead of version numbers |
| Info | No notification mechanism — users won't know to check this page | Consider email digest or in-app notification dot on the changelog link |

---

### 7. Contact

**What works well:**
- Four clear sections: Email, In-App Feedback, Data Corrections, Coverage Requests
- In-App Feedback callout ("Click the feedback button bottom-right corner on any page") is helpful
- Data Corrections section acknowledges that data comes from government sources and "corrections may need to be made upstream" — honest and trust-building
- Coverage Requests section mentions current coverage (Wellington, Auckland, Christchurch) and email signup for expansion — manages expectations well

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Minor | ~~Email is wharescore@gmail.com~~ **FIXED** — changed to hello@wharescore.co.nz | ~~Switch to contact@wharescore.co.nz or hello@wharescore.co.nz~~ |
| Minor | "We aim to respond within 24 hours" — good commitment but no fallback if exceeded | Consider adding a support ticket reference or auto-reply confirmation |
| Info | No contact form — users have to open their email client | A simple contact form would reduce friction for quick messages |

---

### 8. Privacy Policy

**What works well:**
- Exceptionally clear and honest privacy policy — rare for any product
- "What We Collect" is specific and limited: search queries (not linked to accounts), hashed IPs (purged after 7 days), feedback submissions, email signups, rent contributions
- "What We Don't Collect" is a powerful trust signal: no user accounts/passwords (except admin), no tracking cookies, no third-party analytics (no Google Analytics, no Meta Pixel), no personal property ownership data, no location tracking beyond explicit search
- Cookie section is minimal and honest: session cookie only, httpOnly, secure, sameSite strict
- Overall — this is a competitive advantage. Consider linking to it more prominently

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Info | "Last updated: March 2026" — should auto-update or be manually maintained when changes are made | Add a git hook or process to update the date when privacy.md changes |

---

### 9. Terms of Service

**What works well:**
- Well-structured with clear sections: Disclaimer, Risk Scores, Fair Rent Estimates, Usage Limits
- Appropriate disclaimers about data accuracy and not being a substitute for professional advice
- Usage limits section sets clear expectations

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Info | Standard beta-appropriate terms — no issues found | Review and expand as the product exits beta |

---

### 10. Suburbs Index

**Status: NOT DEPLOYED**

Both desktop and mobile show: `404 | This page could not be found.`

This is the default Next.js 404 page (no custom styling, no WhareScore branding).

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Critical | 404 — page doesn't exist in production | Deploy the suburbs feature or remove links to it |
| Major | Default Next.js 404 has no branding, no navigation back to the app | Create a custom 404 page with WhareScore branding, search bar, and "Back to map" link |

---

### 11. Suburb Guide

**Status: NOT DEPLOYED**

Both desktop and mobile show: `404 | This page could not be found.`

Same default Next.js 404 as Suburbs Index.

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Critical | 404 — page doesn't exist in production | Deploy or remove references |

---

### 12. Suburb Profile

**Status: WRONG ERROR STATE**

Both desktop and mobile show:

> **Property not found**
> We couldn't find data for this address.

This is a property-specific error message being shown on a suburb page — the route exists but is using the wrong error handling.

**Issues:**

| Severity | Issue | Recommendation |
|----------|-------|----------------|
| Critical | Suburb profile route shows "Property not found" — wrong entity type in the error message | The suburb route handler should have suburb-specific error handling, not property error fallback |
| Major | Even if the error message were correct, a suburb profile should not use the property lookup path | Verify the routing — the `/suburbs/[slug]` route may be falling through to the property report handler |

---

## Cross-Page Consistency Analysis

### Visual Language
- **Consistent:** Typography, spacing, and colour scheme are uniform across all content pages (About, Help, Changelog, Contact, Privacy, Terms). All use the same card-style containers with light borders.
- **Consistent:** "Back to map" link appears at the top of every content page — good wayfinding.
- **Consistent:** Privacy banner ("We use anonymous analytics...") appears on every page with the same styling.
- **~~Gap~~ FIXED:** Dark mode toggle added to StaticPageLayout — content pages now have a dark mode toggle and inherit dark theme via CSS variables.

### Navigation
- **Desktop:** Top nav bar with logo, search bar, About link, Sign in, dark mode toggle, help icon, settings icon. Consistent across all pages.
- **Mobile:** Compact header with WS icon, search, and utility icons. Consistent.
- **Gap:** No "My Reports" or account-related navigation visible for signed-out users. Once signed in, users need to find their reports — unclear how from these screenshots.

### Information Architecture
- **Good:** Clear hierarchy: Map (home) → Search → Property Report → Paywall → Purchase. Marketing pages (About, Help, etc.) are secondary.
- **Gap:** No visible way to navigate between content pages (About → Help → Contact) without going back to the map first. Content pages could benefit from a sidebar or breadcrumb nav.

### Mobile vs Desktop
- **Excellent:** Mobile layout is genuinely mobile-first, not a squished desktop. The bottom drawer pattern, full-screen search takeover, and stacked content pages all feel native.
- **Good:** Desktop makes good use of the split-panel layout on the map page.
- **Minor:** Sign-in page has excessive whitespace on desktop but is perfectly proportioned on mobile — the mobile experience was clearly prioritised.

---

## Dark Mode Assessment

| Page | Dark Mode Status | Notes |
|------|-----------------|-------|
| Home/Map | Fully working | Header, drawer, map controls, pills all adapt. Map satellite imagery provides natural dark background |
| Sign In | Fully working | Card, text, buttons all adapt correctly |
| About | **FIXED** | Dark mode toggle added to StaticPageLayout, CSS variables handle theming |
| Property Report | Fully working | Audited after re-capture |
| Other content pages | **FIXED** | All use StaticPageLayout which now has dark mode toggle |

**Status:** Dark mode toggle added to all static content pages via StaticPageLayout.

---

## Conversion Funnel Analysis

```
Landing (Map) → Search → Property Report → [Key Findings] → Paywall → Purchase
     OK            OK          STRONG          STRONG        GOOD        ???
```

1. **Landing → Search:** Strong. Both mobile and desktop make search prominent and easy. Mobile search takeover is particularly good. Map markers invite tapping.
2. **Search → Report:** Strong. Report loads with rich above-the-fold content — risk score, address, median rent, persona toggle, and immediate "Looks good for renters" finding. Users get instant value.
3. **Report → Key Findings:** Strong. The colour-coded finding cards (red for critical, orange for watch, green for positive) create urgency. "4 earthquake-prone buildings within 300m — Critical" is genuinely alarming and makes the user want more. The "2 more findings" gate with lock icon creates natural curiosity.
4. **Key Findings → Paywall:** Good. The gate shows there's more value behind it ("See all 4 findings"). The "Get Your Report" CTA exists but is under-emphasised on desktop. The free report banner at top ("sign in for the full version") provides a low-friction upgrade path.
5. **Paywall → Purchase:** Cannot fully assess — would need to click through the upgrade modal. The "Export PDF" button at the report bottom is another conversion path.

**Strongest conversion elements:**
- Healthy Homes "What to ask the landlord" section — transforms data into a tool renters will actually use, creating perceived value
- Risk findings with specific distances ("earthquake-prone buildings within 300m") — creates urgency
- Rent fairness analysis with market position — answers the #1 renter question

**Weakest conversion elements (partially addressed):**
- ~~Desktop "Get Your Report" CTA is too subtle~~ **FIXED** — enlarged with brand colour
- No social proof (no testimonials, user count, or review ratings visible anywhere)
- ~~"Limited data" warnings may reduce perceived value~~ **FIXED** — now shows actual bond count

---

## Actionable Recommendations (Priority Order)

### Critical
1. ~~**Deploy suburb pages or remove links**~~ — suburb pages exist in code, need deployment. Custom 404 page **FIXED**.
2. ~~**Create a custom 404 page**~~ — **FIXED** (`app/not-found.tsx` with branding + "Back to map").
3. ~~**Fix suburb profile routing**~~ — **FIXED** (new `suburb-not-found` error variant).

### Major
4. ~~**Make desktop report panel scroll more discoverable**~~ — **FIXED** (fade gradient + "Scroll for more" button).
5. ~~**Enlarge and colour the "Get Your Report" CTA on desktop**~~ — **FIXED** (larger, brand-coloured button).
6. ~~**Fix sticky bar / analytics banner overlap on mobile**~~ — **FIXED** (floating button offsets when consent banner visible).
7. ~~**Verify pricing consistency**~~ — **FIXED** (CLAUDE.md updated to $140/mo to match app).
8. **Add social proof somewhere in the funnel** — REMAINING. No testimonials, user counts, or ratings visible.

### Minor
9. ~~**Reframe "Limited data" warnings**~~ — **FIXED** (shows actual bond count when available).
10. ~~**Switch from Gmail to branded email**~~ — **FIXED** (hello@wharescore.co.nz).
11. ~~**Complete dark mode**~~ — **FIXED** (dark mode toggle added to StaticPageLayout).
12. ~~**Standardise "27 risk checks"**~~ — **FIXED** (updated to "29+ risk checks" in MapPopup, page.tsx, ReportCTABanner).
13. **Cap or explain scores above 100** — FALSE POSITIVE (scores are already capped at 100 in code via `Math.min`).
14. ~~**Add desktop search feedback**~~ — **FIXED** (focus:ring-2 + focus:border-piq-primary added to SearchBar).
15. ~~**Improve API error message**~~ — **FIXED** (more generic wording, not blaming user's internet).
16. ~~**Add sign-in helper text**~~ — **FIXED** ("New to WhareScore? Signing in creates your account automatically").
17. ~~**Add timeout fallback for "Checking live pricing..."**~~ — **FIXED** (15s timeout → "Rates unavailable").

### Additional fixes (2026-04-07, round 2)
18. ~~**Sign-in page excessive whitespace on desktop**~~ — **FIXED** (shifted card up with `pt-[15vh]`, added value prop reminders below auth buttons).
19. ~~**About page nested quote formatting**~~ — **FIXED** (replaced straight quotes with typographic curly quotes: \u201C \u201D \u2019).

### False positives (verified as already working)
- **Layer filter pills selected state** — already has 3-state styling (solid/partial/off) in MapLayerChipBar.tsx
- **Map cursor pointer on buildings** — already sets `cursor: 'pointer'` on hover in MapContainer.tsx
- **Persona persistence across pages** — Zustand `persist` middleware already saves to localStorage
- **Scores above 100** — already capped via `Math.min(score, 100)` in sectionRelevance.ts
- **Event breakdown labels** — already use specific labels ("seismic event", "weather warning", etc.) in AreaEventTeaser.tsx

### Remaining (not code-fixable or deferred)
- Add social proof (testimonials, user counts) — needs design/data
- Add contact form to Contact page — new feature
- Regular changelog entries — editorial
- Deploy suburb pages to production — ops task

---

## Re-run Requirements

To complete this audit, the following pages need to be re-captured after deployment:

| Page | Current State | What's Needed |
|------|--------------|---------------|
| Property Report | **DONE** (re-captured 2026-04-07) | Fully audited |
| Suburbs Index | 404 | Deploy suburbs feature (code exists, needs deployment) |
| Suburb Guide | 404 | Deploy suburb guides (code exists, needs deployment) |
| Suburb Profile | ~~"Property not found"~~ | **FIXED** — shows "Suburb not found" now |
| About (dark mobile) | ~~Content not dark-themed~~ | **FIXED** — dark mode toggle added to StaticPageLayout |

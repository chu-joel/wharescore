# WhareScore Badge — Browser Extension MVP Brief (Phase 1: Badge-Only)

> Drafted: 2026-04-18. Revised: 2026-04-18 (Phase-1 narrowing after backend audit + ToS review).
> If you are the implementing agent, this file **is the spec** — work from it end-to-end. All rules below are binding.

## Why this was narrowed

An earlier version of this brief included per-site data capture (bedrooms, bathrooms, floor area) from pages the user browsed, rewarded via free report credits. Research surfaced a material ToS issue on homes.co.nz:

> "you are granted a limited right to access the Services and retrieve, display and print content pages for your own personal, non-commercial use only."

That "personal, non-commercial use only" language puts any commercial use of scraped content — even via user-consent pathways — outside the licence. So Phase 1 is stripped to badge-only: the extension **annotates** pages the user is viewing with the WhareScore score and findings, but does NOT extract attributes for storage. Phase 2 contribution will be pursued later only on sites whose ToS permits it (or via licensed data deals).

The strongest defensible framing for Phase 1: this is an **accessibility / annotation** tool, like Dark Reader, Grammarly, ad-blockers, or price-comparison extensions. It augments the user's own view; it does not copy content.

## Scope

**Target sites:** homes.co.nz, OneRoof, Trade Me, realestate.co.nz (all 4 — badge only, no capture)
**Target browser:** Chrome (MV3). Firefox/Edge repackaging later.
**What it does:** Reads the listing's address from the DOM, sends ONLY that text to the WhareScore API, receives and displays a floating badge with the WhareScore risk score and top findings.
**What it DOES NOT do:**
- Capture, store, transmit or persist any attribute from the host page (bedrooms, price, photos, agent info, descriptions — nothing)
- Fetch from the host site server-side
- Read cookies from any domain other than wharescore.com
- Track user browsing history

## Cost budget (confirmed)

| Item | Cost |
|---|---|
| Chrome Web Store developer registration | USD $5, one-time |
| Firefox Add-ons | $0 |
| Microsoft Edge Add-ons | $0 |
| Backend hosting | $0 (existing Azure VM) |
| **Total lifetime to ship** | **USD $5** |

No paid third-party services for MVP.

---

## READ-BEFORE-WRITE (mandatory)

Read in order BEFORE any code:

1. `CLAUDE.md` — routing table, critical rules, doc checklist
2. `docs/QUALITY-STANDARDS.md`
3. `docs/SYSTEM-FLOWS.md` — auth chain, credit system, caching, screen purposes
4. `docs/FRONTEND-WIRING.md` — API endpoint conventions
5. `docs/DATA-CATALOG.md`
6. `frontend/src/auth.ts` — NextAuth config
7. `frontend/src/app/api/auth/token/route.ts` — the 5-min JWT mint endpoint (REUSE)
8. `backend/app/services/auth.py` — `verify_jwt()`
9. `backend/app/routers/search.py` — `GET /api/v1/search/address`
10. `backend/app/routers/property.py` — report endpoint
11. `backend/app/services/risk_score.py` — `enrich_with_scores(report: dict) -> dict`
12. `backend/app/services/event_writer.py` — `track_event()` (REUSE for telemetry)
13. `backend/app/deps.py` — existing slowapi rate limiter

Update affected docs **in the same commit**.

---

## Verified integration facts (from backend audit)

These are ground truth — do not re-derive:

| Item | Truth |
|---|---|
| NextAuth cookie | `__Secure-next-auth.session-token`, httpOnly, encrypted by NextAuth — DO NOT parse directly |
| Short-lived JWT | `GET /api/auth/token` on frontend → returns 5-min HS256 JWT signed with `AUTH_SECRET` |
| Backend JWT validation | `backend/app/services/auth.py::verify_jwt()` via `AUTH_SECRET` env var |
| Address search | `GET /api/v1/search/address?q=<text>&limit=<n>` — returns ranked list, NO confidence field |
| Address PK | `addresses.address_id INT` |
| User PK | `users.user_id TEXT` (Clerk-style string) |
| Report endpoint | `GET /api/v1/property/{address_id}` returns full report dict |
| Risk score | `enrich_with_scores(report: dict) -> dict` — requires full report, not address_id |
| Report cache | Redis 24h, key `report:{address_id}` |
| Credits table | `report_credits` with `credit_type` TEXT ('single', 'pack3', 'promo', 'pro') + `report_tier` TEXT ('quick', 'full') |
| Effective plan | `GET /api/v1/account/credits` returns `plan` field derived from active credits |
| Saved endpoint | `POST /api/v1/account/saved-properties` body `{address_id, full_address}` |
| CORS origins | `["http://localhost:3000"]` — must add extension origin |
| Rate limiter | `slowapi`, per-IP only, Redis backend. Custom per-user key func needed |
| Events table | `app_events` — use `services/event_writer.py::track_event()` |
| Next migration # | **0052** (last was `0051_crime_area_unit_fallback.sql`) |

---

## User Value Ladder (3 tiers by capability, 2 content depths)

| | **Anon** | **Signed-in free** | **Pro** |
|---|---|---|---|
| Score | ✓ | ✓ | ✓ |
| Findings | 2 generic (no persona) | 2 **persona-tailored** (renter vs buyer) | All, persona-ranked |
| Price signal | — | Wide band ($870k–$940k, CV × HPI) | Confidence-banded estimate + comps |
| Rent estimate + yield | — | — | ✓ |
| Walk score | — | — | ✓ |
| School deciles | — | — | ✓ |
| Save to My Properties | — | ✓ | ✓ |
| Cross-site watchlist | — | ✓ | ✓ |
| Email alerts for similar listings | — | — | ✓ |
| PDF export from badge | — | — | ✓ |

### Incentive story

- **Anon → Signed-in free:** unlocks Save + persona-tailored findings + cross-site watchlist.
- **Signed-in free → Pro:** unlocks price advisor (real confidence band + comps), rent + yield, walk/schools, email alerts for similar listings, PDF export.

### Finding selection logic (for the 2 findings shown in anon + free)

Findings must be ranked by **relevance to THIS property**, not absolute thresholds. Implement in `services/report_html.py` via a new helper `select_findings_for_badge(report, persona, max_count)` reusable by the main app.

Rules:
1. **Relative-to-baseline:** drop findings where the property is at or below the SA2 median for that signal. Drop findings where local_prevalence > 70% (it's suburb context, not property-specific — "Wellington property has high wind" is useless).
2. **Favour non-obvious signals:** weight photo-invisible signals (flood, liquefaction, slope, distance-to-fault, noise contours, heritage overlay, pre-1970 build, healthy-homes gaps) 2× higher than photo-visible signals (schools, CBD distance).
3. **Persona tailoring:**
   - **Renter priority:** rent fairness vs SA2 median → Healthy Homes signals (insulation/heating/pre-1970) → commute → noise/quiet → catastrophic hazards only (tsunami evac).
   - **Buyer priority:** price fairness vs SA2 median + CV divergence → non-obvious hazards > baseline → zoning/rezoning signals → school zone/decile → maintenance red flags (steep section, small footprint-to-land).
4. **Persona detection:** URL path contains `/rent/` or `/rental/` → renter; `/sale/` or `/for-sale/` → buyer. Logged-in user's account persona overrides URL if set.
5. **Rank:** `relevance = relative_severity_vs_SA2 × persona_weight × non_obvious_bonus`. Take top N (N=2 for anon + free, all for Pro).

**No contribution / reward mechanic in Phase 1.** Revisit in Phase 2.

---

## Auth flow (revised per audit)

```
Extension boot
 └─ on first API call, background service worker calls:
    GET https://wharescore.com/api/auth/token   (credentials: 'include')
     ├─ 200 → cache JWT in chrome.storage.session, expires_at = now + 4m
     └─ 401 → Level 0 mode (no badge features requiring auth)
 └─ before each backend call: if JWT expires in <30s, refresh; else use cached
 └─ on 401 from backend: clear cache, re-fetch token, retry once; if still 401 → Level 0
```

**CORS**: frontend `/api/auth/token` and backend `/api/v1/extension/*` must accept `Origin: chrome-extension://<id>` with `credentials: 'include'` and send back a specific origin (not `*` — won't work with credentials). For dev, allow any chrome-extension origin via regex. For prod, lock to the published extension's ID.

---

## Address matching (revised — no confidence score available)

```
1. Extract address text from host page DOM (per-site extractor).
2. Normalize: lowercase, strip punctuation, expand abbrev ("St" → "Street").
3. Call GET /api/v1/search/address?q=<normalized>&limit=3
4. For each result, compare normalized result.full_address to normalized input:
   - Exact match on (address_number, road_name, suburb_locality) → accept, use address_id
   - Otherwise → reject
5. If no acceptable result → NO badge, no capture, no error. Silent.
6. If 2+ ambiguous results → render badge with score-for-first + "Multiple matches" chip; no Save option.
```

---

## Backend work

### New file: `backend/app/routers/extension.py`

**`POST /api/v1/extension/badge`**
- Auth: JWT optional via `Authorization: Bearer <jwt>` header (minted by frontend `/api/auth/token`)
- Required headers: `X-WhareScore-Extension: 1`, `X-WhareScore-Extension-Version: 0.1.0`
- Body:
  ```json
  {
    "source_site": "homes.co.nz" | "oneroof.co.nz" | "trademe.co.nz" | "realestate.co.nz",
    "address_text": "42 Queen Street, Auckland Central"
  }
  ```
- Flow:
  1. Normalize `address_text`; call existing search service; apply exact-match rule (see above).
  2. If no match → return `{"matched": false}` with status 200 (NOT 204 — CORS preflight + credentials works better with 200).
  3. Resolve `address_id`. Fetch report via existing service (respect Redis cache).
  4. Run `enrich_with_scores(report)` to get the scores dict.
  5. Determine tier: anonymous → Level 0; authed free → Level 1; authed Pro → Level 2.
  6. Slice payload by tier (see below).
  7. Fire-and-forget: `track_event('extension_badge_rendered', user_id=..., properties={address_id, site})`.
  8. Return JSON.
- Rate limit: 60/min authed by `user_id`; 30/min anon by IP. Custom key function.

**Tiered payload shape (returned from `/badge`):**
```json
{
  "matched": true,
  "address_id": 12345,
  "full_address": "42 Queen Street, Auckland Central, Auckland",
  "tier": "anon" | "free" | "pro",
  "score": 68,
  "score_band": "moderate",
  "findings": [
    { "severity": "warning", "title": "Flood zone — 12% of this suburb; this property sits in it", "detail": "..." },
    ...
  ],
  "price_band": { "low": 870000, "high": 940000 },  // free + pro (wide band for free)
  "price_estimate": {                                // pro only
    "low": 820000, "median": 880000, "high": 920000,
    "confidence": 0.78,
    "comps": [{ "address": "...", "sale_price": 875000, "sale_date": "..." }]
  },
  "rent_estimate": { "low": 620, "median": 680, "high": 740, "yield_percent": 4.2 },  // pro only
  "walk_score": 82,                                  // pro only
  "schools": [{ "name": "...", "decile": 9, "zone": "in-zone" }],  // pro only
  "capabilities": {
    "save": false,        // true for free + pro
    "watchlist": false,   // true for free + pro
    "alerts": false,      // true for pro only
    "pdf_export": false   // true for pro only
  },
  "report_url": "https://wharescore.com/property/12345"
}
```

**Tier rules (strict):**
- **anon**: `findings` = 2 generic (no persona applied, no relative-baseline filtering); no `price_band`/`price_estimate`/`rent_estimate`/`walk_score`/`schools`; all capability flags false.
- **free**: `findings` = 2 persona-tailored via `select_findings_for_badge(report, persona, 2)` applying the relative-to-baseline + non-obvious-weighting rules; `price_band` present; `capabilities.save` + `capabilities.watchlist` true.
- **pro**: full persona-ranked `findings` list, `price_estimate` + `rent_estimate` + `walk_score` + `schools`; all capabilities true.

**`GET /api/v1/extension/status`**
- Public, no auth.
- Returns:
  ```json
  {
    "min_version": "0.1.0",
    "latest_version": "0.1.0",
    "sites": {
      "homes.co.nz":     { "badge_enabled": true },
      "oneroof.co.nz":   { "badge_enabled": true },
      "trademe.co.nz":   { "badge_enabled": true },
      "realestate.co.nz":{ "badge_enabled": true }
    },
    "message": null
  }
  ```
- Purpose: per-site kill-switch if a C&D arrives. Extension polls every 60 min via `chrome.alarms`.

### Backend wiring changes

1. **Register router** in `backend/app/main.py`: `app.include_router(extension.router)`.
2. **Update CORS** in `backend/app/config.py`: add `CORS_ALLOW_EXTENSIONS: bool = True` env var. In `main.py`, if true, add a regex origin matcher for `chrome-extension://.*` (dev) or specific extension ID (prod). Keep `allow_credentials=True` so cookies + Authorization work.
3. **Add per-user rate-limiter key function** in `backend/app/deps.py`:
   ```python
   def user_or_ip_key(request: Request) -> str:
       token = _extract_bearer(request)
       if token:
           try:
               payload = verify_jwt(token)
               return f"user:{payload['sub']}"
           except Exception:
               pass
       return get_remote_address(request)
   ```
   Use this as `key_func` on the two extension endpoints.

### Migration — optional, scoped

Phase 1 does NOT need new tables (no capture). Skip the migration.

If you want to track that a user has installed the extension (for dashboards), add `ALTER TABLE users ADD COLUMN IF NOT EXISTS ext_installed_at TIMESTAMPTZ;` in migration `0052_extension_install_flag.sql`. Update via a one-shot `POST /api/v1/extension/hello` called on first-run. Optional — nice-to-have, not blocking.

### Frontend `/api/auth/token` CORS

The 5-min JWT mint endpoint must also accept `chrome-extension://*` origin. Update its CORS config.

---

## Extension work

### New directory: `extension/` (sibling to `backend/` and `frontend/`)

```
extension/
  manifest.json                  — MV3
  src/
    background.ts                — service worker: token refresh, status polling, message router
    content/
      homes.ts                   — homes.co.nz/address/* extractor + badge mount
      oneroof.ts                 — oneroof.co.nz/property/* extractor + badge mount
      trademe.ts                 — trademe.co.nz/a/property/* extractor + badge mount
      realestate.ts              — realestate.co.nz/residential/* extractor + badge mount
    badge/
      Badge.ts                   — vanilla TS, Shadow DOM, slide-in, drag + dismiss
      styles.css                 — scoped to shadow root
    popup/
      popup.html, popup.ts       — status, site toggles, 24h pause, pause-all
    welcome/
      welcome.html, welcome.ts   — on first install
    lib/
      api.ts                     — token fetch, badge fetch, status fetch, retry + 401 refresh
      storage.ts                 — chrome.storage helpers (sync for settings, local for dismissals, session for JWT)
      extract.ts                 — site-agnostic helpers (normalizeAddress, parseJsonLd, metaTag)
  tests/
    extract-homes.test.ts        — fixture-based tests
    extract-oneroof.test.ts
    extract-trademe.test.ts
    extract-realestate.test.ts
    api.test.ts                  — token refresh, 401 retry, status polling
    fixtures/                    — ≥2 real HTML pages per site, saved .html
  build/
    vite.config.ts               — @crxjs/vite-plugin MV3 config, output extension/dist
  package.json                   — name "wharescore-badge", version 0.1.0
  README.md                      — dev + sideload + packaging
  PRIVACY.md                     — publicly linked from the Chrome Web Store listing
```

### `manifest.json` essentials

```json
{
  "manifest_version": 3,
  "name": "WhareScore Badge",
  "version": "0.1.0",
  "description": "Instant WhareScore risk score on any NZ property listing.",
  "permissions": ["storage", "alarms"],
  "host_permissions": [
    "https://wharescore.com/*",
    "https://homes.co.nz/*",
    "https://www.oneroof.co.nz/*",
    "https://www.trademe.co.nz/*",
    "https://www.realestate.co.nz/*"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_popup": "popup.html" },
  "content_scripts": [
    { "matches": ["https://homes.co.nz/address/*"], "js": ["content-homes.js"] },
    { "matches": ["https://www.oneroof.co.nz/property/*"], "js": ["content-oneroof.js"] },
    { "matches": ["https://www.trademe.co.nz/a/property/*"], "js": ["content-trademe.js"] },
    { "matches": ["https://www.realestate.co.nz/*/listing/*"], "js": ["content-realestate.js"] }
  ]
}
```

**No `cookies` permission in Phase 1** — the extension does NOT read cookies. It uses `credentials: 'include'` on fetches to wharescore.com; the browser handles cookie attachment automatically because of the `host_permissions` entry for `wharescore.com`.

### Extraction strategy

For each site, `extract.ts` exports a PURE function `extractAddress(document: Document): string | null`:

1. First look for JSON-LD `<script type="application/ld+json">` with `RealEstateListing` or `SingleFamilyResidence` schema → use `address.streetAddress + addressLocality + addressRegion`.
2. Fall back to `og:title` or `og:url` meta tag if address parseable from it.
3. Fall back to a site-specific selector (documented per site in code comments).
4. Return `null` if nothing extractable. NEVER guess.

**Selectors must be verified against at least 2 real listing pages per site** before the test fixtures are committed. The agent MUST open the sites, view a real listing, capture the HTML, and confirm selectors match. DO NOT ship from guessed selectors.

### Badge UI

- 320×180px floating card, bottom-right, 16px viewport margin
- Shadow DOM root to isolate from host CSS
- Slide-in from right (respects `prefers-reduced-motion`)
- Dismissible `×` — per-address dismissal stored in `chrome.storage.local`, 7-day memory
- Draggable header — remembers position per-site in `chrome.storage.sync`
- Loading skeleton while backend responds (max 3s timeout)
- Error state: "WhareScore unavailable — try again" with a retry button; no crash, no console error spam
- Header: WhareScore wordmark + × button
- Body: score (48px, colour-banded: green <30, amber 30-60, red >60), 1-2 findings as chips
- Footer: "Save" button (Level 1+), "View full report →" (always), PRO tag (Level 2)

### Signed-out state

- Show Level 0 badge (score + 1 finding teaser)
- Save button disabled with tooltip "Sign in to save"
- Second finding chip shows "🔒 Sign in to see more" linking to `wharescore.com` login

### Multiple-properties page

- Only run the content script on single-listing URL paths (see manifest `matches`)
- Do not overlay on search-result pages (out of scope)
- Document as known limitation in README

---

## Frontend work

**New pages:**
- `frontend/src/app/extension/welcome/page.tsx` — first-install walkthrough (3 steps)
- `frontend/src/app/extension/transparency/page.tsx` — plain-language data practices
- `frontend/src/app/extension/privacy/page.tsx` — full privacy policy (required by Chrome Web Store 2026)

**Existing page update:**
- `frontend/src/components/property/PropertyReport.tsx` — add a subtle "Install our extension" prompt in the Free tier side rail (one-shot, dismissible)

---

## Privacy & consent (Chrome Web Store 2026 compliance)

The 2026 policy requires:
1. Privacy policy URL (mandatory)
2. Specific data-type disclosure in manifest
3. Justified permissions — narrowest possible
4. Public "Limited Use" affirmation on the extension's website

### What we MUST publish

1. **`wharescore.com/extension/privacy`** — comprehensive privacy policy (drafted as `extension/PRIVACY.md`, rendered by the Next.js page).
2. **`wharescore.com/extension/transparency`** — plain-language summary linking to privacy policy.
3. **Limited Use affirmation** (must appear verbatim on privacy page AND homepage footer):
   > "The use of information received from WhareScore APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. WhareScore does NOT collect, store, or transmit any content from the third-party property listing sites on which the badge is displayed. The extension only sends the address shown on the page to WhareScore in order to compute the risk score."
4. **Manifest data disclosures** (2026 requirement) — to be filled in during Chrome Web Store submission, not in code.

### What the extension actually collects

| Data | Collected? | How it's used | Retention |
|---|---|---|---|
| Property address text (from page) | Yes, transiently | Sent to WhareScore `/api/v1/extension/badge` for lookup | Logged as `app_events` row, address not stored separately |
| User's WhareScore email / JWT | Yes, for authed users | Authorisation only | In-memory (5-min JWT) + `app_events` for rendered badge |
| Browsing history | No | — | — |
| Host page content (bedrooms, photos, descriptions, prices) | **No** | — | — |
| Cookies from host sites | No | — | — |
| Screen/device fingerprint | No | — | — |

### User controls (popup)

- Global pause: "Pause WhareScore Badge for 24 hours"
- Per-site toggle: "Show badge on homes.co.nz / OneRoof / Trade Me / Realestate.co.nz"
- Uninstall: standard Chrome mechanism, no state retained server-side (or: 1-click "Delete my events" on the account page)

---

## Doc updates (same commit)

- `docs/FRONTEND-WIRING.md` § API-endpoints — add rows for `POST /api/v1/extension/badge` and `GET /api/v1/extension/status`
- `docs/SYSTEM-FLOWS.md` — add new section "Extension badge flow" with the 8-step golden path
- `docs/DATA-CATALOG.md` — no table changes in Phase 1 (note the optional `ext_installed_at` column if implemented)
- `CLAUDE.md` File Map — add `extension/` line
- `PROGRESS.md` — top-of-file summary entry
- `CLAUDE.md` Routing Table — add row: "Build / update browser extension → `extension/`, update `FRONTEND-WIRING.md § API-endpoints`"

---

## Success criteria

1. `docker compose --profile dev up -d` clean. No migration strictly required for Phase 1.
2. Backend tests pass (new `backend/tests/test_extension.py`):
   - Anon: returns 2 generic findings; no `price_band`/`price_estimate`/`rent_estimate`; all capabilities false.
   - Free: returns 2 persona-tailored findings; `price_band` present; `capabilities.save` + `capabilities.watchlist` true; `alerts`/`pdf_export` false.
   - Pro: returns full findings list, `price_estimate`, `rent_estimate`, `walk_score`, `schools`; all capabilities true.
   - Unresolvable address returns `{"matched": false}`
   - Missing `X-WhareScore-Extension` header → 400
   - Rate limit 60/min authed → 61st returns 429
   - Rate limit 30/min anon → 31st returns 429
   - `/status` returns site list
   - `select_findings_for_badge` tests: persona ranking (renter vs buyer), relative-to-baseline drops at-or-below-median signals, local-prevalence >70% gets dropped, non-obvious signals rank above photo-visible ones.
3. Extension tests pass:
   - ≥2 fixtures per site (8+ fixture tests total) for address extraction
   - `api.ts` 401-retry-with-token-refresh passes
   - `api.ts` status poll respected
4. `cd extension && npm install && npm run build` produces `extension/dist/` loadable as unpacked extension in Chrome.
5. Manual E2E (document with screenshots described):
   a. Load unpacked in Chrome → welcome page auto-opens
   b. Sign out of wharescore.com → visit `homes.co.nz/address/...` (real URL) → anon badge appears with score + 2 generic findings, Save disabled.
   c. Sign in at wharescore.com → refresh the homes.co.nz page → free badge shows 2 persona-tailored findings + price band + Save enabled.
   d. Click "Save" → saved property appears on wharescore.com/my-properties
   e. Repeat on OneRoof, Trade Me, realestate.co.nz — badge works on each
   f. Dismiss badge on property X → reload → stays dismissed
   g. Toggle "Pause 24h" in popup → badge does not render
   h. Simulate `badge_enabled: false` for homes.co.nz in `/status` response → within poll interval, extension stops rendering on homes.co.nz only
6. `wharescore.com/extension/welcome`, `/transparency`, `/privacy` pages render with correct content.
7. Privacy policy contains the verbatim Limited Use affirmation.

---

## Deliverables (summary to post when done)

- Path list of every file created/modified
- Whether migration 0052 was created (only if `ext_installed_at` implemented)
- Full test output (backend + extension)
- Described screenshots: Level 0, Level 1, Level 2 badges; popup; welcome; transparency; privacy pages
- Selector risk register: for each of the 4 sites, list the selectors used and what will break them
- Explicit list of Phase-2 follow-ups NOT shipped:
  - Data capture / contribution mechanic
  - Contribution reward credits
  - Firefox + Edge repackaging
  - Chrome Web Store submission + screenshots + store assets
  - OneRoof / Trade Me / realestate.co.nz ToS individual reviews for capture eligibility
  - Per-site capture integrations (Trade Me API, realestate.co.nz FeedAPI — both free with approval)

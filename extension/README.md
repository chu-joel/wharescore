# WhareScore Badge — Browser extension (Phase 1)

Floating badge that shows the WhareScore risk score + top findings on every
supported NZ property listing page. Reads the listing address from the
page DOM; sends **only** that address to WhareScore. Nothing from the host
page (bedrooms, photos, price, agent info) is captured, stored, or forwarded.

## Supported sites (Phase 1)

| Site | Status | Selector primary | Fallback |
|---|---|---|---|
| homes.co.nz | Shipping | `h1[class*="summary_address"]` | `<title>` strip |
| oneroof.co.nz | Shipping | JSON-LD `SingleFamilyResidence.address` | `<h1>` containing a digit |
| realestate.co.nz | Shipping | JSON-LD `SingleFamilyResidence.address` | og:title strip |
| trademe.co.nz | **Off by default** | Angular SPA — selectors pending fixture capture | — |

Trade Me ships with `badge_enabled: false` in `/api/v1/extension/status`.
Flip the flag in the backend once verified rendered-page fixtures land in
`extension/tests/fixtures/trademe/`.

## Dev

```bash
cd extension
npm install
npm run dev       # vite watch build into extension/dist
```

Load the unpacked extension in Chrome:
1. `chrome://extensions` → toggle Developer mode.
2. Load unpacked → choose `extension/dist`.
3. The welcome page opens automatically on first install.

## Tests

```bash
npm test          # vitest: 4 fixture suites + api.ts unit tests
```

Fixtures are real-captured HTML committed at `extension/tests/fixtures/`.
If a site restructures its listing page the tests will fail — the extractor
MUST be re-verified against fresh HTML before shipping an updated build.

## Packaging

```bash
npm run build
```

Output is `extension/dist/` — zippable for Chrome Web Store submission.

## Privacy

See `PRIVACY.md`. The verbatim Limited Use affirmation required by the
2026 Chrome Web Store User Data Policy is included at the top.

## Wiring reference

- Badge API: `POST /api/v1/extension/badge` — body = `{source_site, address_text, source_url?}`
- Status: `GET /api/v1/extension/status` — polled every 60 minutes via `chrome.alarms`
- Auth: `GET https://wharescore.co.nz/api/auth/token` — short-lived (5 min) HS256 JWT
- Save: `POST /api/v1/account/saved-properties` — authed only

## Selector risk register

| Site | What could break the extractor |
|---|---|
| homes.co.nz | Class rename away from `summary_address`; dropping the `<title>` pattern `Free property data for X - homes.co.nz` |
| oneroof.co.nz | JSON-LD removal; h1 losing all digits |
| realestate.co.nz | JSON-LD removal; og:title pattern drift (e.g. "For Sale" → "Sale") |
| trademe.co.nz | Still unshipped — selectors TBD |

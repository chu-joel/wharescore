---
feature: extension-badge-phase1
brief: EXTENSION-BRIEF.md
capture: extension/tests/visual/capture.spec.ts
owner: local calm-puffin + opus-verify-session
last_updated: 2026-04-19
allowed_paths:
  - extension/src/badge/**
  - extension/src/lib/constants.ts
  - extension/tests/visual/**
  - backend/app/services/report_html.py
  - backend/app/routers/extension.py
---

# /verify criteria — WhareScore Badge (Phase 1, Option B: isolated mount)

Strategy: the badge class (`extension/src/badge/Badge.ts`) is mounted directly in a Playwright test page with a stubbed `chrome.storage` API and seeded `BadgeResponse` payloads. Content-script injection quality on real listing pages is tested separately by the site-specific `extract-*.test.ts` files — /verify focuses on the badge's own UX.

## What this captures

| Dimension | Values |
|---|---|
| Tier × Persona | `anon` (no persona), `free_renter`, `free_buyer`, `pro_renter`, `pro_buyer` |
| Viewport | `mobile-375` (375×667), `tablet-768` (768×1024), `desktop-1440` (1440×900) |
| Interaction state | `default`, `loading`, `error`, `focus`, `hover`, `dismissed`, `ambiguous` (2+ address matches), `reduced-motion` |

**Total ceiling**: 5 × 3 × 8 = 120 shots. Actual: some state combinations are redundant (loading is tier-agnostic; ambiguous only makes sense in `free_buyer`). The capture script trims the matrix in `matrix.ts`. Expect ~60 shots.

## Capture fixtures (tier × persona payloads)

All fixtures target the SAME address (`address_id: 12345`, `"42 Queen Street, Auckland Central"`) — so variance between shots is purely tier/persona/state, never data-identity drift.

| Fixture | Findings rule applied | Price | Rent | Walk | Schools | Caps |
|---|---|---|---|---|---|---|
| `anon` | 2 generic (no persona, no rel-to-SA2) | — | — | — | — | all false |
| `free_renter` | 2 persona-tailored, rel-to-SA2, non-obvious weighted | `price_band` | — | — | — | save + watchlist |
| `free_buyer` | 2 persona-tailored, rel-to-SA2, non-obvious weighted | `price_band` | — | — | — | save + watchlist |
| `pro_renter` | Full persona-ranked list (5+ findings) | `price_band` + `price_estimate` | ✓ + yield | ✓ | ✓ | all true |
| `pro_buyer` | Full persona-ranked list (5+ findings) | `price_band` + `price_estimate` | ✓ + yield | ✓ | ✓ | all true |

Fixture data lives in `extension/tests/visual/fixtures.ts`. Each fixture is a `BadgeResponse` shape conforming to `extension/src/lib/constants.ts`.

## Persona target registers

| Persona | Target register (1-5 plain→expert) |
|---|---|
| renter | 2 (plain conversational) |
| buyer | 3 (informed consumer) |

If a single badge payload mixes registers (e.g. "Rent asking 12% above SA2 median" — reg 3 — but findings also say "LSN > 20" — reg 5), that's a persona fit failure.

## Feature-specific rules (ADDITIONAL to the standard /verify rubric)

1. **Findings relative-to-SA2 rule.** `free` and `pro` tiers: every finding copy must reference the local suburb/SA2 baseline, not an absolute threshold. "3 schools within 1km" = FAIL for free/pro. "6 schools within 1km — top-10% of Auckland suburbs" = PASS (relative framing). The `anon` tier is exempt from this rule per the brief — anon gets generic absolute findings.

2. **Tier leakage = CRITICAL.** If `price_estimate` / `rent_estimate` / `walk_score` / `schools` is visible in a `free` shot, that's a tier leak. Same for Pro capability buttons (alerts, PDF export) appearing with `capabilities.alerts=false` or `capabilities.pdf_export=false`. Cross-check the `.fixture.json` to confirm.

3. **Save button disabled for `anon`.** Spec: `capabilities.save=false` → Save button shown but disabled with tooltip "Sign in to save". The button must NOT be absent — it must be *visibly gated*. This tests the "gated looks gated, not absent" affordance rule.

4. **Sign-in upsell on `anon`.** Anon badge must include the locked-finding row: `🔒 Sign in for persona-tailored findings`. Not showing it = CRITICAL (reduces conversion motivation).

5. **Upgrade upsell on `free`.** Free badge must include the upgrade hint linking to `wharescore.co.nz/account?plan=pro` with copy mentioning *at least*: price estimate, rent + yield, walk score, PDF export. Missing or partial list = WARNING.

6. **No data leaks from host site.** Since Phase 1 is badge-only (no capture from host pages), the fixture must only contain data that would come from the WhareScore backend. The judge should scan the `.dom.html` for any string that looks like it came from a listing page (bedroom counts, agent names, price that wasn't in the fixture). This is a double-check against the brief's Scope rules.

7. **3-second test per tier** (specific to this feature):
   - `anon`: user sees a score + 2 findings + sign-in hint. Action? "Sign in to see more."
   - `free_renter`: score + rent fairness + healthy-homes hint + Save. Action? "Save or upgrade."
   - `free_buyer`: score + price-fairness + hazard note + Save. Action? "Save or compare comps."
   - `pro`: score + full breakdown + price/rent/schools. Action? "Open full report / export PDF."

8. **Ambiguous-match state: score disabled, Save hidden.** Per brief: "If 2+ ambiguous results → render badge with score-for-first + 'Multiple matches' chip; no Save option." Judge checks: chip visible, Save button hidden or disabled.

## Tier × persona content matrix (authoritative)

Cross-checked by the judge against every shot's DOM.

| Element | anon | free_renter | free_buyer | pro_renter | pro_buyer |
|---|---|---|---|---|---|
| Score (hero) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Score band label | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 generic findings | ✓ | — | — | — | — |
| 2 persona-tailored findings | — | ✓ | ✓ | — | — |
| 5+ persona-ranked findings | — | — | — | ✓ | ✓ |
| Sign-in hint (locked finding row) | ✓ | — | — | — | — |
| Price band (wide, CV × HPI) | — | ✓ | ✓ | — | — |
| Price estimate + comps + confidence | — | — | — | ✓ | ✓ |
| Rent estimate + yield | — | — | — | ✓ | ✓ |
| Walk score | — | — | — | ✓ | ✓ |
| School list (top 2) | — | — | — | ✓ | ✓ |
| PRO tag in header | — | — | — | ✓ | ✓ |
| Upgrade to Pro hint | — | ✓ | ✓ | — | — |
| Save button (enabled) | disabled | ✓ | ✓ | ✓ | ✓ |
| "View full report →" link | ✓ | ✓ | ✓ | ✓ | ✓ |

## Known acceptable exceptions

- The `ambiguous` state intentionally hides Save even on `free`/`pro` — per brief. Not a bug.
- The `anon` tier's 2nd finding is a locked sign-in teaser, not a real finding. Don't flag it for failing rel-to-SA2.

## Cells OK to skip

- `loading` × all tier/personas: loading UI is tier-agnostic. Capture once per viewport using `free_buyer` fixture, skip the tier fan-out.
- `error` × all tier/personas: same — capture once per viewport.
- `dismissed` × all tier/personas: dismissed is terminal state with no badge visible — capture once per viewport to confirm the badge fully removes (not just hides).
- `ambiguous` only in `free_buyer` — represents the brief's specified UX path.
- `reduced-motion` only on `default` + `free_buyer` — we're checking animations are suppressed, not a separate rendering.

## Notes for the judge

- **Strictness: very strict.** This is first-impression UX on third-party sites. Half-polished = damaging to brand perception. Flag aggressively.
- **Persona-tailored means persona-tailored.** If `free_renter` and `free_buyer` findings read similarly, they're not tailored. Expect meaningful diff in framing, priorities, and copy.
- **Editorial worth lens is paramount here.** The badge is 320×180px — space is scarce. Every element must justify its footprint.
- **Consistency across the 3 viewports.** If badge position, size, or information density shifts unexpectedly between mobile and desktop, flag it.
- The sign-in + upgrade upsells are conversion-critical. Judge them with conversion-rate rigour: are they visible, is the value proposition clear, does the action feel worth taking?

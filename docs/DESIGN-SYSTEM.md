# Design system — current state

> Human-readable index. Token source-of-truth lives in `docs/DESIGN.md` (impeccable also reads it). Audience and brand voice live in `docs/PRODUCT.md`.

## What exists today (route group `new`)

| Path | Status | Notes |
|---|---|---|
| `frontend/src/styles/tokens-new.css` | ✅ done | OKLCH tokens, light + dark, scoped overrides for shadcn under `.ws-new` |
| `frontend/src/app/new/layout.tsx` | ✅ done | wraps children in `.ws-new` and loads tokens |
| `frontend/src/app/new/page.tsx` | ✅ done | landing + map split (A6 design) |
| `frontend/src/app/new/property/[id]/page.tsx` | ✅ done | redirects to `/new?address=[id]` (matches classic) |
| `frontend/src/app/new/report/[token]/page.tsx` | ✅ done | hosted Quick / Full inside new chrome |
| `frontend/src/app/new/compare/page.tsx` | ✅ done | new chrome around existing CompareView |
| `frontend/src/app/new/account/page.tsx` | ↪ redirect | classic UI for now |
| `frontend/src/app/new/suburbs/page.tsx` | ↪ redirect | classic UI for now |
| `frontend/src/app/new/suburb/[code]/page.tsx` | ↪ redirect | classic UI for now |
| `frontend/src/app/new/signin/page.tsx` | ↪ redirect | classic UI for now |
| `frontend/src/app/new/{about,help,privacy,terms,contact,changelog}/page.tsx` | ↪ redirect | static pages, classic UI |
| `frontend/src/components/new/AppHeaderNew.tsx` | ✅ done | brand, theme toggle, UI toggle, sign-in |
| `frontend/src/components/new/UIToggle.tsx` | ✅ done | flips between `/` and `/new/`, persisted |
| `frontend/src/components/new/LandingPanelNew.tsx` | ✅ done | landing right-panel content |
| `frontend/src/components/new/PropertyReportNew.tsx` | ✅ done | composes 7 new sections + 4 classic ones (AISummary, BuyerSnapshot, RenterSnapshot+LandlordChecklist, CTA, Disclaimer) wrapped for token reskin |
| `frontend/src/components/new/sections/HeroBlockNew.tsx` | ✅ ported | eyebrow + address + score pill + persona toggle |
| `frontend/src/components/new/sections/CategoryScoreboardNew.tsx` | ✅ ported | 6-cat scoreboard, severity-coloured bars |
| `frontend/src/components/new/sections/KeyFindingsNew.tsx` | ✅ ported | findings with glyph + keyword + colour, gated/free split, upgrade trigger |
| `frontend/src/components/new/sections/IndicatorGrid23New.tsx` | ✅ ported | every indicator, lower-is-better aware |
| `frontend/src/components/new/sections/ComparisonBarsNew.tsx` | ✅ ported | 5 SA2-median bars, NZDep inversion |
| `frontend/src/components/new/sections/DataLayersNew.tsx` | ✅ ported | 8-14 layer rows with source attribution |
| `frontend/src/components/new/sections/CoverageNew.tsx` | ✅ ported | per-category coverage grid |
| `frontend/src/components/new/ui/primitives.tsx` | ✅ done | Card, SeverityTag, Pill, Badge, StatGrid, Stat, IndicatorChip, BarRow, LayerRow, Finding, Accordion, PersonaToggle |

The classic AppHeader now also includes `<UIToggle here="old" />` so users can flip to the new UI from anywhere in the app.

## How the wrapping strategy works

The new `new` route group preserves **100% of existing functionality**. Pages either:

1. **Render the existing component inside new chrome** (`PropertyReport`, `HostedReport`, `HostedQuickReport`, `CompareView`). The wrapping `<div data-ws-new-wrapper>` is the trigger for scoped CSS overrides in `tokens-new.css` that remap shadcn tokens (`--background`, `--card`, `--primary`, `--border`, `--muted-foreground`, etc.) onto the new OKLCH palette. Net effect: the existing component automatically picks up new colours, neutrals, and spacing without code changes.

2. **Redirect to classic** (`/new/about`, `/new/help`, `/new/account`, `/new/signin`, `/new/suburb/[code]`, etc.). When we redesign these surfaces, swap the redirect for a real component.

This means **every classic gate, paywall, persona toggle, AI summary, advisor, recommendation list, and saved-property flow keeps working** — only the visual register shifts.

## Section porting plan (incremental, future PRs)

Each section gets a new `components/new/sections/{Name}.tsx` that the existing parent renders behind a feature flag. Order of porting:

1. **HeroBlock** — address line + score pill + verdict + persona toggle (replaces `PropertySummaryCard`)
2. **CategoryScoreboard** — 6-cat breakdown (replaces inline category bars)
3. **KeyFindings** — finding cards in new severity-glyph style (wraps `generateFindings()` logic)
4. **IndicatorGrid23** — full 23-indicator grid (new section)
5. **BuyerSnapshot / RenterSnapshot** — asymmetric stat grids
6. **ComparisonBars** — bar rows with reference marker
7. **DataLayersAccordion** — layer-row ledger
8. **HostedHero** — long-form score ring for hosted reports
9. **PriceAdvisorCard / RentAdvisorCard** — interactive verdict + scale
10. **RecommendationsList / LifestyleFitGrid** — for Full hosted

When a section is ported, swap its parent's import and remove the wrapping `data-ws-new-wrapper` override for that subtree.

## Documentation graph

| File | Purpose |
|---|---|
| [`PRODUCT.md`](./PRODUCT.md) | Audience, voice, anti-references, register rules — loaded by `impeccable` |
| [`DESIGN.md`](./DESIGN.md) | Tokens, components, severity rules, surface rules — loaded by `impeccable` |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) | This file. Implementation state. |
| [`design-experiments/`](../design-experiments/) | Static HTML probes — A1-A8, plus README |
| [`FRONTEND-WIRING.md`](./FRONTEND-WIRING.md) | Map of which component renders which field |

## Auditing

Run impeccable on any HTML probe:

```bash
# from the repo root
node ~/.agents/skills/impeccable/scripts/load-context.mjs   # picks up PRODUCT.md + DESIGN.md
# then ask Claude Code: /impeccable audit design-experiments/A8-real-snapshot.html
```

Real-runtime audits will work once the tree builds. Verify the route group:

```bash
cd frontend && npm run dev
# open http://localhost:3000/new
# open http://localhost:3000/new?address=2312429
# open http://localhost:3000/new/report/{any-existing-token}
```

# design-experiments/

Static HTML probes for the new WhareScore UI. Each file is self-contained (Inter via Google Fonts, Leaflet+Carto for maps). Open directly in a browser; no build step.

## What's here

| File | Surface | Source data |
|---|---|---|
| `A1-uiuxpromax.html` / `B1-frontend-design.html` | Extension welcome page (early probe) | Synthetic |
| `A2-uiuxpromax-app.html` / `B2-frontend-design-app.html` | App landing (map + panel) | Synthetic |
| `A3-uiuxpromax-report.html` | On-screen property report (early) | Synthetic |
| `A3-v2-uiuxpromax-report.html` | A3 hardened (distilled, OKLCH, mobile, dark) | Synthetic |
| `A4-real-data.html` | A3-v2 with real fast-API data | Live `/api/v1/property/2312429/report?fast=true` |
| `A5-hardened.html` | Comprehensive on-screen report | Same fast API + 23 indicators + accordions |
| `A6-balanced.html` | **Chosen on-screen design.** Production palette + A5 features | Same |
| `A7-hosted-full.html` | Hosted Full report (TOC, advisors, lifestyle fit) | Mostly real, AI/recs synthesized |
| `A8-real-snapshot.html` | **Chosen hosted design.** A7 with real snapshot data | `report_snapshots.id=130` from prod |

## Audit history

| File | impeccable audit | Score |
|---|---|---|
| `A3-uiuxpromax-report.html` | first pass | 9 / 20 |
| `A4-real-data.html` | post distill+colorize+adapt | 17 / 20 |
| `A6-balanced.html` | not yet audited | — |
| `A8-real-snapshot.html` | not yet audited | — |

## Running impeccable audits

After `docs/PRODUCT.md` and `docs/DESIGN.md` exist (both committed 2026-05-09), impeccable's context loader picks them up automatically. From Claude Code in the repo:

```
/impeccable audit design-experiments/A8-real-snapshot.html
/impeccable distill design-experiments/A8-real-snapshot.html
/impeccable harden  design-experiments/A8-real-snapshot.html
```

Or run the loader manually to verify it sees the context:

```bash
node ~/.agents/skills/impeccable/scripts/load-context.mjs
```

## How these connect to the implementation

A6 → `frontend/src/app/(new)/page.tsx` + `(new)/?address=X` (on-screen).
A7/A8 → `frontend/src/app/(new)/report/[token]/page.tsx` (hosted).

Tokens defined in these probes → `frontend/src/styles/tokens-new.css`.
Component patterns in these probes → `frontend/src/components/new/ui/primitives.tsx`.

## Cached source data

| File | Purpose |
|---|---|
| `_real-report.json` | fast=true API response for address 2312429 |
| `_real-report-full.json` | non-fast response for same address |
| `_snap130.json` | full `report_snapshots` row 130 (Wellington Wakefield Street) |
| `_snap130_extracted.json` | extracted human-facing fields from snap130 |

These are git-ignored development scratch files and should not be committed in long-lived form.

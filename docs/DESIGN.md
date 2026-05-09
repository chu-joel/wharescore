# DESIGN.md

> Token-level source-of-truth for the new WhareScore UI. Loaded by `impeccable` on every command.
> Implements the A6 (on-screen) and A7 (hosted) design language.

## Colour strategy

**Restrained.** Tinted neutrals + one brand accent (`piq` teal) at ≤10% of any surface. Severity hues (`r-vlow` … `r-vhigh`) are reserved for severity meaning, never decoration. No `#000`, no `#fff`, no purple gradients, no glassmorphism, no gradient text.

## Tokens

All neutrals OKLCH-tinted toward 195-220° hue. Severity hex is fixed (matches the production `risk-*` scale).

### Brand

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ws-piq` | `#0D7377` | `#2BA9AE` | Primary accent. Buttons, focus, links. |
| `--ws-piq-dark` | `#0A5C5F` | `#4ec3c7` | Hover state, sidebar accents. |
| `--ws-piq-light` | `#B2DFDB` | `#134f53` | Tinted background for accordion icons. |
| `--ws-warm` | `#D4863B` | `#E8A158` | Secondary CTA only (download PDF). |
| `--ws-success` | `#2D6A4F` | `#4FAF7E` | "Strong", "in zone", positive deltas. |

### Severity (do not change)

| Token | Hex | Semantic |
|---|---|---|
| `--ws-r-vlow` | `#0D7377` | Off-site, clear, low concern |
| `--ws-r-low` | `#56B4E9` | Below-typical, mild caution |
| `--ws-r-mod` | `#E69F00` | Moderate (also the score-rating amber) |
| `--ws-r-high` | `#D55E00` | Elevated, warrants action |
| `--ws-r-vhigh` | `#C42D2D` | Critical |

### Neutrals (OKLCH, tinted)

| Token | Light | Dark |
|---|---|---|
| `--ws-bg` | `oklch(0.985 0.005 195)` | `oklch(0.13 0.014 220)` |
| `--ws-bg-2` | `oklch(0.965 0.008 195)` | `oklch(0.18 0.014 220)` |
| `--ws-surface` | `#ffffff`* | `oklch(0.20 0.014 220)` |
| `--ws-rule` | `oklch(0.91 0.010 195)` | `oklch(0.30 0.014 220)` |
| `--ws-rule-strong` | `oklch(0.80 0.012 195)` | `oklch(0.42 0.014 220)` |
| `--ws-ink` | `oklch(0.20 0.020 220)` | `oklch(0.96 0.008 195)` |
| `--ws-ink-soft` | `oklch(0.42 0.015 220)` | `oklch(0.78 0.012 195)` |
| `--ws-ink-mute` | `oklch(0.60 0.010 220)` | `oklch(0.62 0.012 195)` |

*`#ffffff` is the only exception to "no pure white" — kept for shadcn-card familiarity. The page background is the tinted `--ws-bg`, so cards still float against a tinted canvas.

### Radii, shadow, motion

| Token | Value |
|---|---|
| `--ws-radius-sm` | 8 px |
| `--ws-radius` | 12 px |
| `--ws-radius-lg` | 16 px |
| `--ws-shadow-sm` | `0 1px 2px rgba(13,115,119,.06)` |
| `--ws-shadow` | `0 1px 3px rgba(13,115,119,.08), 0 4px 12px rgba(13,115,119,.05)` |
| Motion | 180-220 ms `cubic-bezier(.2,.8,.2,1)`. All transitions guarded by `prefers-reduced-motion: reduce`. |

## Typography

**Inter only.** No serif. Tabular numbers (`font-variant-numeric: tabular-nums`) on every numeric value.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Page H1 (hero) | clamp(28-40 px) | 800 | letter-spacing −0.02 em |
| Section H2 (card-head) | 18 px | 700 | letter-spacing −0.01 em |
| Stat value (primary) | 32 px | 800 | letter-spacing −0.01 em |
| Stat value | 20-22 px | 700 | |
| Body | 14.5-15 px | 400 | line-height 1.55-1.6, max-width 65ch |
| Label / meta / pill | 10.5-12 px | 500-700 | letter-spacing 0.06-0.1 em, uppercase for pills |
| Code / mono | 12 px | 400 | `font-feature-settings: "tnum"` |

## Components

Every component is one row of one purpose. Never combine.

| Component | Path | Variants | Anti-pattern guard |
|---|---|---|---|
| `Card` | `components/new/ui/Card.tsx` | default, soft (no shadow) | Never nested. |
| `CardHead`, `CardBody` | same file | — | Body padding 18-24 px; never zero. |
| `Button` | `components/new/ui/Button.tsx` | ghost · outline · primary · warm | Min-height 36 px desktop, 44 px mobile. |
| `IconButton` | same | square 36/44 | Always has `aria-label`. |
| `Badge` | `components/new/ui/Badge.tsx` | low · mod · high · crit · info · accent | Used for tags, never for severity (use `SeverityTag`). |
| `SeverityTag` | `components/new/ui/SeverityTag.tsx` | crit · warn · info · good | **Renders glyph + keyword + colour**. WCAG 1.4.1. |
| `Pill` | `components/new/ui/Pill.tsx` | low · mod · high · crit | Layer-row outcome pills. |
| `StatGrid`, `Stat` | `components/new/ui/StatGrid.tsx` | 3-col, 3-col asymmetric (1.6/1/1) | Primary stat may span. |
| `IndicatorChip` | `components/new/ui/IndicatorChip.tsx` | r-vlow · r-low · r-mod · r-high · r-vhigh | Name + value + 3-px bar. |
| `Accordion` | `components/new/ui/Accordion.tsx` | wraps `<details>` | SSR-safe, no JS required. |
| `BarRow` | `components/new/ui/BarRow.tsx` | with `ref` marker for SA2 median | Inverts when "lower is better" (NZDep). |
| `LayerRow` | `components/new/ui/LayerRow.tsx` | always shows source | Never collapse the source line away. |
| `PersonaToggle` | `components/new/ui/PersonaToggle.tsx` | Buyer / Renter / Pro | 44 px touch base. |
| `ThemeToggle` | `components/new/ui/ThemeToggle.tsx` | light / dark | Persisted in `localStorage`. |
| `UIToggle` | `components/new/UIToggle.tsx` | new / classic | Persisted; flips path between `/` and `/new/`. |

## Surface rules

### On-screen report (`/new/?address={id}`)
- Map + panel split, 1fr / 600 px desktop, stacks at ≤960 px.
- Hero card with poster-style address line + score pill (not gauge).
- Score breakdown by 6 categories with mini bars.
- Free findings: 2 shown + upgrade gate.
- All sections cards, ≤16 px gap between cards.
- Footer: data sources line.

### Hosted report (`/new/report/{token}`)
- Long-form, single 920-px column, **TOC sidebar** at desktop.
- Hero: poster composition, share-friendly. Score ring (not pill) for emotional weight on the deliverable.
- All findings, no gates.
- Three new section types not in on-screen: **Price advisor**, **Rent advisor**, **HPI chart**, **Recommendations**, **Lifestyle fit**, **Event timeline**.
- Header actions: Print · Share · Email · Download PDF.
- `@media print` strips header / TOC / footer-actions; cards become break-inside: avoid.

## Accessibility

| Rule | Implementation |
|---|---|
| WCAG 1.4.1 (use of colour) | Severity always glyph + keyword + colour. |
| Touch targets ≥ 44 × 44 px | Mobile media query bumps every interactive. Persona toggle, theme toggle, layer pill all enforced. |
| Contrast ≥ 4.5:1 body, ≥ 3:1 large | Severity hex chosen to clear AA on tinted neutral backgrounds. Verified light + dark. |
| Focus-visible | 2 px `--ws-piq` outline, 2 px offset, on every interactive. |
| Reduced motion | `prefers-reduced-motion: reduce` disables all transitions and the selected-pin pulse. |
| Landmarks | `<header>`, `<nav>` (TOC), `<main>`. Heading hierarchy strict (H1 once per page, H2 per card). |
| Keyboard | Accordion uses `<details>` (native keyboard support). Persona-toggle is `role="tablist"` with `aria-selected`. |

## Absolute bans

- No `#000`, no `#fff` (except `--ws-surface` carve-out for cards).
- No purple gradients, no AI-style colour-on-light.
- No gradient text.
- No glassmorphism as default.
- No hero-metric template (big number + small label + supporting stats + gradient accent).
- No identical card grids of icon + heading + text.
- No nested cards.
- No side-stripe borders >1 px as decorative accent.
- No em dashes in copy. Use commas, semicolons, periods, colons, or parentheses.
- No "etc" / "and more" / "..." — list everything or don't list it.

## File map

| File | Role |
|---|---|
| `frontend/src/styles/tokens-new.css` | All tokens above as CSS custom properties + `[data-theme="dark"]` block. |
| `frontend/src/app/new/layout.tsx` | Loads `tokens-new.css`, sets `data-theme`, mounts `AppHeaderNew`. |
| `frontend/src/app/new/page.tsx` | Landing + map split (A2). |
| `frontend/src/app/new/property/[id]/page.tsx` | On-screen report (A6). |
| `frontend/src/app/new/report/[token]/page.tsx` | Hosted Quick / Full report (A7 / A8). |
| `frontend/src/components/new/ui/*` | Primitives in the table above. |
| `frontend/src/components/new/sections/*` | Section components (FindingsCard, BuyerSnapshot, IndicatorGrid, …). |
| `design-experiments/*.html` | Static probes; `/impeccable audit design-experiments/A8-real-snapshot.html` runs against the most current. |

## Update protocol

When you change a token, change `tokens-new.css` and update the table here in the same commit. Doc-update checklist (CLAUDE.md) requires it.

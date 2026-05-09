# PRODUCT.md

> Source-of-truth context for design and content decisions. Loaded by `impeccable` on every command.

## Product purpose

WhareScore is a property-intelligence platform for Aotearoa New Zealand. Users search any NZ address and receive:

- A **WhareScore** (0-100 composite) drawn from 23 indicator layers across hazards, environment, liveability, transport, market, and planning.
- An on-screen free preview (score + 2 findings + basic sections), visible at `wharescore.co.nz/?address={id}`.
- A **Quick Report** (free with sign-in, 8 sections, 30-day hosted link) at `/report/{token}`.
- A **Full Report** ($2.99 one-off, all 25+ sections, permanent hosted link, AI narrative, rent + price advisor, PDF export).
- A **Pro** subscription ($50/month) with unlimited Full Reports, comparison, watchlist.

The product exists because NZ listing sites (homes.co.nz, OneRoof, realestate.co.nz, Trade Me) tell you about *the property* but not about *its context*: hazard exposure, council planning, school zoning, infrastructure pipeline, crime, climate trend. WhareScore answers what the listing leaves out.

## Register

`product` — the design serves the data, the data is the product. Not a marketing landing page.

## Users

| Persona | What they need | How they use it |
|---|---|---|
| **Renter** | Is this rent fair? Is the place safe and warm? | Searches address before viewing. Generates Quick Report to sense-check listing claims. Reads rent advisor first, hazards second. |
| **Buyer** | Should I make an offer? At what price? What will it cost to insure? | Generates Full Report at shortlist stage. Sends hosted link to conveyancer. Reads price advisor + ownership costs + critical findings carefully. |
| **Pro** (agent, surveyor, investor, lender) | Repeatable due diligence across multiple addresses | Subscription. Compares two or three properties side-by-side. Trusts source attribution; will follow citation links when challenged by a client. |

## Brand voice

| Trait | What it means | What it isn't |
|---|---|---|
| **Sober** | Calm, factual register. NZ English. Numbers carry the weight. | Excitable, exclamation marks, hype. |
| **Source-attributed** | Every finding cites its dataset and authority. Users follow links. | Anonymous claims, "studies show", marketing copy without provenance. |
| **Strict** | Findings are SA2-relative not absolute. We name uncertainty (confidence %, missing layers, single-source data). | False precision. Pretending a 73% confidence model is the LIM. |
| **Persona-tuned** | Renter copy is shorter and direct (register 2/5). Buyer copy adds reasoning (3/5). Pro copy can carry technical detail (4/5). | One-tone-fits-all marketing speak. |
| **Plain** | "Earthquake-prone buildings within 300 m" not "EQB risk indicator score". Acronyms are spelled out on first use (EPB, NZDep, SA2). | Domain jargon as gatekeeping. |

## Anti-references — what we are NOT

- **Not a LIM**: WhareScore aggregates public datasets; it cannot replace a council Land Information Memorandum. Always say "the LIM is the source of truth" when the user is making a decision.
- **Not a registered valuation**: the price advisor is an ensemble model, not an appraisal. State it.
- **Not a SaaS dashboard**: no gauges-in-cards-in-grids. Editorial restraint over chart-heavy density.
- **Not Zillow or Trulia**: NZ-specific datasets (SA2, NZDep, AUP, GNS, EQC, MBIE EPB) are first-class; we do not paper over the differences.
- **Not Trade Me Property**: we do not sell listings, take agent fees, or bias findings toward sellers.
- **Not a generic risk score**: composite scores are explained — every indicator is visible with its source. No black box.

## Strategic principles

1. **Sources are the product.** Every finding, every layer, every recommendation cites its authority. Removing source attribution is never a UX simplification.
2. **Free preview must hurt enough to convert, but not enough to mislead.** The free on-screen view shows the score, the most-important 2 findings, and section headers; it never shows a bad score with a friendly summary or vice versa.
3. **Hosted reports are the deliverable.** They are what users send to their conveyancer; they need to look like a document, not a dashboard. Permanent links, share-friendly OG images, print-clean stylesheet.
4. **Pricing is unambiguous.** Free Quick (sign-in), $2.99 Full (one-off), $50/mo Pro. No hidden tiers, no add-ons.
5. **Coverage transparency.** "73% confidence, 23/23 layers" is a feature, not a footer. Users trust tools that admit what they don't know.
6. **Persona swap is lossless.** Toggling Renter / Buyer / Pro never destroys data; the same underlying snapshot is read through different lenses.
7. **One report = one snapshot.** Snapshots are immutable JSONB. Once generated, hosted reports work forever even if the underlying datasets change.

## Severity is colour + glyph + keyword

WCAG 1.4.1 (Use of Color). Severity in WhareScore is **always** rendered with three signals:

| Severity | Glyph | Keyword | Hex (light) |
|---|---|---|---|
| Critical | `!` | Critical | `#C42D2D` |
| Warning | `△` | Warning | `#D55E00` |
| Info | `i` | Info | `#0D7377` |
| Strong | `✓` | Strong | `#2D6A4F` |

A reviewer looking at a greyscale print of any WhareScore screen must still know which findings are critical.

## Surface inventory

| Surface | Audience | Register | Notes |
|---|---|---|---|
| `/` (landing + map) | First-time visitor | Marketing-adjacent (3/5) | Restrained colour, single accent. Hero invites a search. |
| `/?address={id}` (on-screen report) | Returning user, comparison | Tool (3/5) | Map + panel split. Free preview on-screen with upgrade gate. |
| `/report/{token}` (Quick / Full hosted) | Buyer mid-purchase, conveyancer | Document (4/5) | Long-form, no map sidebar, share-friendly hero, all sections. |
| Browser extension badge | Listing-site visitor | Glanceable (1/5) | Anonymous = score only; Free = +1 finding; Pro = +2 findings + advisor. |
| `/suburb/{sa2}` | Renter scoping a neighbourhood | Tool (3/5) | Suburb profile, baselines, school list. |
| `/compare` | Pro / decisive buyer | Tool (3/5) | Tri-state diff (present / negative-known / unknown). |

## Update protocol

Edit this file when the product changes — pricing, personas, anti-references, register rules. Keep PRODUCT.md as the single brief that downstream design tools (`impeccable`, etc.) load on every audit.

---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - IMPLEMENTATION-PLAN.md
  - MOBILE-UX-RESEARCH.md
  - RISK-SCORE-METHODOLOGY.md
  - FRONTEND-PLAN.md
  - docs/feature-todos.md
  - docs/backend/** (11 backend doc files)
---

# UX Design Specification — WhareScore

**Author:** Joelt
**Date:** 2026-03-15

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

WhareScore is a free, consumer-facing NZ property intelligence platform that aggregates 14+ government data sources to answer the question real estate listings never do: "What don't they tell you about this property?"

The core promise is risk transparency and actionable guidance. Not just "this property is in a flood zone" — but "here's what that means and what you should do about it." The product serves the gap between institutional-grade property risk data (CoreLogic, sold to banks) and what everyday New Zealanders can access when making the biggest financial decision of their lives.

Currently live for Wellington with 27 data indicators across 5 categories (Hazards, Environment, Liveability, Market, Planning), a map-first exploration interface, and AI-powered summaries.

### Target Users

**Three primary audiences sharing one interface:**

1. **First-Home Buyers (primary)** — Anxious, under-informed, making the biggest purchase of their life. They don't know what questions to ask. They need WhareScore to surface the risks they didn't know existed and tell them what to do about each one in plain English. They're checking WhareScore when they find a listing on TradeMe — before or after a viewing.

2. **Renters** — Comparing 3-5 flats, want to know if the rent is fair and if the neighbourhood is safe. They need quick answers: "Is this area dodgy? Am I overpaying? Are there better options nearby?" The rent comparison flow is their primary feature.

3. **Property Investors** — Data-comfortable, want yield numbers, market trends, and risk exposure. They care about the numbers behind the scores and want to compare multiple properties efficiently. They'll use WhareScore alongside their own due diligence.

**Usage contexts span the full property journey:**

- **Browsing/Discovery** — "I found a listing, what don't they tell me?" Needs quick risk snapshot, key findings
- **Comparing** — "Which of these 3 properties is safest?" Needs side-by-side comparison
- **Pre-Purchase/Pre-Offer** — "I'm about to make an offer tomorrow." Needs a due diligence checklist: what to ask the lawyer, what to check with insurance, what to raise with the building inspector. This is the highest-stakes moment and the highest-value use case
- **Renting** — "Is this rent fair? Is the area safe?" Needs rent comparison and neighbourhood safety

**Shared user context:**
- Most users are NOT currently checking government data sources manually — they trust the listing and the agent, or they don't know where to look
- Tech savviness varies widely — design must serve both "just tell me good or bad" AND "show me the data"
- Primary device is mobile (browsing listings on phone), but detailed research may shift to desktop
- The product sits in the "found a listing, now what?" moment of the property journey

### Key Design Challenges

1. **Three audiences, one interface** — Progressive disclosure must serve the nervous buyer who needs plain English AND the investor who wants raw numbers, without overwhelming either
2. **Data-rich without data-overwhelming** — 27 indicators is powerful but potentially paralysing. Users want the answer first, then the evidence
3. **The "so what" gap** — The biggest UX gap: the report tells users WHAT the risks are but not WHAT TO DO about them. Recommendations exist in the PDF but not on the web. This is the highest-value UX opportunity
4. **Score semantics** — Higher score = more risk, but users instinctively read higher = better. Needs clearer visual language
5. **Mobile-first property research** — Listings are browsed on phones. Map-to-report flow and report readability on mobile are critical

### Design Opportunities

1. **Be the "what should I do" tool** — No competitor provides actionable guidance to consumers. "You're in a flood zone → ask about flood insurance costs before making an offer" is worth more than any score number
2. **Contextual comparisons** — Suburb and neighbour comparisons transform raw data into decisions. "Crime is high here, but typical for Newtown" changes the entire meaning
3. **The listing companion** — Position as the tool you open alongside TradeMe/RealEstate.co.nz. Potential for browser extension or "paste listing URL" input
4. **Premium PDF as decision toolkit** — The PDF shouldn't just be a printout of the web. It should be a "Before You Buy" checklist with actionable steps, comparison data, and content not available on the free web page
5. **The pre-purchase checklist** — When a user is about to buy, the report becomes a decision tool. A "Ready to make an offer?" section with a personalised due diligence checklist based on that property's specific risks (flood zone → check insurance, EPB nearby → ask lawyer about seismic risk, contaminated land → request LIM report) could be the single most valuable feature — and a strong justification for the paid PDF tier

## Core User Experience

### Defining Experience

The core experience of WhareScore is a single, seamless flow: **paste an address → receive interpreted intelligence you can't get anywhere else.**

This is not a data dashboard. It's not a score card. It's an intelligence report that:
- Surfaces risks the user didn't know existed
- Interprets what those risks actually mean in plain English
- Tells them exactly what to do about each one
- Provides data-driven facts that can't be found by Googling

The ONE interaction that must be perfect: the moment a user sees their property report. Within 5 seconds of the report loading, they must see a fact that makes them think "I had no idea." Within 30 seconds, they must understand what to do about it.

Every element of the report — scores, indicators, comparisons, recommendations — serves this single purpose: turning government data into personal, actionable intelligence.

### Platform Strategy

- **Web-first, mobile-primary** — Users browse property listings on their phones and paste addresses into WhareScore on mobile. The report must be fully readable and usable on a 375px screen.
- **Desktop for deep research** — Investors and serious buyers may shift to desktop for comparing multiple properties and reading detailed breakdowns. The map + split panel layout serves this mode.
- **PDF for offline action** — The premium PDF serves the pre-purchase moment: printable, shareable with lawyers/inspectors/banks, works without internet at an open home.
- **No native app needed (for now)** — Progressive web app patterns (fast load, home screen installable) provide app-like experience without app store friction.

### Effortless Interactions

These interactions must feel automatic — zero thought required from the user:

1. **Risk surfacing** — The report auto-identifies the most critical findings and leads with them. No digging through accordions to find that the property is in a flood zone. Critical risks surface themselves.
2. **Due diligence checklist generation** — Based on what the report finds, a personalised "what to do" checklist auto-generates. Flood zone? "Check insurance availability and cost." EPB nearby? "Ask your lawyer about seismic risk to neighbouring buildings." No manual assembly.
3. **Contextual interpretation** — Every stat is automatically compared against suburb and city averages. "Crime score: 65" becomes "Crime is higher than average for Wellington, but typical for this suburb." The user never has to wonder "is this good or bad?"
4. **Smart report ordering** — Sections re-prioritise based on what matters for this specific property. A coastal property leads with tsunami/erosion. An inner-city apartment leads with noise/earthquake-prone buildings. The report adapts to the property.
5. **Plain English throughout** — Every technical term is automatically translated. "Liquefaction susceptibility: Very High" becomes "The ground here could become unstable during a major earthquake, similar to what happened in Christchurch."

### Critical Success Moments

1. **The "holy shit" moment (0-5 seconds)** — User sees key findings immediately on report load. A fact they didn't know. "This property is in a 1% flood zone." "There are 3 earthquake-prone buildings within 300m." This is the hook that proves WhareScore's value.
2. **The "so what" moment (5-30 seconds)** — User scrolls past the finding and sees what it means and what to do. "This means the property has a 1-in-100 chance of flooding each year. Before making an offer: check flood insurance availability with your insurer, request the LIM report from council, ask the agent about historical flooding."
3. **The "I can't get this anywhere else" moment** — User sees suburb comparisons, neighbour comparisons, trend data, and AI-interpreted summaries that would take hours of manual research across 14 government websites. This is the moat.
4. **The "I'm ready to act" moment** — User finishes reading and has a clear checklist of next steps. They know what questions to ask, who to ask, and what to look out for. They feel informed and confident, not scared and confused.

### Experience Principles

1. **Facts first, scores second** — Lead with specific, data-driven findings ("flood zone", "3 EPBs nearby"), not abstract numbers. Scores summarise; facts convince.
2. **Always answer "so what?"** — Every finding must be paired with interpretation and action. Never show a risk without explaining what it means and what to do about it.
3. **Interpret, don't just aggregate** — The value isn't combining 14 data sources — it's interpreting them together. "High wind zone + steep slope + old building = specific concerns to raise with your building inspector."
4. **Adapt to the property** — No two reports should feel identical. Lead with what matters for THIS property. A flat in the CBD has different priorities than a hillside house in Island Bay.
5. **Simple surface, depth available** — Default view shows interpreted findings in plain English. Data-comfortable users can expand to see raw numbers, methodology, and comparisons. Progressive disclosure, not dumbing down.

## Desired Emotional Response

### Primary Emotional Goals

The emotional arc of WhareScore follows a deliberate progression:

**Shock → Understanding → Empowerment → Confidence**

- **Shock/Gratitude** — "I had no idea this property was in a flood zone. Thank god I checked."
- **Understanding** — "Okay, so this is what that actually means for me."
- **Empowerment** — "Now I know exactly what to ask my lawyer, my insurer, and the agent."
- **Confidence** — "I can make this decision with my eyes open."

WhareScore is NOT a "don't buy" tool. It never tells users to walk away. It uses facts to warn of potential and ongoing risks, then empowers them to act. The user decides — WhareScore ensures they decide informed.

### Emotional Journey Mapping

| Moment | User State | Desired Emotion | Design Approach |
|--------|-----------|----------------|-----------------|
| First visit | Curious, maybe sceptical | Intrigue — "this looks useful" | Clean, trustworthy UI. Show value immediately with a real example. No signup walls. |
| Searching an address | Anticipation, slight anxiety | Ease — "that was simple" | Fast autocomplete, instant results, zero friction. |
| Report loads | Eager, impatient | Surprise — "wow, I didn't know that" | Lead with key findings, not loading spinners. Skeleton → facts in under 2 seconds. |
| Reading findings | Potentially alarmed | Understanding — "okay, I get what this means" | Every finding paired with plain English explanation. No jargon without context. |
| Seeing recommendations | Processing implications | Empowerment — "I know what to do" | Clear, actionable checklist. Not "you should worry" but "here's your next step." |
| Clean report (no risks) | Uncertain if it's working | Reassurance — "this property checks out" | Positive framing: "No significant hazards detected. This property scores well across all risk categories." Don't just show empty states. |
| Comparing properties | Decision fatigue | Clarity — "I can see the difference" | Side-by-side comparison that highlights meaningful differences, not data dumps. |
| Pre-purchase moment | High stakes, stress | Confidence — "I'm ready to make this offer" | Due diligence checklist personalised to this property. "You've reviewed the key risks. Here's what to action before your offer." |
| Sharing with others | Excited about discovery | Pride — "look what I found" | Shareable format with compelling preview. The user becomes the smart friend who does their homework. |
| Returning user | Familiar, purposeful | Trust — "this is my go-to tool" | Saved properties, recent searches, consistent quality across every report. |

### Micro-Emotions

**Critical to get right:**

- **Trust over scepticism** — The #1 emotional risk. If users don't trust the data, nothing else matters. Every fact must link to its government source. Methodology must be transparent. Confidence scores must be honest about gaps.
- **Empowerment over fear** — Finding out your dream home is in a flood zone is scary. The design must immediately pivot from "here's the risk" to "here's what to do." Never leave the user sitting with fear.
- **Confidence over confusion** — 27 indicators could overwhelm. The report must feel like a guided conversation, not a data dump. "Here are the 3 things that matter most about this property" before anything else.
- **Accomplishment over frustration** — After reading a report, the user should feel like they've done something valuable — like they've completed due diligence that would have taken hours across 14 websites.

**Emotions to actively avoid:**

- **Panic** — Never frame risks as catastrophic without context. "1% flood zone" should be explained as probability, not presented as imminent danger.
- **Paralysis** — Never overwhelm with so many risks that every property looks terrible. Context and comparison ("this is typical for Wellington") prevents analysis paralysis.
- **Distrust** — Never show a score without explaining how it was calculated. Never present data without sourcing it. Never hide confidence gaps.
- **Guilt** — Never make users feel stupid for not checking this before. The framing is "now you know" not "you should have known."

### Design Implications

| Emotional Goal | UX Design Approach |
|---------------|-------------------|
| Trust | Source attribution on every data point. "Data: GWRC Flood Hazard Map, 2024." Transparent scoring methodology. Confidence badges showing data coverage. |
| Empowerment over fear | Every risk finding immediately followed by an action card. Red alert for the risk, blue/green card for what to do. Visual separation between "the problem" and "the solution." |
| Confidence | Summary-first design. Key findings at the top. Scores that are immediately understandable. Comparison context ("vs suburb", "vs city") on every metric. |
| Surprise/Delight | The "holy shit" moment must be visual, not buried in text. Full-width alert banners for critical findings. Map highlights that show the risk spatially. |
| Reassurance (clean report) | Positive findings get celebration treatment too. Green checkmarks, "No flood risk detected", "Low crime area." Don't just skip sections with no data — actively reassure. |
| Pride in sharing | Rich social preview cards with property image, score, and key finding. "162 Cuba Street: 3 risks found. See the full report." Makes the sharer look smart. |

### Emotional Design Principles

1. **Warn, don't scare** — Present risks as facts with context and probability, not as alarms. "This property is in a 1% Annual Exceedance Probability flood zone — meaning there's roughly a 1-in-100 chance of flooding in any given year" is better than "FLOOD RISK: HIGH."
2. **Every red flag gets a green action** — No finding exists without a corresponding recommendation. The emotional beat is always: concern → context → action. Never leave the user in the concern.
3. **Earn trust with transparency** — Show your sources, show your methodology, show your confidence level. When data is missing, say so honestly. Users trust tools that admit what they don't know.
4. **Celebrate the good** — A property with no significant risks deserves celebration, not silence. "This property scores in the top 20% for safety in Wellington" is as valuable as identifying risks.
5. **You're the smart friend, not the authority** — WhareScore's voice is the knowledgeable friend who says "hey, you should know about this" — not the government inspector who says "this property fails." Conversational, helpful, never condescending.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Zillow / Redfin (Property Platforms)**
- Map-first exploration with property pins that reveal key info on hover
- Property pages lead with photos, then key facts, then details
- Mobile bottom sheet pattern for map-to-detail transitions
- Save/compare properties across sessions

**First Street Foundation (Risk Visualisation)**
- Separate scores per hazard type — never a single misleading composite
- Plain English risk summaries: "This property has a 26% chance of flooding over the next 30 years"
- Visual flood/fire/wind overlays on the property map
- "What this means for you" sections after every risk finding

**Google Maps (Map UX)**
- Bottom sheet with peek/half/full snap points — the gold standard
- Search → flyTo → info panel flow is seamless
- Layer toggles (traffic, transit, satellite) are simple chip toggles
- Works identically well on mobile and desktop

**Monzo / Wise (Complex Data Made Simple)**
- Financial data presented as plain English summaries first, numbers second
- Colour-coded status (green = fine, amber = watch, red = action needed)
- Progressive disclosure: summary → tap for breakdown → tap for full detail
- Notifications framed as actions, not just alerts

**Consumer NZ / Canstar (Rating/Comparison Tools)**
- Star ratings and badges for quick scanning
- Side-by-side comparison tables
- "Our verdict" editorial summary before the data
- Traffic light systems (green/amber/red) for instant comprehension

### Transferable UX Patterns

**Navigation & Layout:**
- Bottom sheet (Google Maps) — already implemented, proven for map+detail UX
- Split view desktop / bottom sheet mobile (Zillow) — already implemented
- Chip bar for layer toggles (Google Maps) — already implemented

**Information Hierarchy:**
- Summary verdict first, data second (Consumer NZ, Monzo) → apply to report: key findings at top, accordion details below
- Traffic light system (Canstar) → apply to indicators: green/amber/red with plain English label, not just scores
- "What this means" sections (First Street) → apply to every risk finding: fact → interpretation → action

**Interaction Patterns:**
- Progressive disclosure (Monzo) → summary card → expand for details → expand for raw data/methodology
- Pre-filled smart defaults (Wise) → auto-detect property type for rent comparison instead of making user select
- Contextual actions (Redfin) → "Share this property" with rich preview, "Save for later", "Download report"

**Data Presentation:**
- Probability framing (First Street) → "1-in-100 chance per year" instead of "1% AEP flood zone"
- Comparison bars (Monzo spending) → "Your property vs suburb average" horizontal bar charts
- Timeline visualisation (Wise) → rent trend and HPI charts already exist, ensure they're prominent

### Anti-Patterns to Avoid

1. **Data dump without hierarchy** (CoreLogic reports) — Pages of tables with no guidance on what matters. Every number has equal visual weight. Users drown in data.
2. **Score without explanation** (generic rating sites) — A number in a circle means nothing without context. "42/100" is meaningless. "Low risk — safer than 58% of Wellington properties" tells a story.
3. **Fear-based alerts** (some weather apps) — RED ALERT banners for everything create panic and eventually get ignored. Reserve strong visual warnings for genuinely critical findings only.
4. **Mandatory signup before value** (many SaaS products) — Forcing login before the user sees any value kills conversion. Show the full free experience first.
5. **Desktop-first responsive afterthought** (government data portals) — GWRC flood maps are barely usable on mobile. This is a competitive advantage for WhareScore.
6. **Hiding methodology** (black-box scoring) — Users distrust scores they can't understand. Always show "How is this calculated?" link.

### Design Inspiration Strategy

**Adopt directly:**
- Google Maps bottom sheet mechanics (already done)
- First Street's "What this means" pattern for every risk finding
- Traffic light visual system (green/amber/red) for instant indicator comprehension
- Consumer NZ's "verdict first" pattern — key findings before data

**Adapt for WhareScore:**
- Zillow's property comparison → simplified for 3-5 properties max, focused on risk differences not feature lists
- Monzo's progressive disclosure → three levels: finding → interpretation → raw data + methodology
- First Street's probability framing → translate all technical terms to everyday language ("1-in-100 chance" not "1% AEP")

**Avoid:**
- CoreLogic's data-dump approach — every stat needs hierarchy and interpretation
- Generic composite scores without category breakdown — keep the 5 separate category scores prominent
- Fear-driven design — WhareScore warns, it doesn't scare

## Design System Foundation

### Design System Choice

**Tailwind CSS + shadcn/ui** (Themeable System — already implemented)

This is the right choice for WhareScore. shadcn/ui provides accessible, unstyled primitives (Button, Card, Badge, Accordion, Sheet, Dialog, Select) that are fully customisable via Tailwind. No vendor lock-in — components live in your codebase.

### Rationale for Selection

- **Speed + flexibility** — shadcn/ui gives production-ready components that are fully customisable. No fighting a design system's opinions.
- **Tailwind utility-first** — Perfect for responsive, mobile-first design with minimal CSS overhead. Already configured with custom `piq-primary` colours and design tokens.
- **Accessibility built-in** — shadcn/ui uses Radix primitives under the hood, which handle ARIA attributes, keyboard navigation, and focus management correctly.
- **Solo developer friendly** — No design team needed. Components look professional out of the box and can be progressively refined.
- **Performance** — Tailwind purges unused CSS. shadcn/ui components are tree-shaken. No heavy UI framework bundle.

### Implementation Approach

**Current state (already built):**
- shadcn/ui components: Button, Card, Badge, Input, Select, Dialog, Sheet, Accordion, Tabs, Tooltip
- Custom components: ScoreGauge, IndicatorCard, MapContainer, PropertyReport, RentComparisonFlow
- Tailwind config with custom colours (`piq-primary`), Inter font, responsive breakpoints
- Dark mode support via `suppressHydrationWarning`

**What needs to evolve:**
- **Traffic light colour system** — Extend the current 5-bin colour scale (Very Low → Very High) with clearer semantic meaning. Green/amber/red should be instantly understood without reading labels.
- **Action card component** — New component type: follows a risk finding with "What to do" guidance. Visual pattern: red/amber alert → blue/green action card.
- **Comparison bar component** — New component for "this property vs suburb vs city" horizontal bar comparisons.
- **Checklist component** — Interactive checklist for due diligence recommendations. Checkbox + action + optional link.
- **Finding card component** — Replaces current IndicatorCard for key findings. Larger, more prominent, plain English headline + interpretation + action.

### Customization Strategy

**Design tokens to refine:**

| Token | Current | Evolution |
|-------|---------|-----------|
| Risk colours | 5-bin scale (teal → red) | Add semantic traffic light (green/amber/red) for instant comprehension |
| Typography | Inter, standard scale | Add a "finding headline" size — larger, bolder for key findings |
| Spacing | Default Tailwind | No change needed |
| Border radius | `rounded-xl` on cards | Consistent across all card types |
| Shadows | Default | Elevate critical finding cards with stronger shadow |

**Component evolution priority:**
1. FindingCard — the "holy shit" moment component (critical findings, prominent)
2. ActionCard — the "what to do" component (paired with every risk)
3. ComparisonBar — "vs suburb / vs city" visual comparison
4. DueDigligenceChecklist — pre-purchase printable checklist
5. SuburbSummaryCard — for the planned suburb search feature

## Defining Experience

### The One-Liner

"Paste any NZ address and instantly see the risks, facts, and actions that no listing will tell you."

### User Mental Model

Users approach WhareScore like they approach a car history check (Carjam) or a credit score check. They expect:
- **Input:** one address
- **Output:** a clear verdict — is this property good or bad?
- **Depth:** ability to drill into the details if they want
- **Action:** what to do next based on what they find

They do NOT expect to manually explore 27 data layers and interpret the results themselves. They expect the tool to do the thinking and present conclusions.

**Current mental model (without WhareScore):** "I'll trust the agent and hope for the best" or "I'll spend 3 hours checking GWRC flood maps, NZ Police stats, and MBIE rental data separately and still not know what it all means together."

**Target mental model (with WhareScore):** "I paste the address, WhareScore tells me what I need to know, and I know exactly what to ask before making an offer."

### Success Criteria

1. **< 2 seconds** — from report load to the user seeing the overall score and understanding the verdict
2. **< 10 seconds** — user has seen the top 3 key findings and understands what makes this property notable
3. **< 60 seconds** — user has scrolled through findings, understands the "so what", and has a mental checklist of actions
4. **Zero jargon confusion** — no user should need to Google a term they see in the report
5. **Shareability** — user can share the report URL or screenshot the key findings card and it makes sense without context

### Report Information Hierarchy (Revised)

Based on "score first, then evidence" approach:

```
1. SUMMARY CARD
   Address, suburb, property type, CV, external links (Street View, TradeMe)

2. SCORE GAUGE + SCORE STRIP
   Overall score (0-100) with colour + rating label
   5 category circles (Hazards, Environment, Liveability, Market, Planning)
   Confidence badge ("24 of 27 data layers")
   → The anchor. User immediately knows: is this good or bad?

3. KEY FINDINGS (moved UP from bottom)
   "3 things to know about this property"
   - Critical concerns (red) with plain English explanation
   - Positive findings (green) — celebrate what's good
   - Each finding has: icon + headline + one-line interpretation
   → The "holy shit" moment. Facts that prove WhareScore's value.

4. AI SUMMARY
   2-3 paragraph narrative: property context + area profile
   Written as the "smart friend" — conversational, not clinical
   → The story that ties everything together.

5. ACTION CARDS / DUE DILIGENCE
   Personalised "what to do" based on this property's findings
   - "Check flood insurance availability" (if flood zone)
   - "Request a LIM report" (always)
   - "Ask about earthquake-prone buildings nearby" (if EPB)
   → The "so what" answer. Immediately actionable.

6. DETAILED SECTIONS (Accordions)
   5 expandable sections with full indicator breakdowns
   Each indicator: score + comparison vs suburb/city + raw data
   → Depth for investors and thorough researchers.

7. NEARBY HIGHLIGHTS
   Supermarkets, schools, transit — the practical stuff
   → Supporting context, not primary decision factors.

8. RENT COMPARISON (if applicable)
   Interactive rent fairness check
   → High-value feature, surfaced prominently for renters.

9. CTA BANNER
   "Get your full property report" — PDF upsell
   → Positioned after user has seen enough value to want more.

10. DISCLAIMER + SOURCES
    Data attribution, methodology links, legal disclaimer
    → Trust-building footer.
```

### Experience Mechanics

**1. Initiation — Finding a property**

| Step | User Action | System Response |
|------|------------|-----------------|
| Land on home | Sees map + search bar | Map centred on Wellington, landing panel with value proposition |
| Type address | Types 3+ characters | Autocomplete dropdown appears within 200ms |
| Select result | Clicks/taps address | Map flies to location, pin drops, popup appears |
| Open report | Clicks "View Report" in popup or navigates to /property/[id] | Full report loads with skeleton → content in <2s |

**2. Interaction — Reading the report**

| Step | User Sees | User Feels | Design Treatment |
|------|----------|------------|-----------------|
| Score gauge | Overall score with colour + label | "Okay, I know the verdict" | Large, prominent, unmistakable colour |
| Category strip | 5 smaller scores | "I can see where the issues are" | Red categories draw the eye |
| Key findings | 2-4 critical facts | "Holy shit, I didn't know that" | Full-width cards with alert styling |
| AI summary | Narrative paragraph | "This makes sense in context" | Readable prose, not data |
| Action cards | "What to do" checklist | "I know my next steps" | Blue/green cards, checkbox format |
| Accordions | Detailed breakdowns | "I can go deeper if I want" | Collapsed by default, expandable |

**3. Feedback — Knowing it's working**

- Score gauge animates from 0 to final value (unless reduced motion)
- Key findings appear with subtle entrance animation
- Skeleton loading shows the report structure immediately
- Category scores with colour give instant visual feedback
- "24 of 27 data layers" badge confirms comprehensive analysis

**4. Completion — What happens next**

- User has a clear mental model of the property's risks and strengths
- Action cards provide explicit next steps (not vague suggestions)
- "Save property" adds it to their collection for comparison later
- "Share" generates a rich preview link they can send to partner/family
- "Download PDF" offers the premium deep-dive for serious buyers
- Return to map to search another property — the comparison loop begins

### Novel UX Patterns

WhareScore primarily uses **established patterns combined innovatively:**

- **Search → map → report** flow is standard (Zillow, Redfin, homes.co.nz)
- **Bottom sheet on mobile** is standard (Google Maps, Uber)
- **Score + breakdown** is standard (credit scores, Consumer NZ)

**The innovation is in the interpretation layer:**

- No property platform pairs every risk finding with a plain English "what to do" action
- No platform auto-generates a personalised due diligence checklist based on the specific risks found
- No platform contextualises every stat against suburb and city averages in real-time
- The combination of government data aggregation + AI interpretation + actionable guidance is unique

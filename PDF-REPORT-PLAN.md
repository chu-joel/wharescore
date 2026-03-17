# Premium PDF Report Redesign Plan

## Context

The WhareScore PDF report has 16 sections. Some are visually strong (executive dashboard, radar chart, crime gauge, noise bar, NZDep bar, solar card, comparison bars) but many sections are still plain tables with no visual treatment. The report needs to feel like a premium decision toolkit where every element earns its place, with insights tailored for both **renters** and **buyers**.

**Files to modify:**
- `backend/app/services/report_html.py` — render pipeline, computed values, audience callouts
- `backend/app/templates/report/property_report.html` — HTML template with CSS and Jinja2

---

## Phase 1: Renter/Buyer Perspective System

**Concept:** Colored callout boxes throughout the report with audience-specific insights. Buyers get teal-bordered boxes (🏠 icon). Renters get blue-bordered boxes (🔑 icon).

### New CSS classes
```css
.audience-box { display:flex; gap:10px; padding:10px 14px; border-radius:0 8px 8px 0; margin:8px 0; font-size:0.88em; break-inside:avoid; }
.audience-buyer { background:#F0F9F9; border:1px solid #B2DFDB; border-left:4px solid #0D7377; }
.audience-renter { background:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid #1565C0; }
.audience-label { font-size:0.72em; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:3px; }
```

### New function: `build_audience_callouts(report, insights)` in report_html.py

Returns a dict keyed by section name, each containing `{audience: "buyer"|"renter", text: str}` dicts.

**Example callouts per section:**

| Section | Buyer | Renter |
|---------|-------|--------|
| Hazards (flood) | "Flood zone affects mortgage eligibility. Some lenders refuse or require higher deposits." | "Flood zone doesn't affect your tenancy, but check contents insurance covers flood damage." |
| Hazards (slope) | "Geotechnical report recommended before purchase ($2,000-5,000)." | "Not your financial risk, but be aware of slip-prone access routes in heavy rain." |
| Environment (noise >60dB) | "High noise reduces resale pool. Budget $5,000-15,000 for acoustic glazing." | "Visit at peak traffic before signing. Ask about glazing type." |
| Environment (contamination) | "Commission Phase 1 ESA ($1,500-3,000). Affects future development potential." | "Surface contamination doesn't affect daily living but check bore water." |
| Liveability (schools in-zone) | "In-zone school access adds $30,000-80,000 to property values in Wellington." | "Check zone status with MoE directly — zones change annually." |
| Liveability (crime >75th) | "Higher crime affects insurance premiums and resale timeline." | "Check whether the building has secure entry. Ask about break-in history." |
| Market (yield) | "Gross yield of X% is [above/below] Wellington average (~3.5-4%)." | "Median rent $X/wk. Rents rising Y% YoY — budget for increase on renewal." |
| Planning (consents) | "Resource consents nearby signal area growth — good for capital gains." | "Nearby construction may cause noise/dust for 1-2 years." |

### Template integration

In each section, after existing insights:
```jinja2
{% if audience_callouts.hazards %}
{% for ac in audience_callouts.hazards %}
<div class="audience-box audience-{{ ac.audience }}">
  <span class="audience-icon">{% if ac.audience == 'buyer' %}🏠{% else %}🔑{% endif %}</span>
  <div>
    <div class="audience-label">{{ 'Buyer Insight' if ac.audience == 'buyer' else 'Renter Insight' }}</div>
    {{ ac.text }}
  </div>
</div>
{% endfor %}
{% endif %}
```

---

## Phase 2: Property & Valuation Section Upgrade (Section 9)

**Current:** Plain table. **Target:** Visual donut + icon grid.

### 2a. Valuation breakdown donut chart (inline SVG)
- SVG 200x200 viewBox with two arc paths (land = teal, improvements = green)
- Large text in center: total CV formatted
- Compute `land_pct` and `improvements_pct` in report_html.py

### 2b. Property facts as icon grid
Replace table rows with 3-column grid of small stat cards:
```
[Title: Freehold] [Land: 452 m²] [Footprint: 120 m²]
```
Each card: light background, label, bold value.

---

## Phase 3: Score Overview Context (Section 3)

**Current:** Simple bars. **Target:** Bars + contextual one-liners.

### 3a. Category context text
Below each bar, a one-line interpretation:
- 0-20: "Minimal exposure" / 21-40: "Low risk — standard due diligence" / etc.

### 3b. "What This Means" summary box
Below all bars: "Your overall score of X/100 means [sentence]. Primary concern: [worst category] at Y/100."

---

## Phase 4: Environment Sub-sections (Air, Water, Contamination)

**Current:** Plain tables. **Target:** Visual cards.

### 4a. Air Quality — status indicator card
- Colored circle with grade + monitor name, distance, trends
- Trend arrows (SVG) for PM10/PM2.5

### 4b. Water Quality — grade bar
- SVG 5-grade bar (A through E, green→red)
- Marker triangle on current grade
- Site name and distance below

### 4c. Contamination — proximity ring card
- SVG half-circle with concentric rings (100m, 200m, 500m, 1km, 2km)
- Marker dot at nearest site distance
- Color: red if <100m, orange <200m, amber <500m, teal >500m
- Site name, ANZECC category, count within 2km

---

## Phase 5: Road Safety Visual (within Liveability)

**Current:** 3-row table. **Target:** Crash dot visualization.

- SVG grid of colored dots: gray (minor), orange (serious), red (fatal)
- Summary text: "X crashes within 300m over 5 years. Y were serious or fatal."
- Compute `crash_dots` array in report_html.py

---

## Phase 6: Amenities Bar Chart (within Liveability)

**Current:** Plain table. **Target:** Horizontal bar chart (inline SVG).

- One bar per category, sorted by count descending
- All teal, varying width relative to max count
- Category label left, count right

---

## Phase 7: Infrastructure Timeline Cards (within Planning)

**Current:** Plain table. **Target:** Card layout with sector color dots.

- Colored dot by sector: Transport=blue, Water=cyan, Healthcare=green, Education=purple
- Card: project name (bold), status badge (pill), value range, distance
- Buyer/renter callouts about construction impact

---

## Phase 8: Key Questions Card Layout (Section 11)

**Current:** Plain list. **Target:** Categorized numbered cards.

Group into:
- "Before Viewing" (structural, legal)
- "At Viewing" (noise, condition, neighbours)
- "Before Making an Offer" (LIM, reports, insurance)

Each question becomes a small card with number badge + question text.

---

## Phase 9: Methodology Visual (Section 14)

**Current:** Plain text + tables. **Target:** Visual weight bar + gradient scale.

### 9a. Category weights — horizontal stacked bar SVG
5 colored segments proportional to weight (30%, 25%, 15%, 15%, 15%), labels above.

### 9b. Score interpretation — continuous gradient bar
5-zone bar (like noise bar) with property's score marker.

---

## Phase 10: Global Polish

- Section gradient dividers for visual rhythm
- `break-inside: avoid` on all new cards
- Explicit SVG width/height for PDF rendering
- Data freshness badges next to section headers

---

## Implementation Order

| Priority | Phase | What | Impact |
|----------|-------|------|--------|
| 1 | Phase 1 | Renter/Buyer callouts | Highest — differentiates the product |
| 2 | Phase 4 | Environment sub-sections | Most visually weak currently |
| 3 | Phase 2 | Property & Valuation donut | Quick visual win |
| 4 | Phase 5+6 | Road Safety + Amenities | Quick wins, similar patterns |
| 5 | Phase 7 | Infrastructure cards | Card layout replacement |
| 6 | Phase 3 | Score Overview context | Text additions |
| 7 | Phase 8 | Key Questions cards | Layout change |
| 8 | Phase 9 | Methodology visuals | Polish |
| 9 | Phase 10 | Global polish | Final pass |

---

## Verification

1. `python -c "import ast; ast.parse(open('backend/app/services/report_html.py').read())"` — no syntax errors
2. Start backend + Redis, generate PDF for address 1671902
3. Check: renter/buyer callout boxes appear in hazards, environment, liveability, market, planning
4. Check: Property section has donut chart, not plain table
5. Check: Air quality has grade card, water has grade bar, contamination has proximity ring
6. Check: Road safety has crash dots, amenities has bar chart
7. Check: Infrastructure has timeline cards
8. Check: All page breaks work correctly, no elements split across pages
9. Print to PDF, verify A4 formatting

# Feature TODOs

## 1. Property Report — Suburb/City Comparison Context
- In the property report, show how each metric compares against the **suburb average** and the **city/town average**
- Help the user understand if a stat is normal for that area (e.g., "Mt Cook has high winds, so this property is typical for the suburb")
- Show whether a property is above/below/typical compared to:
  - Rest of the suburb
  - Rest of the city/town
- Could use labels like "Above average for suburb", "Typical for Wellington" etc.
- Also compare against the **nearest N properties** (neighbours) so the user can see how they stand relative to their immediate area

## 2. Suburb Search & Summary Page
- Add a suburb search feature where users can search for a suburb directly
- Returns a summary of the whole suburb including:
  - Aggregate stats (crime, hazards, wind, schools, rental prices, etc.)
  - Key characteristics / what the suburb is known for
  - How it compares to the wider city/town
- New route: e.g., `/suburb/[name]` or `/suburb/[id]`

## 3. Map Layer Strategy
- **Default layers:** Decide what layers should be shown by default on the map (needs thought)
- **Multiple filter layers:** When multiple layers are active, show all relevant data in the tooltip
- **Layer cap:** Consider a max number of layers visible on the map at once to avoid:
  - Visual clutter
  - Giving away too much data from the map view alone (keep detailed info behind the property report)
- Goal: Map should tease/preview data, property report should be the full experience

## 4. User Accounts & PDF Report Access
- Users should be able to log in and view their saved/generated PDFs
- **Decisions to make:**
  - If a user purchases a PDF report, do they get infinite access to regenerate it?
  - Should purchased reports be a **snapshot** (locked to the data at time of purchase) vs. **live** (always reflects latest data)?
  - Options to consider:
    - **Snapshot model:** Purchase gives you the PDF as it was — a historical record. Want updated stats? Purchase again.
    - **Live model:** Purchase gives you ongoing access to that property's report, always current. Risk: one purchase = free updates forever.
    - **Hybrid:** Keep the original snapshot available + allow regeneration for a limited time (e.g., 12 months) or at a discounted price.
  - How long should free regeneration last (if at all)?
  - Should there be a "report history" so users can compare how a property's stats changed over time?
- **Free report strategy — options:**
  - **No free reports:** All reports are paid. The on-screen property page is the free tier.
  - **Free preview PDF:** Generate a free PDF but with limited sections (e.g., scores only, no detailed breakdowns). Full report is paid.
  - **One free report:** Risk — if a user only cares about one property, they get what they need and leave.
  - **Free for a limited time:** First report free within 7 days of signup (creates urgency to explore).
- **Key insight:** The web property page is already the free experience. The PDF should offer something extra that justifies paying — e.g., deeper analysis, historical trends, comparison data, printable format, AI summary. If the PDF is just a printout of what's on screen, there's less reason to pay.
- **Login strategy:**
  - No login required to browse, search, or view property pages (keep friction low)
  - Prompt login only at point of action: buy PDF, save a property, view past reports
  - After login: purchased reports and saved properties are tied to their account
  - Don't gate the free experience behind login — it kills conversion

## 5. Selling the PDF Report
- Show a **sample/demo report** on the site to demonstrate value:
  - Use a fake or demo property (not a real searchable address) so the data isn't useful to copy
  - Or use a real property with blurred/redacted sections to tease the content
  - Don't show a real purchasable report — people will screenshot/share it
- Include a "What's in your report" summary listing the premium sections (suburb comparison, neighbour analysis, trend data, AI summary, etc.)
- The sample sells the quality and format without giving away real data

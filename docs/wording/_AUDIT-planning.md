# Audit: INDICATOR-WORDING-planning.md

Audited 2026-05-02. File path: `docs/wording/INDICATOR-WORDING-planning.md` (935 lines).

## Git history check

- `git log -- docs/wording/INDICATOR-WORDING-planning.md` → empty (no output).
- `git log --all -- docs/wording/INDICATOR-WORDING-planning.md` → empty.
- `git status -- docs/wording/INDICATOR-WORDING-planning.md` → file is **Untracked**, never committed.
- The author's claim "File created from scratch on 2026-05-02. There was no existing planning category file" (line 26) is consistent with git history: there is no committed prior version. **Verdict: Y, created from scratch (no prior commits exist).**
- However, the file appeared at 50KB before this pass per the special-investigation note. That earlier 50KB version was also untracked (never committed) — it cannot be reconstructed from git. The current 935-line file may legitimately be a fresh re-derivation, OR may have silently dropped indicators that existed in the earlier untracked draft. Without a backup of the earlier draft, only inventory-coverage comparison can detect drops.
- Pre-existing indicators that may have been dropped: **None detectable from git** — file was never committed. Inventory coverage check below confirms all 33 inventory indicators are present in the current file, so no inventory-listed indicator is missing regardless of what the prior draft contained.

## Inventory coverage

- Inventory count target: 33
- Actual rows under `## Planning` in `_INVENTORY.md` (lines 194-225): **33** (counted: zone_name, zone_code, zone_category, max_height_m, height_variation_limit, heritage_listed, contaminated_listed, epb_listed, resource_consents_500m_2yr, infrastructure_5km, transmission_line_distance_m, in_viewshaft, viewshaft_name, viewshaft_significance, in_character_precinct, character_precinct_name, in_heritage_overlay, heritage_overlay_name, heritage_overlay_type, notable_trees_50m, notable_tree_nearest, in_ecological_area, ecological_area_name, ecological_area_type, in_special_character, special_character_name, in_mana_whenua, mana_whenua_name, park_count_500m, nearest_park_name, nearest_park_distance_m, school_zone — 32 in table + school_zone = 33 ✓).
- In wording file: **33** (`Grep '^### '` found 33 indicator headings, lines 35-841).
- In inventory not in wording: — (none)
- In wording not in inventory: — (none)
- **Coverage: 33 / 33. No drops.**

## Per-indicator audit

For brevity, each indicator gets one Meaning-block table (11 rows) and one Wording-cells table (18 cells = 6 surfaces × 3 personas). Verifications cite exact `Grep`/`Read` results captured during this audit.

Common reference points used (verified once, reused below):
- `migrations/0054_flood_nearest_m.sql:801-838` — Read confirmed every dot-path key present in the SQL `jsonb_build_object` planning block exactly as the wording file claims.
- `risk_score.py:288-291` — `WEIGHTS_PLANNING = {zone_permissiveness 0.25, height_limit 0.20, resource_consents 0.20, infrastructure 0.20, school_zone 0.15}` ✓.
- `risk_score.py:749-756` — `zone_permissiveness=50`, `height_limit=50`, `resource_consents=log_normalize(...)`, `infrastructure=log_normalize(len(infra),40)`, `school_zone=50` ✓.
- `report_html.py` SOURCE_CATALOG keys present (verified by Grep): `mbie_epb` (650), `moe_schools` (657), `heritage_nz` (658), `osm_amenities` (660), `council_slur` (667), `council_zones` (672), `council_heritage_overlay` (673), `transpower` (674).
- `report_html.py` lines 1402-1506 and 2034-2081 read directly: **every planning Insight in those ranges has zero `source=` parameter** (the Insight constructor calls end without it). This confirms the file's repeated "TODO — no `source=`" claim.
- However, `report_html.py:841, 879` DO use `source=_src("mbie_epb")` and `:1789, 1797, 1805` use `source=_src("council_slur")`. These are NOT in the planning Insights ranges cited by the wording file (they are in the EPB/contamination overlay-section narratives at the top of `_get_indicators`, not the rules engine). The file's claim that "None of the planning Insights pass `source=`" needs nuancing: it is true for the planning rules engine (1402-1506, 2034-2081), but other planning-adjacent Insights elsewhere in the file DO carry `source=`. Flagged below.

### planning.zone_name

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | Zone name string | NOT-VERIFIABLE (semantic) | — | Not-verifiable |
| 2 | Source authority | Individual councils | Verifiable via DataSource entries | `data_loader.py:4964 "district_plan", "WCC District Plan Zones"` | CONFIRMED |
| 3 | Dataset / endpoint | ~25 council ArcGIS / WFS | Many keys exist in data_loader.py (see general grep) | `5047 "auckland_plan_zones"`, `7160-7301` regional councils | CONFIRMED |
| 4 | DataSource key(s) — `district_plan`, `auckland_plan_zones`, `whangarei_zones_residential` | Grep confirms each | `4964:district_plan`, `5047:auckland_plan_zones`, `7160:whangarei_residential` (note: actual key is `whangarei_residential` not `whangarei_zones_residential`, but the claim has "etc.") | minor: example name slightly off | UNVERIFIED — `whangarei_zones_residential` is not the literal key (`whangarei_residential` is). Other keys CONFIRMED. |
| 5 | Table | `district_plan_zones` | Read 0054:842 + Grep CREATE TABLE | `0054:842 FROM district_plan_zones` | CONFIRMED |
| 6 | Query path | LATERAL `dpz` at 0054:842-848, returned at :801 | Read confirmed | `0054:801 'zone_name', dpz.zone_name`; `0054:842 SELECT zone_name, zone_code, category FROM district_plan_zones` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:75-81; HostedExecutiveSummary.tsx:90; ActionCard.tsx:291-297; compareSections.ts:452 | PlanningSection.tsx:75-81 verified by Read; others NOT verified in this audit (reasonable but not grep-confirmed for HostedExecutiveSummary/ActionCard/compareSections) | `PlanningSection.tsx:77 District Plan Zone` | CONFIRMED for PlanningSection; UNVERIFIED for HostedExecutiveSummary.tsx:90, ActionCard.tsx:291-297, compareSections.ts:452 (not grep-checked here) |
| 8 | Threshold logic | `_derive_zone_category()` substring rules | NOT grep-checked here for `_derive_zone_category` body but the function is referenced in score-contribution row | — | UNVERIFIED — not grepped this pass |
| 9 | Score contribution | `zone_permissiveness` WEIGHTS_PLANNING 0.25, hard-coded neutral 50 at risk_score.py:749 | Verified | `risk_score.py:288 zone_permissiveness: 0.25`; `:749 indicators["zone_permissiveness"] = 50` | CONFIRMED |
| 10 | Coverage | 20+ councils | DataSource list matches | numerous `district_plan_zones` entries 5047-7301 | CONFIRMED |
| 11 | source_key status | TODO — no `source=` | Read 1402-1506, 2034-2081 | no `source=` on those Insight calls | CONFIRMED |

#### Wording cells (18)
| Cell | Content (verbatim) | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "District plan zone" | ≤60 ✓, NZ-en ✓ | PASS |
| OS Buyer label | "District plan zone" | ✓ | PASS |
| OS Pro label | "District plan zone" | ✓ | PASS |
| OS Renter finding | "This site is zoned {zone_name} — that shapes what neighbours can build, not just this place." | 1 sentence ✓; defuses misreading (not just this place) | PASS |
| OS Buyer finding | "Zone is {zone_name}; check what's permitted before assuming you can extend or subdivide." | ✓ | PASS |
| OS Pro finding | "Zone {zone_name} (council {ta_name}); category {zone_category}; permitted-activity rules in council DP chapter." | ✓ | PASS |
| HQ Renter label | "Zone" | ✓ | PASS |
| HQ Buyer label | "Zone" | ✓ | PASS |
| HQ Pro label | "District plan zone" | ✓ | PASS |
| HQ Renter narrative | "The plan zone is {zone_name} — it sets what can be built nearby." | ✓ | PASS |
| HQ Buyer narrative | "This site sits in the {zone_name} zone, which controls what's allowed without a resource consent." | ✓ | PASS |
| HQ Pro narrative | "District Plan zone: {zone_name} ({zone_category})." | ✓ | PASS |
| HF Renter label | "Zone" | ✓ | PASS |
| HF Buyer label | "District plan zone" | ✓ | PASS |
| HF Pro label | "District plan zone ({ta_name})" | ✓ | PASS |
| HF Renter narrative | "Your area's zone is {zone_name}. It says what kinds of buildings are allowed nearby." | ≤2 sentences ✓ | PASS |
| HF Buyer narrative | "This property is zoned {zone_name}. Permitted activities, height, density, and setbacks all depend on this zone — read the council District Plan chapter before planning work." | ✓; defusal via "read the chapter" | PASS |
| HF Pro narrative | "Zone {zone_name} (code {zone_code}, category {zone_category}); see {ta_name} District Plan. Zone alone does not capture overlays — check viewshaft, character, heritage, SEA fields below." | ✓ ; defuses cumulative-overlay misreading | PASS |

### planning.zone_code

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | short zone code | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Individual councils | same as zone_name | — | CONFIRMED |
| 3 | Dataset / endpoint | Same as zone_name | — | — | CONFIRMED |
| 4 | DataSource key(s) | Same as zone_name | — | — | CONFIRMED |
| 5 | Table | `district_plan_zones` | Verified | 0054:842 | CONFIRMED |
| 6 | Query path | Same LATERAL `dpz` selection — 0054:842-848, returned at :801 | Verified | `0054:801 'zone_code', dpz.zone_code` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:92-96 | Read verified | `:92-96 zone code` | CONFIRMED |
| 8 | Threshold logic | — | trivially CONFIRMED | — | CONFIRMED |
| 9 | Score contribution | — | trivially CONFIRMED | — | CONFIRMED |
| 10 | Coverage | Subset of councils, null where no distinct short code | NOT-VERIFIABLE without per-council null audit | — | Not-verifiable |
| 11 | source_key status | TODO; bundled | CONFIRMED — no source= on Insights | — | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "— (out of scope: shorthand, redundant with zone name for renter)" | reason given ✓ | PASS |
| OS Buyer label | "Zone code" | ✓ | PASS |
| OS Pro label | "Zone code" | ✓ | PASS |
| OS Renter finding | "—" | row is for sub-field with no rule | PASS |
| OS Buyer finding | "—" | ✓ | PASS |
| OS Pro finding | "—" | ✓ | PASS |
| HQ Renter label | "— (out of scope: redundant with zone name)" | ✓ | PASS |
| HQ Buyer label | "— (out of scope: bundled with zone name)" | ✓ | PASS |
| HQ Pro label | "Zone code" | ✓ | PASS |
| HQ Renter narrative | "—" | ✓ | PASS |
| HQ Buyer narrative | "—" | ✓ | PASS |
| HQ Pro narrative | "Council zone code: {zone_code}." | ✓ | PASS |
| HF Renter label | "— (out of scope: redundant)" | ✓ | PASS |
| HF Buyer label | "Zone code" | ✓ | PASS |
| HF Pro label | "Zone code (council shorthand)" | ✓ | PASS |
| HF Renter narrative | "—" | ✓ | PASS |
| HF Buyer narrative | "The council shorthand for this zone is {zone_code}." | ✓ | PASS |
| HF Pro narrative | "Council zone code {zone_code}. Codes are not standardised — same code in different councils does not mean the same rules." | defuses national-identifier misreading ✓ | PASS |

### planning.zone_category

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | derived high-level category | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Councils + WhareScore derivation | partly verifiable | — | CONFIRMED |
| 3 | Dataset / endpoint | AUP supplies via GROUPZONE; others derived | NOT grep-checked for GROUPZONE | — | UNVERIFIED — not checked |
| 4 | DataSource key(s) | Same as zone_name | — | — | CONFIRMED |
| 5 | Table | `district_plan_zones` (column `category`) | 0054:842 SELECT … category | CONFIRMED |
| 6 | Query path | 0054:842 returned at :801 | `0054:801 'zone_category', dpz.category` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:83-90; HostedExecutiveSummary.tsx:91 | PlanningSection:83-90 Read-confirmed; HostedExecutiveSummary not grepped | `:83-90` | CONFIRMED for PlanningSection; UNVERIFIED for HostedExecutiveSummary.tsx:91 |
| 8 | Threshold logic | `_derive_zone_category()` substring rules at data_loader.py:233 | not grep-checked at :233 in this pass | — | UNVERIFIED — line 233 not read |
| 9 | Score contribution | — (intermediate, intended for `zone_permissiveness`) | consistent with weights | — | CONFIRMED |
| 10 | Coverage | All councils with zones loaded; AUP authoritative, others pattern-derived | NOT-VERIFIABLE without per-council audit | — | Not-verifiable |
| 11 | source_key status | TODO — `council_zones` would apply | CONFIRMED no `source=` on related Insights | — | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "Zone type" | ✓ | PASS |
| OS Buyer label | "Zone category" | ✓ | PASS |
| OS Pro label | "Zone category (derived)" | ✓ | PASS |
| OS Renter/Buyer/Pro findings | "—" | bundled with zone_name | PASS (all 3) |
| HQ Renter label | "— (out of scope: bundled with zone name)" | ✓ | PASS |
| HQ Buyer label | "Zone category" | ✓ | PASS |
| HQ Pro label | "Zone category (derived)" | ✓ | PASS |
| HQ Renter narrative | "—" | ✓ | PASS |
| HQ Buyer narrative | "This is a {zone_category} zone — that shapes the kind of buildings around you." | ✓ | PASS |
| HQ Pro narrative | "Category {zone_category} (Auckland: council-supplied; elsewhere: derived from zone name)." | ✓ | PASS |
| HF Renter label | "— (out of scope: bundled with zone name)" | ✓ | PASS |
| HF Buyer label | "Zone category" | ✓ | PASS |
| HF Pro label | "Zone category (derived)" | ✓ | PASS |
| HF Renter narrative | "—" | ✓ | PASS |
| HF Buyer narrative | "The zone is broadly {zone_category} — useful when comparing this place with another address in a different zone." | ✓ | PASS |
| HF Pro narrative | "Category {zone_category}. For Auckland this comes from the Unitary Plan GROUPZONE field; for other councils it is derived from zone_name text by `_derive_zone_category()` and may misclassify novel names." | defuses derivation misreading ✓ | PASS |

### planning.max_height_m → height_limit

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | max permitted building height (m) | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | WCC 2024 DP + select others | partly verifiable | — | CONFIRMED |
| 3 | Dataset / endpoint | WCC DP height controls layer | not grep-checked | — | UNVERIFIED — not checked this pass |
| 4 | DataSource key(s) | `height_controls` (WCC) | Grep for `"height_controls"` did not match in main DataSource registration block I sampled. Likely exists; not directly verified by grep here | — | UNVERIFIED — `key="height_controls"` not grep-confirmed |
| 5 | Table | `height_controls` | Grep returned NO `CREATE TABLE height_controls` (search ran across migrations and matched only other tables) | grep "CREATE TABLE.*height_controls" → 0 hits | UNVERIFIED — table not found via Grep, may be created elsewhere or named differently |
| 6 | Query path | LATERAL `hc` SELECT height_metres FROM height_controls at 0054:851, returned `max_height_m` at :802 | 0054:802 confirmed by Read; line 851 not directly read but plausible from structure | `0054:802 'max_height_m', hc.height_metres` | CONFIRMED for return key; UNVERIFIED for line 851 exact |
| 7 | Rendered by | PlanningSection.tsx:98-103 reads `planning.height_limit`; ActionCard.tsx:296 | PlanningSection:98-103 Read-confirmed (`planning.height_limit && Height limit`); ActionCard not grepped | `PlanningSection.tsx:98 planning.height_limit && Height limit` | CONFIRMED for PlanningSection; UNVERIFIED for ActionCard.tsx:296 |
| 8 | Threshold logic | — | trivially CONFIRMED | — | CONFIRMED |
| 9 | Score contribution | `height_limit` WEIGHTS_PLANNING 0.20, hard-coded neutral 50 at :750 | risk_score.py:289 + :750 verified | `289: "height_limit": 0.20`; `750: indicators["height_limit"] = 50` | CONFIRMED |
| 10 | Coverage | WCC + select councils | NOT-VERIFIABLE without DataSource enumeration | — | Not-verifiable |
| 11 | source_key status | TODO — `council_zones` is closest existing | CONFIRMED — no source= on rule (no rule exists for height_limit per se) | — | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "— (out of scope: not material to renting)" | specific reason ✓ | PASS |
| OS Buyer label | "Height limit (council)" | ✓ | PASS |
| OS Pro label | "Permitted height (district plan)" | ✓ | PASS |
| OS Renter finding | "—" | ✓ | PASS |
| OS Buyer finding | "Base height limit here is {height_limit}m — overlays may pull it lower." | defuses overlay-stacking misreading ✓ | PASS |
| OS Pro finding | "Base zone height {height_limit}m; height-variation and view-shaft overlays may override — read combined controls." | ✓ | PASS |
| HQ Renter label | "— (out of scope)" | reason brief but acceptable | PASS |
| HQ Buyer label | "Height limit" | ✓ | PASS |
| HQ Pro label | "Base height limit" | ✓ | PASS |
| HQ Renter narrative | "—" | ✓ | PASS |
| HQ Buyer narrative | "The council height limit is {height_limit}m as of right." | ✓ | PASS |
| HQ Pro narrative | "Permitted height: {height_limit}m (council District Plan)." | ✓ | PASS |
| HF Renter label | "— (out of scope)" | brief reason | PASS |
| HF Buyer label | "Council height limit" | ✓ | PASS |
| HF Pro label | "Permitted height ({ta_name})" | ✓ | PASS |
| HF Renter narrative | "—" | ✓ | PASS |
| HF Buyer narrative | "A new build can rise to about {height_limit}m without a special consent — overlays can bring this down." | defuses base-only misreading ✓ | PASS |
| HF Pro narrative | "Base zone permitted height: {height_limit}m. Always check `height_variation_limit`, viewshaft and character overlays — these stack on top and can reduce the effective limit." | ✓ | PASS |

### planning.height_variation_limit

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | height variation overlay value | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Auckland Council | matches loader | — | CONFIRMED |
| 3 | Dataset / endpoint | AUP Height Variation Control overlay | matches loader function name | — | CONFIRMED |
| 4 | DataSource key(s) | `auckland_height_variation` | `data_loader.py:5109 "auckland_height_variation"` | `5109: "auckland_height_variation", "Auckland Height Variation Control"` | CONFIRMED |
| 5 | Table | `height_variation_control` | `0013_national_expansion_schema.sql:131 CREATE TABLE … height_variation_control` | `0013:131` | CONFIRMED |
| 6 | Query path | LATERAL `hvc` at 0054:961, returned `height_variation_limit` at :831 | :831 Read-verified; :961 plausible | `0054:831 'height_variation_limit', hvc.height_limit` | CONFIRMED for :831; UNVERIFIED for :961 exact |
| 7 | Rendered by | PlanningSection.tsx:104-108; report_html.py:1500-1506 Insight | both Read-confirmed | `PlanningSection:104-108`; `report_html.py:1500-1506` Insight present, no `source=` | CONFIRMED |
| 8 | Threshold logic | Insight fires when value present | `report_html.py:1500-1506 if hv_limit:` | CONFIRMED |
| 9 | Score contribution | — | trivially CONFIRMED | — | CONFIRMED |
| 10 | Coverage | Auckland only | matches DataSource | — | CONFIRMED |
| 11 | source_key status | TODO — Insight at :1500 has no `source=` | Read confirmed | `:1502 result["planning"].append(Insight("info", …))` no source= | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "— (out of scope)" | ✓ | PASS |
| OS Buyer label | "Height variation overlay" | ✓ | PASS |
| OS Pro label | "Height variation control" | ✓ | PASS |
| OS Renter finding | "—" | ✓ | PASS |
| OS Buyer finding | "A height variation overlay applies — the limit is {height_variation_limit}, not the base zone figure." | defuses base-vs-overlay misreading ✓ | PASS |
| OS Pro finding | "Height variation overlay: {height_variation_limit} (overrides base zone height_limit)." | ✓ | PASS |
| HQ Renter label | "— (out of scope)" | ✓ | PASS |
| HQ Buyer label | "Height variation" | ✓ | PASS |
| HQ Pro label | "Height variation control" | ✓ | PASS |
| HQ Renter narrative | "—" | ✓ | PASS |
| HQ Buyer narrative | "A council overlay caps height at {height_variation_limit} here." | ✓ | PASS |
| HQ Pro narrative | "Auckland Unitary Plan Height Variation Control: {height_variation_limit}." | ✓ | PASS |
| HF Renter label | "— (out of scope)" | ✓ | PASS |
| HF Buyer label | "Height variation overlay" | ✓ | PASS |
| HF Pro label | "Height variation control (Auckland)" | ✓ | PASS |
| HF Renter narrative | "—" | ✓ | PASS |
| HF Buyer narrative | "An overlay sets the height limit at {height_variation_limit}, replacing the base zone figure for this site." | ✓ | PASS |
| HF Pro narrative | "Auckland Unitary Plan Height Variation Control: {height_variation_limit}. Overrides the base zone permitted height; rationale (volcanic cone, character, viewshaft) is in the AUP chapter." | ✓ | PASS |

### planning.heritage_listed

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What it measures | HNZPT listed heritage at/near address | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | HNZPT + council heritage schedules | consistent | — | CONFIRMED |
| 3 | Dataset / endpoint | HNZPT national register `heritage_nz_register` + per-council loaders | Grep `heritage_nz_register` → 0 hits in data_loader.py | grep returned no match | **WRONG — `heritage_nz_register` is NOT a DataSource key.** It is the inventory's row label (`hnzpt_heritage`). Wording file fabricates a key name. |
| 4 | DataSource key(s) | Per-council loaders writing to `heritage_sites` (Tauranga at 3664-3701; Whanganui at 10789-10793) | not grep-confirmed in this pass | — | UNVERIFIED |
| 5 | Table | `heritage_sites` | 0054:858 Read inferred plus migration grep showing `heritage_sites` referenced in older 0002 migration (CREATE TABLE not in 0054, but table exists pre-0054) | `0002_update_report_function.sql:412 FROM heritage_sites` | CONFIRMED (table exists; not in 0013/0054) |
| 6 | Query path | LATERAL `hr_flag` at :858 returned `heritage_listed` at :803 | :803 Read-verified | `0054:803 'heritage_listed', hr_flag.listed` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx (heritage_count :140-142); report_html.py:2050-2055 Insight; :2678-2680 recommendation | :140-142 Read-confirmed (`heritage_count`); 2050-2055 Read-confirmed; 2678-2680 not Read | `:140-142 ChecklistItem label="Heritage sites nearby" count={planning.heritage_count}`; `report_html.py:2050 if planning.get("is_heritage_listed"):` | CONFIRMED for :140-142, :2050; UNVERIFIED for :2678-2680 |
| 8 | Threshold logic | Boolean | CONFIRMED | — | CONFIRMED |
| 9 | Score contribution | — | trivially CONFIRMED | — | CONFIRMED |
| 10 | Coverage | National via HNZPT + select councils | NOT-VERIFIABLE without enumeration | — | Not-verifiable |
| 11 | source_key status | TODO — Insight at :2050 has no `source=`; `heritage_nz` exists in SOURCE_CATALOG | Read confirmed: `:2050-2055` no `source=`; `:658 "heritage_nz"` exists | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "Heritage-listed building?" | ✓ | PASS |
| OS Buyer label | "Heritage listed?" | ✓ | PASS |
| OS Pro label | "Heritage listing (HNZPT / council)" | ✓ | PASS |
| OS Renter finding | "This place is heritage-listed — your landlord may not be able to change it without permission." | defuses "forbidden" misreading via "may not be able" ✓ | PASS |
| OS Buyer finding | "Heritage-listed: external alterations and demolition need resource consent." | defuses "internal forbidden" ✓ | PASS |
| OS Pro finding | "Heritage-listed; see schedule entry for protected features." | ✓ | PASS |
| HQ Renter label | "Heritage building" | ✓ | PASS |
| HQ Buyer label | "Heritage listed" | ✓ | PASS |
| HQ Pro label | "Heritage listing" | ✓ | PASS |
| HQ Renter narrative | "This building is heritage-listed, so changes need council okay." | ✓ | PASS |
| HQ Buyer narrative | "Heritage-listed — alterations and demolition need resource consent." | ✓ | PASS |
| HQ Pro narrative | "Heritage-listed (HNZPT or council schedule)." | ✓ | PASS |
| HF Renter label | "Heritage listed" | ✓ | PASS |
| HF Buyer label | "Heritage listed" | ✓ | PASS |
| HF Pro label | "Heritage listing (HNZPT / council)" | ✓ | PASS |
| HF Renter narrative | "The building is heritage-listed. That can be a plus for character, but it limits what your landlord can change." | ✓ | PASS |
| HF Buyer narrative | "This property is heritage-listed. External alterations and demolition typically require a resource consent — read the schedule entry to see exactly which features are protected." | ✓ | PASS |
| HF Pro narrative | "Heritage-listed. Source: Heritage NZ Pouhere Taonga register and / or council District Plan heritage schedule. Schedule entry defines protected fabric (façade, envelope, interior)." | ✓ | PASS |

### planning.contaminated_listed

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | SLUR/HAIL listing | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Regional councils + TAs | consistent | — | CONFIRMED |
| 3 | Dataset/endpoint | per-council registers at cited line numbers | not grep-confirmed in this pass | — | UNVERIFIED — line refs not checked |
| 4 | DataSource key(s) | `contaminated_land` | not directly grep-confirmed; appears as table name in DataSource entries (matches a target_table not a key) | The wording says "DataSource key(s): `contaminated_land`" but in data_loader.py `contaminated_land` is the TABLE name, not a key. | **WRONG** — `contaminated_land` is the target table; the DataSource key(s) (e.g. `gwrc_contaminated_land`) are not enumerated. |
| 5 | Table | `contaminated_land` | not Read this pass | — | UNVERIFIED — CREATE TABLE not located in 0013/0054 grep |
| 6 | Query path | LATERAL `cl_flag` at :866 returned at :804 | :804 Read-verified | `0054:804 'contaminated_listed', cl_flag.listed` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:153-157 (contamination_count); report_html.py:2043-2048 Insight | both Read-confirmed | `:153-157 ChecklistItem … contamination_count`; `:2043 if planning.get("is_contaminated"):` | CONFIRMED |
| 8 | Threshold logic | Boolean | CONFIRMED | — | CONFIRMED |
| 9 | Score contribution | — | CONFIRMED | — | CONFIRMED |
| 10 | Coverage | 10+ regions | NOT-VERIFIABLE without enumeration | — | Not-verifiable |
| 11 | source_key status | TODO — :2043 has no source=; `council_slur` exists at :667 | Read confirmed: :2043-2048 no source=; :667 council_slur exists | CONFIRMED |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "— (out of scope: not material to renting decisions)" | specific reason ✓ | PASS |
| OS Buyer label | "Contaminated land?" | ✓ | PASS |
| OS Pro label | "SLUR / HAIL listing" | ✓ | PASS |
| OS Renter finding | "—" | ✓ | PASS |
| OS Buyer finding | "This site is on the contaminated-land register — get a site report before buying." | ✓ | PASS |
| OS Pro finding | "Listed on regional SLUR / HAIL register; commission a Detailed Site Investigation if changing land use." | ✓ | PASS |
| HQ Renter label | "— (out of scope)" | ✓ | PASS |
| HQ Buyer label | "Contaminated land" | ✓ | PASS |
| HQ Pro label | "SLUR / HAIL listing" | ✓ | PASS |
| HQ Renter narrative | "—" | ✓ | PASS |
| HQ Buyer narrative | "The property appears on the contaminated-land register — older industrial or rural use." | ✓ | PASS |
| HQ Pro narrative | "On regional SLUR / HAIL register (council schedule)." | ✓ | PASS |
| HF Renter label | "— (out of scope)" | ✓ | PASS |
| HF Buyer label | "Contaminated land schedule" | ✓ | PASS |
| HF Pro label | "SLUR / HAIL listing ({source_council})" | ✓ | PASS |
| HF Renter narrative | "—" | ✓ | PASS |
| HF Buyer narrative | "This address is on the council contaminated-land schedule — usually a record of past land use (orchard, service station, workshop). Get a site report before buying or before changing how the land is used." | defuses "currently contaminated" misreading ✓ | PASS |
| HF Pro narrative | "Listed on regional SLUR (Selected Land Use Register) or TA HAIL schedule. Listing reflects historical / suspected use, not necessarily current contamination. Land-use change (e.g. residential subdivision) typically triggers an NES-CS Detailed Site Investigation." | exceeds 2-sentence rule (3 sentences) | FAIL — 3 sentences vs ≤2 cap. Concrete fix: merge sentences 2 and 3, e.g. "Listing reflects historical / suspected use, not necessarily current contamination — land-use change (e.g. residential subdivision) typically triggers an NES-CS Detailed Site Investigation." |

### planning.epb_listed

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | MBIE EPB register flag | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | MBIE | matches | — | CONFIRMED |
| 3 | Dataset/endpoint | `epbr.building.govt.nz` URL at data_loader.py:749 | not Read this pass | — | UNVERIFIED — line 749 not Read |
| 4 | DataSource key(s) | `epb_mbie` at data_loader.py:4949 | grep confirmed | `data_loader.py:4949 "epb_mbie"` | CONFIRMED |
| 5 | Table(s) | `mbie_epb_history`, `earthquake_prone_buildings` | not grep-confirmed in this pass | — | UNVERIFIED |
| 6 | Query path | LATERAL `epb_flag` at :874 returned `epb_listed` at :805 | :805 Read-verified | `0054:805 'epb_listed', epb_flag.listed` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:137 (EpbListedItem); BuyerChecklistContent.tsx:23; HostedExecutiveSummary.tsx:139; report_html.py:2036-2041 Insight; :2670-2672 recommendation | :137 Read-confirmed (`<EpbListedItem listed={planning.epb_listed} />`); :2036-2041 Read-confirmed; others not grepped | `PlanningSection.tsx:137 EpbListedItem`; `report_html.py:2036` | CONFIRMED for :137 + :2036; UNVERIFIED for BuyerChecklistContent.tsx:23, HostedExecutiveSummary.tsx:139, :2670-2672 |
| 8 | Threshold logic | Boolean within ~20m | NOT verified | — | UNVERIFIED — exact 20m threshold not located |
| 9 | Score contribution | — (separately, hazards.epb_count_300m feeds risk score) | hazards.epb_count_300m not grep-confirmed | — | UNVERIFIED |
| 10 | Coverage | National; ~5,813 active EPBs | not verified | — | UNVERIFIED |
| 11 | source_key status | TODO — :2036 no source=; `mbie_epb` exists at :650 | Read confirmed | :2036-2041 no source=; :650 `mbie_epb` exists | CONFIRMED. Note: `mbie_epb` IS attached at :841 and :879 elsewhere — not in the planning rules engine but in a different section. |

#### Wording cells (18)
| Cell | Content | Rule check | Verdict |
|---|---|---|---|
| OS Renter label | "EPB listed?" | ✓ | PASS |
| OS Buyer label | "EPB listed?" | ✓ | PASS |
| OS Pro label | "EPB register status" | ✓ | PASS |
| OS Renter finding | "This building is on the earthquake-prone register — ask the landlord what's happening with the strengthening work." | renter-grade ✓ | PASS |
| OS Buyer finding | "This building is on MBIE's earthquake-prone register; ask for the EPB notice and strengthening deadline." | ✓ | PASS |
| OS Pro finding | "On MBIE EPB register; statutory strengthening deadline applies (typically 25 years from notice)." | ✓ | PASS |
| HQ Renter label | "Earthquake-prone?" | ✓ | PASS |
| HQ Buyer label | "EPB listed" | ✓ | PASS |
| HQ Pro label | "MBIE EPB register" | ✓ | PASS |
| HQ Renter narrative | "The building is on the earthquake-prone list — ask about strengthening plans before signing." | ✓ | PASS |
| HQ Buyer narrative | "This building is on the MBIE earthquake-prone register — request the EPB notice and remaining deadline." | ✓ | PASS |
| HQ Pro narrative | "Listed on MBIE EPB register (epbr.building.govt.nz)." | ✓ | PASS |
| HF Renter label | "Earthquake-prone listed" | ✓ | PASS |
| HF Buyer label | "EPB listed (MBIE)" | ✓ | PASS |
| HF Pro label | "EPB register status (MBIE)" | ✓ | PASS |
| HF Renter narrative | "This building is on the earthquake-prone register. It can still be used, but the owner has to strengthen it by a deadline — ask what they're planning." | defuses "unsafe today" ✓ | PASS |
| HF Buyer narrative | "This building is on MBIE's earthquake-prone register. There is a statutory deadline to strengthen — usually 25 years from the notice — and remaining work is your contingent cost; insist on the EPB notice, %NBS rating and any strengthening reports before going unconditional." | exceeds 2 sentences (semicolon makes 2nd sentence very long but technically still two sentences). Considered borderline, count is 2 ✓ | PASS |
| HF Pro narrative | "On MBIE EPB register. %NBS, notice date, deadline and category in the EPBR record (`epbr_url`). Source: MBIE Earthquake-Prone Building Register; loader truncates and reloads `mbie_epb_history` from the public bulk export." | 3 sentences | FAIL — exceeds ≤2 cap. Fix: drop the loader-detail sentence (out of scope for narrative; belongs in meaning block). |

### planning.resource_consents_500m_2yr → consent_count

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | granted consents within 500m / 2yr | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | GWRC + ECan | matches DataSource | — | CONFIRMED |
| 3 | Dataset/endpoint | GWRC + ECan registers (data_loader.py:924) | line :924 not Read | — | UNVERIFIED |
| 4 | DataSource key(s) | `resource_consents` (GWRC); ECan separate | `data_loader.py:4959 "resource_consents"` | `4959: "resource_consents", "GWRC Resource Consents"` | CONFIRMED for `resource_consents`; ECan loader name not stated, UNVERIFIED |
| 5 | Table | `resource_consents` | grep returned table name in 0054:881 path; CREATE TABLE not in 0013/0054 sample | — | CONFIRMED via SQL reference |
| 6 | Query path | 0054:881 LATERAL `rc` returned at :806 | :806 Read-confirmed | `0054:806 'resource_consents_500m_2yr', rc.cnt` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:166 (consent_count, positive=true); HostedNeighbourhoodStats.tsx; report_html.py:2070-2081 Insight | :166 Read-confirmed (`count={planning.consent_count} positive`); :2070-2081 Read-confirmed | `PlanningSection.tsx:164-169 consent_count positive`; `report_html.py:2076 if consents is not None and consents >= 10:` | CONFIRMED for :166 and :2070-2081; UNVERIFIED for HostedNeighbourhoodStats.tsx |
| 8 | Threshold logic | Insight fires when >= 10 | Read confirmed at :2076 | `2076: if consents is not None and consents >= 10:` | CONFIRMED |
| 9 | Score contribution | log_normalize(value, 30) | risk_score.py:751-753 confirmed | `751-753: indicators["resource_consents"] = log_normalize(plan.get("resource_consents_500m_2yr"), 30)` | CONFIRMED |
| 10 | Coverage | Wellington + Canterbury only | matches | — | CONFIRMED (with caveat — ECan loader key not enumerated) |
| 11 | source_key status | TODO — :2077 no source=; no `council_resource_consents` key | Read confirmed: :2077-2081 no source=; SOURCE_CATALOG enumeration confirms no such key | — | CONFIRMED |

#### Wording cells (18)
All 18 cells reviewed; labels ≤60 chars ✓; misreading defusal present (high count = positive, marked positive=true) ✓; renter/buyer/pro register appropriate ✓. **All PASS.**

### planning.infrastructure_5km → infrastructure_count, infrastructure_projects

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | major infrastructure projects within 5km | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Te Waihanga | NOT-VERIFIABLE without loader | — | UNVERIFIED — claimed but no loader |
| 3 | Dataset/endpoint | "No active DataSource key found" | grep `te_waihanga`/`infrastructure_pipeline` → 0 hits | — | CONFIRMED (the absence is the finding) |
| 4 | DataSource key(s) | UNKNOWN | CONFIRMED unknown | — | CONFIRMED — explicit UNKNOWN per audit rules |
| 5 | Table | `infrastructure_projects` | `0002_update_report_function.sql:554 FROM infrastructure_projects ip` | CONFIRMED via SQL grep |
| 6 | Query path | 0054:895 LATERAL `infra` returned at :807 | :807 Read-verified | `0054:807 'infrastructure_5km', infra.projects` | CONFIRMED |
| 7 | Rendered by | PlanningSection.tsx:160 (infrastructure_count); HostedInfrastructure.tsx:27; report_html.py:2021-2032 narrative | :158-163 Read (uses `infrastructure_count` ✓); others not grepped | `PlanningSection.tsx:158-163 infrastructure_count` | CONFIRMED for PlanningSection; UNVERIFIED for HostedInfrastructure.tsx:27 and report_html.py:2021-2032 |
| 8 | Threshold logic | — | trivially CONFIRMED | — | CONFIRMED |
| 9 | Score contribution | log_normalize(len(infra), 40) | :754-755 confirmed | `754-755: indicators["infrastructure"] = log_normalize(len(infra) if infra else 0, 40)` | CONFIRMED |
| 10 | Coverage | National (assuming pipeline loaded) | NOT-VERIFIABLE without loader | — | Not-verifiable |
| 11 | source_key status | TODO — no source= on Insight at :2021; no `te_waihanga` key | Read confirms no source= in 2034-2081 range; SOURCE_CATALOG grep shows no `te_waihanga` | — | CONFIRMED |

#### Wording cells (18)
All 18 PASS. Defusal of "committed" misreading present in Pro narratives ✓.

### planning.transmission_line_distance_m

| # | Field | Claim | Verification | Excerpt | Verdict |
|---|---|---|---|---|---|
| 1 | What measures | metres to nearest HV line | NOT-VERIFIABLE | — | Not-verifiable |
| 2 | Source authority | Transpower | matches SOURCE_CATALOG | `:674 transpower` | CONFIRMED |
| 3 | Dataset/endpoint | static historical bulk import — DATA-PROVENANCE.md:203 says "no active loader" | not Read; cited line plausible | — | UNVERIFIED — line :203 of DATA-PROVENANCE.md not Read this pass |
| 4 | DataSource key(s) | UNKNOWN — no active DataSource | consistent with absence; CONFIRMED unknown by Grep | — | CONFIRMED |
| 5 | Table | `transmission_lines` | not grep-confirmed | — | UNVERIFIED — CREATE TABLE transmission_lines not found in sampled migrations |
| 6 | Query path | 0054:903 LATERAL `tl` returned at :808 | :808 Read-verified | `0054:808 'transmission_line_distance_m', tl.dist` | CONFIRMED |
| 7 | Rendered by | HostedNeighbourhoodStats.tsx; report_html.py:2057-2068 Insight; :2683-2685 recommendation | :2057-2068 Read-confirmed (no source=); HostedNeighbourhoodStats not grepped | `report_html.py:2057 trans_dist = planning.get("transmission_distance_m") or planning.get("transmission_line_distance_m")` | CONFIRMED for :2057-2068; UNVERIFIED for HostedNeighbourhoodStats and :2683-2685 |
| 8 | Threshold logic | ≤100m | :2063 Read confirmed | `2063: if trans_dist is not None and trans_dist <= 100:` | CONFIRMED |
| 9 | Score contribution | — | trivially CONFIRMED | — | CONFIRMED |
| 10 | Coverage | National (static snapshot) | NOT-VERIFIABLE | — | Not-verifiable |
| 11 | source_key status | TODO — :2064 no source=; `transpower` exists at :674 | Read confirmed | — | CONFIRMED |

#### Wording cells (18)
All 18 PASS. EMF-distance-conflation misreading defused in OS Pro and HF narratives ✓.

### planning.in_viewshaft, viewshaft_name, viewshaft_significance

For all three: tables `viewshafts` (CREATE TABLE not located via grep but referenced in `0054:910` per claim), DataSource keys `viewshafts` (data_loader.py:4994 ✓) and `auckland_viewshafts` (data_loader.py:5134 ✓). Rendering at PlanningSection.tsx:21-28 Read-confirmed. Insight at report_html.py:1402-1410 Read-confirmed (no `source=` ✓). Score contribution: none ✓. **All Meaning-block rows: 1 Not-verifiable, 8 CONFIRMED, 2 UNVERIFIED (CREATE TABLE viewshafts; cited migration line numbers within 0054 not directly Read for sub-fields :811, :812).**

#### Wording cells (54 across 3 indicators)
All 54 reviewed. Bundling rationale present in name/significance sub-fields ✓. Misreading-defusal present in primary `in_viewshaft` Pro narrative ("height/bulk capped to keep the protected sight-line") ✓. **All PASS.**

### planning.in_character_precinct, character_precinct_name

Tables `character_precincts` (CREATE TABLE not in 0013/0054 sample, but DataSource at :4999 + :1228 loader function exist). DataSource key `character_precincts` (data_loader.py:4999 ✓). Per-council loaders at 5596 (Dunedin) ✓ via grep. Rendering PlanningSection.tsx:29-35 Read-confirmed. Insight report_html.py:1413-1419 Read-confirmed (no source= ✓).

Meaning-block: 1 Not-verifiable, 9 CONFIRMED, 1 UNVERIFIED (CREATE TABLE character_precincts). source_key TODO CONFIRMED.

#### Wording cells (36)
All 36 PASS. Heritage-vs-character defusal ✓.

### planning.in_heritage_overlay, heritage_overlay_name, heritage_overlay_type

Tables: `historic_heritage_overlay` (`0013_national_expansion_schema.sql:76 CREATE TABLE`) ✓. DataSource keys: `auckland_heritage` (data_loader.py:5079 ✓). Other council heritage-overlay loaders not enumerated → UNVERIFIED for that breadth claim. Rendering PlanningSection.tsx:45-52 Read-confirmed. Insight report_html.py:1453-1459 Read-confirmed (no source= ✓).

Meaning-block: All CONFIRMED except (a) "wellington_heritage" key claim — not grep-confirmed (UNVERIFIED), and (b) coverage breadth (UNVERIFIED).

#### Wording cells (54)
All 54 PASS. Area-vs-listing defusal present in primary Pro narrative ✓.

### planning.notable_trees_50m, notable_tree_nearest

Table `notable_trees` (`0013:96 CREATE TABLE`) ✓. DataSource key `auckland_notable_trees` (data_loader.py:5094 ✓). Rendering PlanningSection.tsx:144-152 Read-confirmed. Insight report_html.py:1490-1497 Read-confirmed (no source= ✓; threshold `nt_count > 0` confirmed at :1492).

Meaning-block: All CONFIRMED for primary indicator. source_key TODO CONFIRMED.

#### Wording cells (36)
All 36 PASS. "Trees can be on neighbouring lots" defusal present ✓.

### planning.in_ecological_area, ecological_area_name, ecological_area_type

Table `significant_ecological_areas` (`0013:106 CREATE TABLE`) ✓. DataSource key `auckland_ecological` (data_loader.py:5099 ✓). Hamilton equivalent claimed but UNVERIFIED — no Hamilton ecological loader found in grep. Rendering PlanningSection.tsx:53-62 Read-confirmed. Insight report_html.py:1471-1479 Read-confirmed (no source= ✓).

Meaning-block: 1 Not-verifiable, 8 CONFIRMED, 1 UNVERIFIED (Hamilton SEA loader), 1 source_key TODO CONFIRMED.

#### Wording cells (54)
All 54 PASS. "Permitted activities still exist" defusal of no-build misreading ✓.

### planning.in_special_character, special_character_name

Table `special_character_areas` (`0013:86 CREATE TABLE`) ✓. DataSource key `auckland_special_character` (data_loader.py:5089 ✓). Rendering PlanningSection.tsx:37-44 Read-confirmed (uses `in_special_character_area` — note the alias mismatch the wording file flags in its conflict list ✓). Insight report_html.py:1462-1468 Read-confirmed (no source= ✓).

Meaning-block: All CONFIRMED. Alias divergence (`in_special_character` SQL → `in_special_character_area` frontend) flagged in conflict list ✓.

#### Wording cells (36)
All 36 PASS. AUP-area-vs-listing defusal ✓.

### planning.in_mana_whenua, mana_whenua_name

Table `mana_whenua_sites` (`0013:141 CREATE TABLE`) ✓. DataSource key `auckland_mana_whenua` (data_loader.py:5114 ✓). Rendering PlanningSection.tsx:63-70 Read-confirmed. Insight report_html.py:1481-1488 Read-confirmed (no source= ✓).

Note: PlanningSection.tsx:65-67 labels the overlay as "Mana Whenua **Area**" ("label: 'Mana Whenua Area'"). The wording file consistently calls it "Site" / "Mana Whenua site". Not a contradiction (both are reasonable labels) but worth flagging for consistency. Verdict: PASS but flagged.

Meaning-block: All CONFIRMED.

#### Wording cells (36)
All 36 PASS. "Not a building ban" defusal ✓.

### planning.park_count_500m, nearest_park_name, nearest_park_distance_m

Table `park_extents` (`0013:178 CREATE TABLE`) ✓. DataSource key `auckland_parks` (data_loader.py:5129 ✓). Rendering PlanningSection.tsx:171-182 Read-confirmed. Insight at report_html.py:1509-1525 Read-confirmed (no source= ✓; threshold `d <= 300` for ok-tier confirmed).

Meaning-block: All CONFIRMED.

#### Wording cells (54)
All 54 PASS. "Straight-line vs walking" and "count vs quality" defusals ✓.

### school_zone (planning indicator)

Table `school_zones` (CREATE TABLE not in sampled migrations; loader truncates `school_zones` per data_loader.py:3883). DataSource key `school_zones` (data_loader.py:7137 ✓). Rendering: HostedSchoolZones.tsx (not Read this pass — UNVERIFIED). risk_score.py:756 hard-coded 50 ✓. Weight 0.15 at :291 ✓. **No `moe_zones` SOURCE_CATALOG key — confirmed by grep** ✓.

Meaning-block: 1 Not-verifiable, 8 CONFIRMED, 1 UNVERIFIED (HostedSchoolZones.tsx:* not Read), 1 source_key TODO CONFIRMED.

#### Wording cells (18)
All 18 PASS. "Zoned ≠ guaranteed enrolment" defusal in Buyer/Pro Hosted Full ✓.

## Tally

| | Confirmed | Wrong | Unverified | Not-verifiable |
|---|---|---|---|---|
| Meaning-block (33 indicators × 11 fields = 363 rows) | 287 | 2 | 41 | 33 |
| Cells (33 × 18 = 594 cells) | 592 PASS | — | — | 2 FAIL |

Wrong rows (2):
1. `planning.heritage_listed` row 3 — `heritage_nz_register` cited as DataSource key/dataset; that name is the inventory's row label, not a real DataSource key. Fix: delete the parenthetical "(`heritage_nz_register` → `heritage_sites`)" or replace with the actual per-council loader keys writing to `heritage_sites`.
2. `planning.contaminated_listed` row 4 — DataSource key listed as `contaminated_land`, which is the table name, not a key. Fix: enumerate the real keys (e.g. `gwrc_contaminated_land`, `otago_contaminated_land`, etc.) or drop the bogus key and say "per-council loaders".

Failed cells (2):
1. `planning.contaminated_listed` HF Pro narrative — 3 sentences, exceeds ≤2 cap. Fix: merge sentences 2+3 with em-dash.
2. `planning.epb_listed` HF Pro narrative — 3 sentences, exceeds ≤2 cap. Fix: drop the loader-detail sentence.

Unverified (41) — predominantly:
- Cited line numbers inside `migrations/0054_flood_nearest_m.sql` for sub-tables (e.g. :851, :874, :895, :903, :910, :917, :923, :931, :941, :949, :955, :961, :967, :972, :979) not all directly Read (only :801-848 read this pass).
- `data_loader.py` per-council loader line numbers (e.g. :3664-3701 Tauranga heritage, :10789-10793 Whanganui, :924, :749) not Read.
- Frontend cross-references beyond `PlanningSection.tsx`: `HostedExecutiveSummary.tsx`, `ActionCard.tsx`, `compareSections.ts`, `HostedNeighbourhoodStats.tsx`, `HostedInfrastructure.tsx`, `HostedSchoolZones.tsx`, `BuyerChecklistContent.tsx` — line refs plausible but not grep-confirmed in this pass.
- `data_loader.py:233 _derive_zone_category()` body — not Read.
- `DATA-PROVENANCE.md` line refs (:193, :195, :203) — not Read.
- `WIRING-TRACES.md` row references (:131-144) — not Read.
- Hamilton SEA loader claim — no grep hit found.
- "Wellington_heritage" DataSource key — no grep hit.
- Some CREATE TABLE statements (`heritage_sites`, `contaminated_land`, `transmission_lines`, `school_zones`, `infrastructure_projects`, `district_plan_zones`, `height_controls`, `viewshafts`, `character_precincts`, `resource_consents`, `earthquake_prone_buildings`, `mbie_epb_history`) not located in 0013 / 0054 — they likely exist in other migration files (0001-0012) but were not exhaustively grepped this pass.

Not-verifiable (33) — every "What it measures" row is intentionally Not-verifiable per the audit rules.

## Flagged rows requiring fix

| # | Indicator | Row / Cell | Issue | Concrete fix |
|---|---|---|---|---|
| 1 | `planning.heritage_listed` | Meaning-block row 3 (Dataset / endpoint) | Cites `heritage_nz_register` as if it were a DataSource key — no such key exists in `data_loader.py`. | Replace parenthetical with: "HNZPT national register loaded via per-council heritage loaders writing to `heritage_sites`. No standalone `heritage_nz_register` DataSource key in this codebase." |
| 2 | `planning.contaminated_listed` | Meaning-block row 4 (DataSource key(s)) | Lists `contaminated_land` as a key; that is the table name. | Replace with explicit per-council keys (e.g. `gwrc_contaminated_land`, `otago_slur`, etc.) or write "per-council SLUR/HAIL loaders writing to `contaminated_land`" without naming a non-existent key. |
| 3 | `planning.contaminated_listed` | HF Pro narrative cell | 3 sentences, exceeds ≤2 cap. | Merge: "Listed on regional SLUR (Selected Land Use Register) or TA HAIL schedule. Listing reflects historical / suspected use, not necessarily current contamination — land-use change (e.g. residential subdivision) typically triggers an NES-CS Detailed Site Investigation." |
| 4 | `planning.epb_listed` | HF Pro narrative cell | 3 sentences. | Drop final loader-detail sentence: "On MBIE EPB register. %NBS, notice date, deadline and category in the EPBR record (`epbr_url`)." (Move loader detail to meaning-block "Dataset / endpoint" row, where it belongs.) |
| 5 | `planning.zone_name` | Meaning-block row 4 | Example key `whangarei_zones_residential` is wrong; actual key is `whangarei_residential`. | Replace `whangarei_zones_residential` → `whangarei_residential`. |
| 6 | "Changes in this pass" line 29 ("None of the planning Insights pass `source=`") | Document-level claim | True only for the planning rules engine ranges (1402-1506, 2034-2081). `mbie_epb` is attached at :841, :879 and `council_slur` at :1789, :1797, :1805 — these are planning-adjacent Insights elsewhere in `report_html.py`. | Reword to: "None of the planning Insights in `_get_indicators` (1402-1506) or the planning rules engine (2034-2081) pass `source=`. Some EPB / contamination Insights elsewhere in `report_html.py` (lines 841, 879, 1789, 1797, 1805) DO carry `source=`, so the gap is local to the two ranges audited." |
| 7 | `planning.in_mana_whenua` | Wording labels — "Mana Whenua site" | Frontend uses "Mana Whenua Area" (PlanningSection.tsx:65). Wording uses "site". | Either change wording to "Mana Whenua Area" to match UI, or note the alias divergence in the conflict list. (Soft flag — not a hard FAIL.) |

## Cross-cutting strengths

- All 33 dot-paths from inventory present and present in correct order.
- All hard-coded neutral-50 indicators (`zone_permissiveness`, `height_limit`, `school_zone`) are correctly flagged as placeholders in their score-contribution rows AND in the "Required code additions" section.
- All alias / divergence pairs (epb_listed↔is_epb_listed, heritage_listed↔is_heritage_listed, contaminated_listed↔is_contaminated, in_special_character↔in_special_character_area, transmission_line_distance_m↔transmission_distance_m, notable_trees_50m↔notable_tree_count_50m, infrastructure_5km↔infrastructure_projects, resource_consents_500m_2yr↔consent_count) correctly captured in the Local conflict list and verified by Read.
- `WEIGHTS_PLANNING` weights, `risk_score.py:749-756` hard-coding, `report_html.py:2070-2081` threshold (≥10), `report_html.py:1490-1497` threshold (>0), `report_html.py:1509-1525` threshold (≤300m, ≤800m), all confirmed verbatim against source.
- Required SOURCE_CATALOG additions list (11 keys) is consistent with what is/isn't grep-able in `report_html.py:637-680`.

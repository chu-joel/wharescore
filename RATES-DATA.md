# WhareScore — Council Rates & Valuation Data Sources

**Last Updated:** 2026-03-23 (session 59–62)

---

## In Progress

### Auckland Council — Full CV Reload (Session 62)
- **Script:** `backend/scripts/load_auckland_rates.py --resume`
- **Total addresses:** 584,648 Auckland addresses in DB
- **Method:** 2-step API (search by address → get rateAccountKey → fetch rate-assessment with full CV/LV/IV/rates)
- **Rate:** ~1 address/sec (0.5s sleep between requests)
- **Progress:** ~6,500 cached so far, ~578K remaining — estimated 6-7 days for full load
- **Logging:** Skipped addresses → `backend/skipped_addresses.txt`, failed → `backend/failed_addresses.txt`
- **Issues encountered:**
  - Internet outage at ~2,950 addresses (5 skipped, recovered automatically)
  - PostgreSQL went into recovery mode at ~608 addresses in 2nd run (~40 failed, logged to failed_addresses.txt)
- **100% success rate** when API and DB are both up

---

## Loaded Councils

| # | Council | Code | Records | Source | CV/LV | Rates$ | Notes |
|---|---------|------|---------|--------|-------|--------|-------|
| 1 | Auckland | auckland | ~6,500 (reloading) | Auckland Council API | Yes | Yes | Full reload in progress session 62 — 2-step API, ~578K remaining |
| 2 | Christchurch | christchurch | 185,989 | CCC ArcGIS MapServer | Yes | ? | `gis.ccc.govt.nz/arcgis/rest/services/CorporateData/Rating/MapServer/0` |
| 3 | Wellington City | wcc | 87,819 | WCC ArcGIS + Property Search API | Yes | Yes | Bulk + live cache with 13-15 levy items |
| 4 | Taranaki | taranaki | 64,312 | ArcGIS FeatureServer | Yes | No | `services.arcgis.com/MMPHUPU6MnEt0lEK/.../Property_Rating/FeatureServer/0` |
| 5 | Tauranga City | TCC | 63,674 | TCC ArcGIS FeatureServer | Yes | Partial | 2023+2021 values, AnnualRates field (often null) |
| 6 | Hutt City | hcc | 46,593 | HCC ArcGIS MapServer | Yes | Yes | Council + regional rates split, live lookup + bulk |
| 7 | Upper Hutt | uhcc | ~10K | MagiqCloud HTML scrape | Yes | Yes | No ArcGIS API — scraped from `online.uhcc.magiqcloud.com`. CV/LV/IV + rates. Geocoded via address match |
| 8 | Tasman | tasman | 28,845 | Tasman ArcGIS MapServer | Yes | No | `gispublic.tasman.govt.nz/.../OpenData_Property/MapServer/0` |
| 9 | Kapiti Coast | KCDC | 27,191 | KCDC ArcGIS MapServer | Yes | No | `maps.kapiticoast.govt.nz/.../Property_Public/MapServer/0`. Has Lat/Lng fields + legal desc |
| 10 | Porirua | PCC | 21,081 | PCC ArcGIS MapServer | Yes | Yes | PCC + GW rates split |
| 11 | Horowhenua | HDC | 19,303 | Horizons Regional ArcGIS | Yes | No | Filtered by `TerritorialAuthority LIKE '%Horowhenua%'`. Also has web RID at ratesinformation.horowhenua.govt.nz (per-property, not bulk) |
| 12 | Dunedin | dunedin | 58,461 | DCC ArcGIS MapServer | CV only | Yes | No LV/IV split — only Rateable_Value. 1000/page limit, paginate via OBJECTID |
| 13 | Hamilton | hamilton | ~51K (loading) | Web scrape | Yes | Yes | No public API — scrapes hamilton.govt.nz property search. Assessment numbers from ArcGIS Online. ~4 req/s, takes 3-4 hours |
| 14 | Whangarei | WDC | 49,752 | WDC ArcGIS MapServer | Yes | No | `geo.wdc.govt.nz/.../Property__Land__Roads_and_Rail_public_view/MapServer/12` |
| 15 | Palmerston North | PNCC | 35,372 | ArcGIS Online FeatureServer | Yes | Yes | CC BY 4.0. String-formatted values need parsing. `services.arcgis.com/Fv0Tvc98QEDvQyjL/.../PROPERTY_PARCEL_VALUATION_VIEW/FeatureServer/0` |
| 16 | Queenstown-Lakes | QLDC | 33,074 | ArcGIS Online FeatureServer | Yes | No | Updated daily. All data in one layer. `services1.arcgis.com/9YyqaQtDdDR8tupG/.../Land_Parcels_and_Properties_Data/FeatureServer/0` |
| 17 | Invercargill | ICC | 26,691 | ICC ArcGIS MapServer | Yes | Yes | Has year built, floor area, prev CV/LV. 1000/page. `gis.icc.govt.nz/arcgis/rest/services/Essentials/CityMap/MapServer/55` |
| 18 | Hastings | HASTINGS | 33,656 | HDC ArcGIS MapServer | **No** | Yes | Rates only (RT_CurrentYear), no CV/LV in API. `gismaps.hdc.govt.nz/.../Property/Property_Data/MapServer/0` |
| 19 | Western Bay of Plenty | WBOP | 26,399 | WBOP ArcGIS MapServer | Yes | No | 4-layer join (parcels + CV + LV + IV). `map.westernbay.govt.nz/arcgisext/rest/services/Property/MapServer` |

| 20 | Selwyn | selwyn | 37,222 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='062'. Canterbury Maps regional endpoint |
| 21 | Waimakariri | waimakariri | 30,536 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='059' |
| 22 | Thames-Coromandel | thames_coromandel | 29,634 | WRC Properties FeatureServer | Yes | No | Suburb-filtered from Waikato Regional endpoint |
| 23 | Waipa | waipa | 25,105 | WRC Properties FeatureServer | Yes | No | Cambridge, Te Awamutu, etc. |
| 24 | Waikato DC | waikato_dc | 24,476 | WRC Properties FeatureServer | Yes | No | Huntly, Ngaruawahia, Raglan, Tuakau, etc. |
| 25 | Timaru | timaru | 24,400 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='064' |
| 26 | Whanganui | whanganui | 22,904 | Horizons Regional ArcGIS | Yes | No | `TerritorialAuthority LIKE '%Whanganui%'` |
| 27 | Ashburton | ashburton | 17,214 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='063' |
| 28 | Manawatu | manawatu | 15,859 | Horizons Regional ArcGIS | Yes | No | `TerritorialAuthority LIKE '%Manawatu%'` |
| 29 | Matamata-Piako | matamata_piako | 15,485 | WRC Properties FeatureServer | Yes | No | Matamata, Morrinsville, Te Aroha |
| 30 | Waitaki | waitaki | 12,295 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='068' |
| 31 | Hauraki | hauraki | 11,001 | WRC Properties FeatureServer | Yes | No | Waihi, Paeroa, Ngatea |
| 32 | Tararua | tararua | 10,773 | Horizons Regional ArcGIS | Yes | No | `TerritorialAuthority LIKE '%Tararua%'` |
| 33 | South Waikato | south_waikato | 10,356 | WRC Properties FeatureServer | Yes | No | Tokoroa, Putaruru, Tirau |
| 34 | Ruapehu | ruapehu | 9,650 | Horizons Regional ArcGIS | Yes | No | `TerritorialAuthority LIKE '%Ruapehu%'` |
| 35 | Rangitikei | rangitikei | 8,675 | Horizons Regional ArcGIS | Yes | No | `TerritorialAuthority LIKE '%Rangitikei%'` |
| 36 | Hurunui | hurunui | 9,255 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='058' |
| 37 | Waimate | waimate | 4,454 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='066' |
| 38 | Mackenzie | mackenzie | 4,372 | ECan Property_Details/MapServer/2 | Yes + IV | No | TLA='065' |

| 39 | Marlborough | marlborough | 27,099 | MDC ArcGIS MapServer/2 | Yes + IV | Yes (levy) | No address field — spatial join only. `gis.marlborough.govt.nz/.../RatingInformation/MapServer/2` |

**Total: ~1,465,000 properties across 39 councils**

### Regional Endpoint Discovery (Session 63)

Three regional endpoints cover multiple councils each:

1. **Horizons Regional** (`maps.horizons.govt.nz/.../Public_Property/MapServer/1`) — Filter by `TerritorialAuthority`. Covers: Horowhenua, Whanganui, Manawatu, Rangitikei, Tararua, Ruapehu. ~123K total records.
2. **Canterbury Maps/ECan** (`gis.ecan.govt.nz/.../Property_Details/MapServer/2`) — Filter by `TLA` code. Covers: Selwyn (062), Waimakariri (059), Ashburton (063), Timaru (064), Hurunui (058), Waimate (066), Mackenzie (065), Waitaki (068). CCC (060) already loaded separately. ~329K total.
3. **Waikato Regional** (`services.arcgis.com/2bzQ0Ix3iO7MItUa/.../WDP_PROPERTIES_WRC_EXT/FeatureServer/0`) — Filter by `PREDICTED_SITUATION_MAJOR_NAME` (town names). Covers: Waikato DC, Thames-Coromandel, South Waikato, Matamata-Piako, Waipa, Hauraki. ~236K total.

---

## Recently Loaded (Session 61)

### Hutt City Council (HCC) — 46,593 properties
- **URL:** `https://maps.huttcity.govt.nz/server01/rest/services/HCC_External_Data/MapServer/1/query`
- **Fields:** prop_address, house_no_full, street_name, capital_value, land_value, council_rates, regional_rates, total_rates, past_capital_value, past_land_value, valuation, cert_of_title, prop_improv
- **Geometry:** Polygon, NZGD2000 (native), request outSR=4326 for WGS84
- **Max per query:** 2,000
- **Rates split:** council_rates (HCC) + regional_rates (GWRC) + total_rates
- **Historical:** past_capital_value, past_land_value, past_council_rates, past_regional_rates, past_total_rates
- **Live lookup:** `backend/app/services/hcc_rates.py` — single ArcGIS query by address, no caching needed
- **Bulk loader:** `hcc_rates` in data_loader + standalone `backend/scripts/load_hcc_rates.py`
- **Unit addresses:** Stored with prefix (e.g. "2/139 Knights Road") — do NOT strip unit prefix when searching
- **Dedup:** Multi-polygon parcels create duplicate features — dedup by valuation_id

### Upper Hutt City Council (UHCC) — ~10K properties (scraping)
- **System:** MagiqCloud HTML portal at `online.uhcc.magiqcloud.com`
- **No ArcGIS API** — their ArcGIS at `maps.upperhutt.govt.nz/arcgis/rest/services` has 60 services (parcels, district plan, aerial imagery) but NO valuation/rates data
- **Scraper:** `backend/app/services/uhcc_scraper.py` — discovers valuation IDs via prefix search, fetches detail pages, parses HTML
- **Discovery:** Valuation IDs in range 1518xxxxx–1599xxxxx, 7-digit prefix enumeration (~760 search requests, 6 min)
- **Detail parsing:** Bootstrap grid: `<div class="col-xs-3"><p><b>Label</b></p></div><div class="col-xs-9"><p>Value</p></div>`
- **Fields parsed:** Location, Capital Value, Land Value, Improvements Value, Current Year's Rates (U+2019 right quote), Certificate of Title, Legal Description, New (2025) valuation
- **Pagination bug:** Their portal returns max 20 per search and pagination is broken (every page returns same 20). Workaround: use `valuation_id` prefix search with progressively longer prefixes
- **Geocoding:** Matched to addresses table by street number + road name in Upper Hutt
- **Time:** ~80 min total (6 min discovery + 73 min detail fetching at ~0.4s/request)
- **Loader:** `uhcc_rates` in data_loader.py, Wave 15 of batch_load.py

---

## Recently Loaded (Session 59)

### Porirua City Council (PCC) — 21,081 properties
- **URL:** `https://maps.poriruacity.govt.nz/server/rest/services/Property/PropertyAdminExternal/MapServer/5/query`
- **Fields:** Address, Valuation_No, Total_Value (CV), Land_Value, Imp_Value, PCC_rates, GW_rates, Rates_Category, TITLES, FULL_APP (legal desc)
- **Geometry:** Polygon, NZGD2000 (request outSR=4326)
- **Max per query:** 2,000
- **Rates split:** PCC council rates + GW regional rates

### Kapiti Coast District Council (KCDC) — 27,191 properties
- **URL:** `https://maps.kapiticoast.govt.nz/server/rest/services/Public/Property_Public/MapServer/0/query`
- **Fields:** Valuation_ID, Location (address), Capital_Value, Land_Value, Improvements_Value, Legal, Latitude, Longitude
- **Geometry:** Polygon, NZGD2000 (also has Lat/Lng attribute fields)
- **Max per query:** 2,000

### Horowhenua District Council (HDC) — 19,303 properties
- **URL:** `https://maps.horizons.govt.nz/arcgis/rest/services/LocalMapsPublic/Public_Property/MapServer/1/query`
- **Filter:** `TerritorialAuthority LIKE '%Horowhenua%'` (Horizons hosts all TAs in region — 123K total)
- **Fields:** VnzLocation, VnzCapitalValue, VnzLandValue, VnzLegalDescription, ValuationNumber
- **Requires:** `User-Agent` header (returns HTML without one)
- **Note:** Also has web RID at `ratesinformation.horowhenua.govt.nz` (per-property PHP API, needs street number)

### Dunedin City Council (DCC) — 58,461 properties
- **URL:** `https://apps.dunedin.govt.nz/arcgis/rest/services/Public/Rates/MapServer/0/query`
- **Fields:** Assessment_Number, Formatted_address, Rateable_Value (CV), Total_rates, VGNumber, Area_Ha, Land_Use_Descript
- **Limitation:** Only `Rateable_Value` — **no separate LV/IV split**. Max 1,000 records per page.
- **Pagination:** Use OBJECTID ranges (`where=OBJECTID > {max_oid}`) not resultOffset
- **Also available via:** FeatureServer at same path, RatesStatic MapServer (same fields)

### Hamilton City Council — ~51K properties (loading)
- **No public API** — ArcGIS server at `maps.hamilton.govt.nz` requires authentication for all property layers
- **Web scrape:** `https://hamilton.govt.nz/property-rates-and-building/property/property-search/?searchby=streetname&keywords=&property={id}`
- **Assessment numbers:** Free from ArcGIS Online: `https://services1.arcgis.com/R6s0QqCMQdwKY6yp/ArcGIS/rest/services/property_SDEADMIN_HCC_AddressParcels_20250502/FeatureServer/0` (51,073 unique)
- **Data from scrape:** CV, LV, IV, total rates, valuation number, legal description, valuation history
- **Rate:** ~4 req/s max (server throttled), full load takes 3-4 hours

---

## Ready To Load (Easy — ArcGIS API available)

### Palmerston North City Council (PNCC) — ~46K properties
- **URL:** `https://services.arcgis.com/Fv0Tvc98QEDvQyjL/arcgis/rest/services/PROPERTY_PARCEL_VALUATION_VIEW/FeatureServer/0`
- **Records:** 46,316
- **Geometry:** Polygon (NZGD2000)
- **Max per query:** 2,000 (32,000 without geometry)
- **License:** CC BY 4.0
- **Fields:** LOCATION, VALUATION_NO, RATES_LEGAL, RATES_AREA, RATES_ADDR, RATES_AMOUNT, CURR_LAND_VALUE, CURR_CAPITAL_VALUE, RATES_YEAR
- **Note:** CV, LV, and rates values are **string-formatted** with `$ ` prefix (e.g. `"$ 620000"`) — need parsing
- **Portal:** https://geohub.pncc.govt.nz/

### Whangarei District Council (WDC) — ~50K properties
- **URL:** `https://geo.wdc.govt.nz/server/rest/services/Property__Land__Roads_and_Rail_public_view/MapServer/12`
- **Records:** 50,018
- **Geometry:** Polygon
- **Max per query:** 2,000
- **Fields:** as_assess_no, situation_full1 (address), as_cv (int), as_lv (int), as_improvements, Floor_Area, Site, Units, Tenure_Code, app_concat (legal desc)
- **No rates $ amounts** — only rating zone/category codes
- **Bonus layer:** 2024 Revaluations at `https://services1.arcgis.com/RfTgcgHraFPg7Fq4/arcgis/rest/services/2024_Property_Revaluations_Update_WFL1/FeatureServer/2` (45,450 records with 2021 vs 2024 CV/LV + % change)

### Invercargill City Council (ICC) — ~33K properties
- **URL:** `https://gis.icc.govt.nz/arcgis/rest/services/Essentials/CityMap/MapServer/55` (Rate Payer layer)
- **Records:** 33,520
- **Geometry:** Polygon
- **Fields:** ADDRESS, HOUSE, UNIT, STREET, LAND (LV), CAPITAL (CV), PREV_LAND, PREV_CAP, RATES_STRU (annual rates), YEAR_BUILT, FLOOR_AREA, PROP_AREA, VGNUMBER, SUBURB_PC, appellation (legal desc), titles
- **Excellent data** — has current + previous CV/LV, rates, year built, floor area, titles

### Queenstown-Lakes District Council (QLDC) — ~45K properties
- **URL:** `https://services1.arcgis.com/9YyqaQtDdDR8tupG/arcgis/rest/services/Land_Parcels_and_Properties_Data/FeatureServer/0`
- **Records:** 44,785 (42,895 with CV)
- **Geometry:** Polygon (NZGD2000)
- **Max per query:** 2,000
- **Updated:** Daily
- **Fields:** PHYSADDRESS, STREET, LOCALITY, POSTCODE, ASSESSMENT_NO, RATESLEGAL, CERT_OF_TITLE, LAND_VALUE, CAPITAL_VALUE, IMPROVEMENTS_VALUE, LANDUSEDESCRIPTION, IMPROVEMENTDESCRIPTION
- **All in one layer** — easiest to work with
- **Portal:** https://gis-qldc.hub.arcgis.com/

### Upper Hutt City Council (UHCC) — ~10K properties ✅ LOADED (session 61)
- **System:** MagiqCloud HTML portal (no ArcGIS API for valuations)
- **ArcGIS available:** `maps.upperhutt.govt.nz/arcgis/rest/services` has 60 services (parcels, district plan, aerial imagery) but **NO valuation/rates data**
- **Rates portal:** `https://online.uhcc.magiqcloud.com/rates/properties/search` — full CV/LV/IV + rates breakdown + history
- **Approach:** HTML scraper — discover valuation IDs via prefix search, fetch each detail page, parse Bootstrap grid layout
- **Discovery:** Valuation IDs in range 1518xxxxx–1599xxxxx, found via 7-digit prefix enumeration (~760 search requests)
- **Detail parsing:** `<div class="col-xs-3"><p><b>Label</b></p></div><div class="col-xs-9"><p>Value</p></div>` pattern
- **Fields:** Location, Capital Value, Land Value, Improvements Value, Current Year's Rates, Certificate of Title, Legal Description, new (2025) valuation
- **Pagination bug:** Their portal returns max 20 results per search and pagination is broken (every page returns same results). Workaround: use `valuation_id` prefix search with progressively longer prefixes
- **Geocoding:** Matched to addresses table by street number + road name in Upper Hutt
- **Time:** ~80 min (6 min discovery + 73 min detail fetching at ~0.4s/request)
- **Loader:** `uhcc_rates` in data_loader.py, Wave 15 of batch_load.py

### Whanganui District Council — ~25K properties (est.)
- **Status:** Not yet researched
- **Try:** Horizons Regional Council ArcGIS (same as Horowhenua) with `TerritorialAuthority LIKE '%Whanganui%'`

### Gisborne District Council — ~25K properties (est.)
- **Status:** Not yet researched — known to publish on data.govt.nz
- **Try:** `https://catalogue.data.govt.nz/dataset?q=gisborne+property+valuation`

### Waikato District Council — ~40K properties (est.)
- **Status:** Not yet researched
- **Try:** Waikato Regional Council ArcGIS or own portal

### Selwyn District Council — ~30K properties (est.)
- **Status:** Not yet researched
- **Try:** `https://maps.selwyn.govt.nz/` or ECan regional data

### Waimakariri District Council — ~30K properties (est.)
- **Status:** Not yet researched
- **Try:** Canterbury regional ArcGIS or own portal

### Timaru District Council — ~25K properties (est.)
- **Status:** Not yet researched

### Marlborough District Council — ~25K properties (est.)
- **Status:** Not yet researched
- **Try:** Top of the South Maps (shared with Nelson/Tasman)

### South Waikato District Council — ~12K properties (est.)
- **Status:** Not yet researched
- **Try:** Waikato Regional Council ArcGIS

### Thames-Coromandel District Council — ~25K properties (est.)
- **Status:** Not yet researched
- **Try:** Waikato Regional Council ArcGIS

---

## Medium Difficulty (Partial data or multi-layer join needed)

### Hastings District Council — ~34K properties
- **URL:** `https://gismaps.hdc.govt.nz/server/rest/services/Property/Property_Data/MapServer/0`
- **Records:** 34,311
- **Has:** Annual rates (RT_CurrentYear), address, legal desc, title, area, district plan zone
- **Missing:** CV, LV, improvement value — **not exposed via any public endpoint**
- **Approach:** Could load rates-only, or investigate LINZ rating valuations dataset

### Western Bay of Plenty (WBOPDC) — ~37K parcels
- **URL:** `https://map.westernbay.govt.nz/arcgisext/rest/services/Property/MapServer`
- **Records:** 36,482 parcels, up to 70,953 valuations
- **Data split across layers:** Layer 4 (CV), Layer 5 (LV + PPH), Layer 6 (IV), Layer 12 (parcels with address)
- **Join key:** ValuationNumber
- **Max per query:** 40,000
- **No rates $ amounts**

---

## Not Feasible (Proprietary systems, scraping required)

### Rotorua Lakes Council — ~35K properties (est.)
- **System:** IntraMaps / GeyserView (TechnologyOne T1 Cloud)
- **URL:** `https://rotorualc.spatial.t1cloud.com/spatial/intramaps/...`
- **Status:** Proprietary SPA, no public REST API. All GIS subdomains ECONNREFUSED.
- **BOPRC Rating folder:** Exists but requires authentication tokens.
- **Verdict:** Not feasible without reverse-engineering IntraMaps AJAX calls.

### Napier City Council — ~30K properties
- **System:** GeoServer WFS (addresses only) + eservices web portal (valuations)
- **WFS URL:** `https://data.napier.govt.nz/geo/ows` — layer `NCC:NCS_PROPADDRESS`
- **Has:** Addresses, valuation reference numbers, legal descriptions (30,028 records)
- **Missing:** CV, LV, rates — only in web portal at eservices.napier.govt.nz
- **Verdict:** Would need HTML scraping of "My Property" portal for valuations.

### Nelson City Council — ~25K properties (est.)
- **System:** Top of the South Maps (shared with Tasman) + MagiqCloud rates portal
- **ArcGIS:** `https://www.topofthesouthmaps.co.nz/ArcGIS/rest/services/DataProperty/MapServer` — parcels and addresses only, NO valuations
- **MagiqCloud:** `https://online.nelson.magiqcloud.com/rates/properties/search` — has full CV/LV/rates/history but no API
- **Verdict:** MagiqCloud scraping now proven feasible (see UHCC scraper). Could reuse `uhcc_scraper.py` pattern with different URL base and valuation prefix range.

---

## Files

### Services (live lookup by address)
| File | Council |
|------|---------|
| `backend/app/services/rates.py` | WCC (Property Search API) |
| `backend/app/services/auckland_rates.py` | Auckland Council |
| `backend/app/services/hcc_rates.py` | Hutt City (ArcGIS) |
| `backend/app/services/hdc_rates.py` | Horowhenua (Horizons ArcGIS) |
| `backend/app/services/kcdc_rates.py` | Kapiti Coast (ArcGIS) |
| `backend/app/services/pcc_rates.py` | Porirua (ArcGIS) |
| `backend/app/services/tcc_rates.py` | Tauranga (ArcGIS, 2-step: Assessment → CV layer) |
| `backend/app/services/dcc_rates.py` | Dunedin (ArcGIS) |
| `backend/app/services/hamilton_rates.py` | Hamilton (web scrape) |
| `backend/app/services/uhcc_scraper.py` | Upper Hutt (MagiqCloud HTML scrape) |
| `backend/app/services/pncc_rates.py` | Palmerston North (ArcGIS Online) |
| `backend/app/services/wdc_rates.py` | Whangarei (ArcGIS) |
| `backend/app/services/icc_rates.py` | Invercargill (ArcGIS) |
| `backend/app/services/qldc_rates.py` | Queenstown-Lakes (ArcGIS Online) |
| `backend/app/services/wbop_rates.py` | Western Bay of Plenty (ArcGIS, 4-layer join) |
| `backend/app/services/hastings_rates.py` | Hastings (ArcGIS, rates only — no CV/LV) |

### Bulk loaders (scripts)
| File | Council | Records |
|------|---------|---------|
| `backend/scripts/load_auckland_rates.py` | Auckland | 620K |
| `backend/scripts/load_hcc_rates.py` | Hutt City | 46K |
| `backend/scripts/load_hdc_rates.py` | Horowhenua | 19K |
| `backend/scripts/load_kcdc_rates.py` | Kapiti Coast | 27K |
| `backend/scripts/load_pcc_rates.py` | Porirua | 21K |
| `backend/scripts/load_tcc_rates.py` | Tauranga | 64K |
| `backend/scripts/load_dunedin_rates.py` | Dunedin | 58K |
| `backend/scripts/load_hamilton_rates.py` | Hamilton | ~51K |
| `backend/scripts/load_pncc_rates.py` | Palmerston North | 35K |
| `backend/scripts/load_wdc_rates.py` | Whangarei | 50K |
| `backend/scripts/load_icc_rates.py` | Invercargill | 27K |
| `backend/scripts/load_qldc_rates.py` | Queenstown-Lakes | 33K |
| `backend/scripts/load_wbop_rates.py` | Western Bay of Plenty | 26K |
| `backend/scripts/load_hastings_rates.py` | Hastings | 34K |

### Migrations
| File | Description |
|------|-------------|
| `backend/migrations/0015_auckland_rates_cache.sql` | Auckland rates cache table |

from __future__ import annotations
from typing import Optional

# backend/app/routers/admin.py
import csv
import io
import json
import re

import logging

import orjson
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from psycopg import sql

from ..config import settings
from .. import db as _db
from ..deps import limiter
from ..redis import redis_client
from ..services.admin_auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin")

# Hardcoded whitelist of table names safe for admin queries (defence-in-depth)
ALLOWED_TABLES = frozenset([
    "addresses", "parcels", "building_outlines", "property_titles",
    "flood_zones", "tsunami_zones", "liquefaction_zones", "earthquakes",
    "schools", "crashes", "transit_stops", "crime", "heritage_sites",
    "wind_zones", "noise_contours", "air_quality_sites", "water_quality_sites",
    "climate_grid", "climate_projections", "infrastructure_projects",
    "district_plan_zones", "height_controls", "contaminated_land",
    "earthquake_prone_buildings", "resource_consents", "sa2_boundaries",
    "council_valuations", "bonds_detailed", "bonds_tla", "bonds_region",
    "market_rent_cache", "wcc_rates_cache", "osm_amenities",
    "conservation_land", "area_profiles", "user_rent_reports",
    "feedback", "email_signups", "data_sources",
    "earthquake_hazard", "ground_shaking", "liquefaction_detail",
    "slope_failure", "fault_zones", "flood_hazard",
    "tsunami_hazard", "flood_extent", "landslide_susceptibility",
    "wcc_solar_radiation", "metlink_stops",
    "transit_travel_times", "transit_stop_frequency", "mbie_epb",
    "active_faults", "fault_avoidance_zones",
    "landslide_events", "landslide_areas",
    "stormwater_management_area", "overland_flow_paths",
    "historic_heritage_overlay", "aircraft_noise_overlay",
    "special_character_areas", "notable_trees",
    "significant_ecological_areas", "coastal_erosion",
    "height_variation_control", "mana_whenua_sites",
    "geotechnical_reports", "auckland_schools", "park_extents",
    "heritage_extent",
    "at_stops", "at_travel_times", "at_stop_frequency",
    "census_demographics", "census_households", "census_commute", "climate_normals",
    "business_demography", "fibre_coverage", "cycleways",
])

# All recommendation rule IDs with default severity, title, category, and action templates.
# Action templates use {placeholder} syntax for dynamic property data.
# This is the single source of truth — the admin panel reads these and stores overrides in the DB.
DEFAULT_RECOMMENDATIONS = [
    # ── UNIVERSAL (always shown) ─────────────────────────────────────────────
    {
        "id": "universal_lim",
        "severity": "important",
        "title": "Request a LIM Report",
        "category": "universal",
        "default_actions": [
            "Apply for a Land Information Memorandum (LIM) from the local council — this is your single most important document. Cost: $300-$500, turnaround 10-15 working days.",
            "The LIM reveals: flood zones, erosion risk, ground contamination, building consents, drainage, stormwater, and any council notices or requisitions.",
            "Make the purchase conditional on a satisfactory LIM — your solicitor can advise on the wording.",
            "If the vendor already has a recent LIM (within 6 months), ask for a copy — but verify currency with the council.",
        ],
    },
    {
        "id": "universal_builders_report",
        "severity": "important",
        "title": "Get a Builder's Report",
        "category": "universal",
        "default_actions": [
            "Commission a pre-purchase building inspection from a registered building surveyor. Cost: $400-$800 for a standard home, $800-$1,500 for multi-unit.",
            "Ensure the inspector checks: subfloor (moisture, piles, bearers), roof cavity (framing, insulation), exterior cladding (weathertightness), plumbing, electrical safety.",
            "For homes built 1994-2004 (\"leaky building era\"), request specific weathertightness assessment — monolithic cladding systems (plaster/EIFS) from this era are high risk.",
            "Make the purchase conditional on a satisfactory builder's report. If the vendor resists this condition, that is itself a red flag.",
            "Ask the inspector about Healthy Homes compliance (insulation, heating, ventilation, moisture, draught stopping) — mandatory for rentals, good benchmark for any home.",
        ],
    },
    {
        "id": "universal_conveyancing",
        "severity": "advisory",
        "title": "Conveyancing & Legal Checklist",
        "category": "universal",
        "default_actions": [
            "Engage a property lawyer or licensed conveyancer before signing the Sale & Purchase Agreement. Budget $1,200-$2,500.",
            "Your lawyer should check: certificate of title (encumbrances, easements, covenants), cross-lease/unit title obligations, body corporate rules (if applicable), and council compliance.",
            "Check the title at LINZ (linz.govt.nz) — look for caveats, registered interests, or consent notices that restrict use.",
            "If buying at auction, you waive conditions — get your LIM, builder's report, and finance sorted beforehand.",
            "For cross-lease properties: read the flats plan and ensure the as-built layout matches what's on the plan.",
        ],
    },
    {
        "id": "universal_insurance",
        "severity": "advisory",
        "title": "Confirm Insurance Availability",
        "category": "universal",
        "default_actions": [
            "Get insurance quotes BEFORE going unconditional — some properties in hazard zones are uninsurable or carry high premiums/excess.",
            "Check with at least 2 insurers: dwelling cover, contents, natural disaster (EQC), and specific exclusions for flood, landslip, or coastal erosion.",
            "EQC provides the first $300,000+GST of natural disaster dwelling cover. Your private insurer covers the remainder.",
            "Ask about any area-specific loadings — some Wellington suburbs carry earthquake or landslip surcharges.",
            "If the property has previous claims (weathertightness, earthquake, flood), the vendor must disclose — ask explicitly.",
        ],
    },
    # ── HAZARDS ───────────────────────────────────────────────────────────────
    {
        "id": "flood_zone",
        "severity": "critical",
        "title": "Flood Zone — Critical Preparation",
        "category": "hazards",
        "default_actions": [
            "This property is in a 1-in-100-year flood zone (1% annual exceedance probability). This is a mapped hazard that affects insurance and resale.",
            "Request a LIM from the council — it confirms the exact flood classification, minimum floor level, and any flood protection works.",
            "Contact your insurer specifically about flood cover — some policies exclude mapped flood zones entirely, or apply excess up to $10,000-$20,000.",
            "Check if the floor level has been raised above the 1% AEP level. The LIM and/or building consent records will show this.",
            "Ask the vendor: has the property ever flooded? When, how deep, and was an insurance claim made?",
            "Make a household flood plan: identify your nearest high ground, know your evacuation route, keep important documents and valuables above ground level.",
            "If buying to rent: flood zone status must be disclosed to tenants under the Residential Tenancies Act.",
        ],
    },
    {
        "id": "flood_minor",
        "severity": "advisory",
        "title": "Flood Zone Awareness",
        "category": "hazards",
        "default_actions": [
            "This property is in a low-probability flood zone (0.2% AEP / 1-in-500-year event). Lower risk than 1% zones, but still mapped.",
            "Notify your mortgage broker — some lenders require flood insurance for any mapped zone.",
            "Check your insurer's position on this zone classification — most will cover it, but premiums may differ.",
            "{climate_precip_line}",
        ],
    },
    {
        "id": "liquefaction_high",
        "severity": "critical",
        "title": "Liquefaction Risk — Structural Assessment Required",
        "category": "hazards",
        "default_actions": [
            "This property sits on ground with high liquefaction susceptibility. During a significant earthquake, the soil may behave like a liquid, causing ground settlement, lateral spreading, and foundation damage.",
            "Commission a geotechnical investigation from a chartered geotechnical engineer. Cost: $2,000-$5,000 depending on site access and depth of investigation.",
            "Inspect existing foundations for signs of past movement: horizontal cracks in concrete, uneven floors, doors/windows that stick, gaps between walls and ceilings.",
            "Check if foundation remediation has been done post-Kaikoura 2016 or any other seismic event — ask the vendor for documentation.",
            "EQC natural disaster cover applies at full value, but the excess may differ for liquefaction-prone land. Confirm with your insurer.",
            "For new builds on liquefiable ground: TC3 foundation design (raft or piled) adds $30,000-$80,000 to build cost.",
        ],
    },
    {
        "id": "liquefaction_mod",
        "severity": "important",
        "title": "Ground Conditions — Foundation Check",
        "category": "hazards",
        "default_actions": [
            "Moderate liquefaction susceptibility means some ground settlement is possible during a significant earthquake.",
            "During your building inspection, ask the inspector to specifically check foundations for settlement cracks, particularly in concrete block or unreinforced masonry.",
            "Note any doors or windows that stick, sloping floors, or gaps at skirting boards — these can indicate past or ongoing ground movement.",
            "If the property was built pre-2011 (before NZS 3604 was updated for liquefaction), foundation design may not account for this hazard.",
        ],
    },
    {
        "id": "earthquake_active",
        "severity": "critical",
        "title": "Seismically Active Area — Due Diligence",
        "category": "hazards",
        "default_actions": [
            "There have been {earthquake_count}+ recorded earthquakes within 30km in the last 10 years. This is a seismically active area even by New Zealand standards.",
            "For pre-1976 buildings: request evidence of seismic strengthening. Buildings designed before NZS 4203:1976 may not meet minimum earthquake standards.",
            "Check the MBIE Earthquake-Prone Buildings Register at epbr.building.govt.nz — this confirms whether this specific building has been assessed and its %NBS (new building standard) rating.",
            "If %NBS is below 34%: the building is legally earthquake-prone and the owner has a statutory deadline to strengthen or demolish.",
            "Consider a structural engineer's assessment ($1,500-$4,000) for any building with unreinforced masonry, concrete block, or pre-1935 timber frame.",
            "Check EQC cover limits and confirm your private insurer's policy on seismic damage — some exclude pre-existing damage or unstrengthened buildings.",
            "For apartments: ask the body corporate if a Detailed Seismic Assessment (DSA) has been completed and what strengthening works are planned.",
        ],
    },
    {
        "id": "earthquake_moderate",
        "severity": "advisory",
        "title": "Seismic Activity Awareness",
        "category": "hazards",
        "default_actions": [
            "This area has moderate seismic activity ({earthquake_count} M4+ quakes within 30km in the last 10 years).",
            "{active_fault_line}",
            "For older buildings, check whether seismic strengthening has been done. Buildings designed before NZS 4203:1976 may not meet modern earthquake standards — ask the vendor for the original consent file.",
            "Ask the vendor if any earthquake-related repairs or insurance claims have been made.",
            "Ensure your home and contents insurance includes EQC natural disaster cover (it's automatic with dwelling policies from participating insurers).",
        ],
    },
    {
        "id": "wind_extreme",
        "severity": "important",
        "title": "High Wind Zone — Property Checks",
        "category": "hazards",
        "default_actions": [
            "This property is in a high or very high wind zone under NZS 3604. Wellington's exposed hilltops and coastal areas regularly experience gusts over 120 km/h.",
            "Check that roof fixings comply with NZS 3604 for this wind zone classification — your builder's report should cover this.",
            "Inspect for loose roofing iron, lifted flashings, damaged guttering, or cracked ridge caps. Walk around the exterior and look up.",
            "Check fences, carports, pergolas, and garden structures are securely anchored — these are the first casualties of high winds.",
            "Budget for higher heating costs — draughty homes in high wind zones cost 15-25% more to heat. Check window and door seals.",
            "Ask the vendor or neighbours: has any wind damage occurred? Has the roof been re-fixed or replaced?",
            "Consider whether outdoor living spaces (decks, patios) are sheltered enough to be usable year-round.",
            "If the property has a chimney: check the flashing and cap condition — wind-driven rain penetration through chimneys is common in Wellington.",
        ],
    },
    {
        "id": "tsunami_zone",
        "severity": "important",
        "title": "Tsunami Evacuation Planning",
        "category": "hazards",
        "default_actions": [
            "This property is in a mapped tsunami evacuation zone. While major tsunamis are rare, preparation is essential.",
            "Identify your nearest inland/uphill evacuation route BEFORE moving in. Wellington Region Emergency Management (WREMO) has published route maps at getprepared.nz.",
            "Register for Wellington Region emergency alerts at getprepared.nz/alerts.",
            "Know the \"Long or Strong, Get Gone\" rule — if earthquake shaking lasts more than a minute or is hard to stand up in, move immediately to high ground without waiting for an official warning.",
            "A locally-generated tsunami can arrive within minutes of a large earthquake on a nearby fault.",
            "Factor in resale: tsunami zone properties in some Wellington suburbs can take longer to sell, particularly post-event when awareness is heightened.",
            "Keep a go-bag near the door: torch, phone charger, water, first aid kit, important documents.",
        ],
    },
    {
        "id": "wildfire_high",
        "severity": "important",
        "title": "Wildfire Risk Management",
        "category": "hazards",
        "default_actions": [
            "This area experiences {wildfire_days}+ Very High to Extreme fire danger days per year, typically between December and March.",
            "{wildfire_trend_line}",
            "Check home and contents insurance covers wildfire damage explicitly — most policies do, but confirm there are no bush/scrub exclusions.",
            "Maintain a 10-metre vegetation-free or low-fuel buffer zone around the house. Remove dead branches, leaf litter, and dry scrub.",
            "Clear gutters of leaf litter and dry debris regularly, especially before summer.",
            "If the property backs onto bush, reserve, or rural land: check FENZ (Fire and Emergency NZ) guidelines for property protection at fireandemergency.nz.",
            "Keep an emergency go-bag packed during summer (Dec-Mar) and know your evacuation routes.",
        ],
    },
    {
        "id": "epb_nearby",
        "severity": "advisory",
        "title": "Earthquake-Prone Buildings Nearby",
        "category": "hazards",
        "default_actions": [
            "There are {epb_count_300m}+ earthquake-prone buildings within 300m. While this doesn't directly affect your property's structure, it's worth being aware.",
            "Walk the neighbourhood and note building age and condition — older unreinforced masonry buildings are the primary concern.",
            "Check the MBIE EPB register at epbr.building.govt.nz to confirm this specific property is NOT listed.",
            "Be aware that neighbouring EPB buildings may be subject to demolition, extensive strengthening works, or cordoning after a significant earthquake.",
        ],
    },
    {
        "id": "coastal_erosion_high",
        "severity": "critical",
        "title": "Coastal Erosion Risk — Critical",
        "category": "hazards",
        "default_actions": [
            "This property is in a high or extreme coastal erosion risk area. This is a long-term hazard that may affect property value and insurability.",
            "Review the NZCOASTS erosion hazard maps for projected shoreline retreat over 50 and 100 years.",
            "Check if the council has placed any coastal hazard overlays, consent notices, or natural hazard notations on the certificate of title.",
            "Coastal erosion may affect future insurance availability — some insurers are already withdrawing cover from high-erosion zones.",
            "Building consent for new structures or significant alterations may be declined or subject to conditions in coastal hazard areas.",
            "Request a LIM — it will show any coastal hazard notations and whether managed retreat policies apply.",
            "Check if the property is subject to any regional or district plan rules that restrict development in coastal hazard zones.",
        ],
    },
    {
        "id": "coastal_erosion_mod",
        "severity": "advisory",
        "title": "Coastal Erosion Awareness",
        "category": "hazards",
        "default_actions": [
            "This property has moderate coastal erosion exposure. While not immediately critical, coastal processes are long-term and accelerating with sea level rise.",
            "Check the LIM for any coastal hazard notations.",
            "Review projected sea level rise scenarios for this area — NIWA projections suggest 0.3-1.0m by 2100 depending on emissions pathway.",
        ],
    },
    {
        "id": "slope_failure_high",
        "severity": "critical",
        "title": "Landslide Risk — Geotechnical Assessment Required",
        "category": "hazards",
        "default_actions": [
            "This property is in a High/Very High earthquake-induced slope failure zone (GWRC mapping). "
            "Wellington's steep terrain and clay soils make this one of NZ's most slip-prone regions.",
            "Commission a geotechnical assessment ($2,000-5,000) before going unconditional. "
            "The engineer should assess: slope angle, soil type, drainage adequacy, retaining wall condition, "
            "and any evidence of historic ground movement.",
            "During your building inspection, specifically look for: cracked concrete paths/driveways, "
            "leaning or bowing retaining walls, shifted fence lines, doors/windows that don't close properly, "
            "and cracks in interior walls (especially diagonal cracks near corners).",
            "Request LIM from council — it will show any recorded slips, remediation notices, or "
            "drainage requirements on the property. Also check EQC claim history.",
            "Ask neighbours directly: 'Have there been any slips on this hillside?' "
            "Local knowledge often reveals issues not on official records.",
            "Review your insurance — some policies exclude or limit landslip cover. "
            "Get quotes before going unconditional. EQC covers natural disaster land damage "
            "but private insurers may load premiums in high-risk zones.",
        ],
    },
    {
        "id": "slope_failure_moderate",
        "severity": "advisory",
        "title": "Slope Stability — Inspection Considerations",
        "category": "hazards",
        "default_actions": [
            "This property is in a Medium slope failure susceptibility zone. While not high-risk, "
            "Wellington's rainfall patterns mean slope stability should be part of your due diligence.",
            "During building inspection, ask the inspector to specifically check retaining walls, "
            "subfloor drainage, and any signs of past ground movement.",
            "Check the LIM for any recorded slips or drainage requirements on the property.",
        ],
    },
    {
        "id": "compounding_seismic",
        "severity": "critical",
        "title": "Combined Slope + Liquefaction Risk",
        "category": "hazards",
        "default_actions": [
            "This site is rated High for both slope failure AND liquefaction. A single significant earthquake "
            "can trigger both ground-failure modes simultaneously — they compound, they don't average out.",
            "Commission a combined geotechnical + slope-stability assessment from a chartered engineer. "
            "Budget $5,000–$8,000, not the usual $2,000–$3,000 for a single-hazard report.",
            "The assessment should explicitly cover: foundation type adequacy on liquefiable ground, "
            "slope stability under saturated conditions, and any prior remediation or strengthening on the site.",
            "Get this BEFORE going unconditional. EQC covers natural disaster damage but private insurance "
            "loadings on combined-hazard sites can be material — get insurance quotes alongside the geotech.",
            "Christchurch 2011 demonstrated how compounding hazards behave — the combined-mode failures were "
            "the costliest and slowest to remediate.",
        ],
    },
    {
        "id": "saturated_slope",
        "severity": "important",
        "title": "Slope + Surface Water — Drainage Focus",
        "category": "hazards",
        "default_actions": [
            "This site combines slip-prone slope with active surface water (overland flow path, depression, "
            "or nearby waterway). Rainfall-saturated soil is the #1 NZ slip trigger — Auckland Anniversary 2023, "
            "Cyclone Gabrielle, and the Wellington 2013 storm all hit slopes with this profile hardest.",
            "Geotechnical assessment should specifically cover subfloor drainage, cut-slope retaining wall condition, "
            "and any geotextile or drainage treatments on the site. Generic slope reports often miss the water angle.",
            "The builder's report must document drainage adequacy: are gutters/downpipes sized for intense rainfall? "
            "Where does roof water discharge? Is the subfloor ventilated or persistently damp?",
            "Check the LIM for any council-required drainage maintenance or stormwater conditions on the title.",
        ],
    },
    # ── ENVIRONMENT ───────────────────────────────────────────────────────────
    {
        "id": "noise_high",
        "severity": "important",
        "title": "Road Noise — Livability Check",
        "category": "environment",
        "default_actions": [
            "Measured road noise at this location is {noise_db} dB — equivalent to a busy restaurant or constant traffic. The WHO recommends below 55 dB for residential wellbeing.",
            "{noise_stack_line}",
            "Visit the property during morning (7-9am) and evening (4-6pm) peak traffic to experience the noise firsthand.",
            "Check window glazing — double glazing reduces noise by 25-35 dB; single glazing only ~20 dB. Retrofitting double glazing costs $500-$1,200 per window.",
            "Check bedroom orientation — bedrooms facing away from the road will be significantly quieter.",
            "If multi-unit: ask which floor. Ground floor units near roads are worst affected; higher floors may be quieter depending on proximity.",
            "Check for noise barriers, fencing, or landscaping that provides acoustic screening.",
            "If buying to rent: Healthy Homes standards don't address noise, but tenants in noisy properties have higher turnover.",
        ],
    },
    {
        "id": "noise_moderate",
        "severity": "advisory",
        "title": "Road Noise Awareness",
        "category": "environment",
        "default_actions": [
            "Road noise at this location is {noise_db} dB — above the WHO recommended 55 dB for residential areas but below the level that typically requires mitigation.",
            "Visit during peak traffic hours to judge whether the noise level is acceptable to you.",
            "If you're noise-sensitive, check bedroom positioning relative to the road.",
        ],
    },
    {
        "id": "air_degrading",
        "severity": "advisory",
        "title": "Air Quality Concerns",
        "category": "environment",
        "default_actions": [
            "The nearest air quality monitoring site shows a degrading PM10 trend. This typically indicates increasing particulate pollution from wood burners, traffic, or industrial activity.",
            "If anyone in the household has asthma or respiratory conditions, consider a HEPA air purifier for main living areas.",
            "Check if wood burners are the dominant PM10 source in this area — the regional council can confirm. Some areas have clean air zones restricting older burners.",
            "Avoid drying laundry outside on still winter days when temperature inversions trap pollution at ground level.",
            "Check the GWRC air quality monitoring data at gw.govt.nz for historical trends and seasonal patterns.",
        ],
    },
    {
        "id": "water_poor",
        "severity": "advisory",
        "title": "Local Waterway Quality",
        "category": "environment",
        "default_actions": [
            "The nearest monitored waterway has poor E.coli levels (Band D/E). This refers to surface water quality, NOT drinking water supply — Wellington's reticulated water supply is treated and safe.",
            "If the property uses bore water (rare in Wellington urban areas), get it independently tested before purchase. Cost: $100-$300 for a comprehensive test.",
            "Avoid recreational swimming or paddling in the nearest waterway during or after heavy rain — stormwater runoff worsens E.coli levels.",
            "If the property is near the waterway, check for flooding and drainage issues — poor water quality streams often have stormwater overflow issues.",
        ],
    },
    {
        "id": "contamination_nearby",
        "severity": "critical",
        "title": "Contaminated Land Due Diligence",
        "category": "environment",
        "default_actions": [
            "A contaminated site ({contam_name}, category: {contam_category}) is within {contam_distance_m}m of this property.",
            "{contam_severity_note}",
            "Commission a Preliminary Site Investigation (Phase 1 Environmental Site Assessment) from a suitably qualified environmental consultant. Cost: $1,500-$3,000.",
            "Check the regional council Selected Land Use Register (SLUR) or equivalent for the full site history and contamination category.",
            "HAIL (Hazardous Activities and Industries List) sites are categorised under the NES for Assessing and Managing Contaminants in Soil — the category determines what land-use changes trigger further investigation.",
            "If the contaminated site is uphill or upstream of this property, groundwater migration is possible — raise this with your environmental assessor.",
            "Your lender may require environmental clearance before approving the mortgage, particularly for Category A sites within 500m.",
            "If buying to develop or subdivide: NES contaminated land rules may require a Detailed Site Investigation (DSI) before resource consent is granted.",
        ],
    },
    {
        "id": "climate_warming",
        "severity": "advisory",
        "title": "Climate Change Adaptation",
        "category": "environment",
        "default_actions": [
            "Climate projections for this area show {climate_temp_change}\u00b0C warming by 2041-2060. This affects comfort, energy costs, and property resilience.",
            "Check the home's insulation — Healthy Homes standards are a minimum, not optimal. Ceiling insulation should be R3.3+, underfloor R1.3+.",
            "Consider whether the property will need active cooling (heat pump) for increasingly warm summers — north and west-facing rooms are most affected.",
            "North-facing glazing without external shading (eaves, pergola, deciduous trees) will become more of a liability as temperatures rise.",
            "Increased rainfall intensity is projected alongside warming — check stormwater drainage capacity and gutter/downpipe condition.",
        ],
    },
    # ── LIVEABILITY ───────────────────────────────────────────────────────────
    {
        "id": "deprivation_high",
        "severity": "advisory",
        "title": "Area Deprivation Context",
        "category": "liveability",
        "default_actions": [
            "This area has an NZDep index of {nzdep_decile}/10 (10 = most deprived). NZDep measures area-level deprivation based on census data including income, employment, education, and housing quality.",
            "Visit at different times of day and on weekends to assess the neighbourhood character — the statistical index doesn't capture recent changes.",
            "The 2018 NZDep index may not reflect recent gentrification or new development — check recent sales prices and new builds nearby.",
            "Check home insurance premiums — some insurers price by area deprivation, which can affect annual costs by $200-$500.",
            "NZDep is a statistical area measure, not a property measure — individual streets within an area can vary significantly.",
        ],
    },
    {
        "id": "crime_high",
        "severity": "important",
        "title": "Crime Awareness & Security",
        "category": "liveability",
        "default_actions": [
            "This area is in the {crime_percentile}th percentile for recorded crime victimisations.",
            "{crime_vics_line}",
            "Property crime (burglary, theft) drives insurance costs; violent crime drives personal safety. The percentile alone doesn't tell you which is dominant — check the breakdown before assuming.",
            "Ensure the property has adequate security: deadbolts on exterior doors, sensor lights, visible street frontage, and secure garaging if available.",
            "Ask neighbours about their experience — they'll give you a more nuanced picture than statistics alone.",
            "If buying to rent: higher crime areas may have higher tenant turnover and more maintenance costs from break-ins.",
        ],
    },
    {
        "id": "crashes_nearby",
        "severity": "important",
        "title": "Road Safety Concerns",
        "category": "liveability",
        "default_actions": [
            "There have been {total_serious_fatal_crashes} serious or fatal crashes within 300m in the last 5 years. This indicates a road safety hotspot.",
            "If the household includes children, assess pedestrian crossing availability on the main roads and walking routes to school.",
            "Check intersection geometry — some crash clusters are caused by poor sightlines, tight corners, or missing traffic controls. These may be improved by council.",
            "Note whether the property driveway exits onto a high-crash road — reversing onto busy roads with poor visibility is a common hazard.",
            "Check the Waka Kotahi Crash Analysis System at cas.nzta.govt.nz for detailed crash types and causes at this location.",
        ],
    },
    {
        "id": "schools_in_zone_many",
        "severity": "advisory",
        "title": "Strong School Zone Coverage",
        "category": "liveability",
        "default_actions": [
            "This property is in the enrolment zone for {in_zone_school_count} schools: {school_names}.",
            "Verify current enrolment zone boundaries directly with each school — zones are reviewed annually and can change.",
            "Compare EQI (Equity Index) scores in the Liveability section above. Lower EQI generally indicates a school serving a less deprived community, though it is NOT a direct measure of teaching quality.",
            "Being in-zone guarantees enrolment but not your preferred class or stream — contact the school early about specific programmes.",
            "School zone coverage adds value at resale — in-zone properties for high-demand schools command premiums of 5-15% in Wellington.",
        ],
    },
    {
        "id": "schools_in_zone_few",
        "severity": "advisory",
        "title": "School Zone Options",
        "category": "liveability",
        "default_actions": [
            "This property is in zone for: {school_names}. Limited in-zone options mean these schools are your guaranteed pathway.",
            "Verify current enrolment zone boundaries at each school's website — zones change annually.",
            "If these schools don't suit your needs, you'll need to enter the ballot for out-of-zone places at other schools. Ballot applications typically open in Term 3 for the following year.",
            "Check the Ministry of Education school finder at educationcounts.govt.nz for full zone maps.",
        ],
    },
    {
        "id": "schools_no_zone",
        "severity": "important",
        "title": "No In-Zone Schools Nearby",
        "category": "liveability",
        "default_actions": [
            "There are no school enrolment zones covering this property within 1.5km. You will likely need to ballot for school places.",
            "Check the Ministry of Education school finder at educationcounts.govt.nz to identify which schools have zones that may include this address — some zones are larger than the 1.5km search radius.",
            "Ballot application deadlines are typically in Term 3 (Jul-Sep) for the following year. Some popular schools receive 3-5x more ballot applications than available places.",
            "Consider whether daily school transport is practical from this location — both driving and public transport options.",
            "Private/independent schools do not have enrolment zones and accept applications directly.",
        ],
    },
    {
        "id": "transit_poor",
        "severity": "important",
        "title": "Limited Public Transport",
        "category": "liveability",
        "default_actions": [
            "Only {transit_stops_400m} public transport stop{transit_s} within 400m. This location is not well served by public transport.",
            "Factor in vehicle running costs if car-dependent — the AA estimates $150-$200/week for a typical car in NZ (fuel, insurance, maintenance, registration).",
            "Check Metlink bus/train frequency for the nearest stops at metlink.org.nz — some stops have infrequent services (1-2 per hour).",
            "If working from home is not an option, verify commute times by car during peak hours (7-9am) before committing.",
            "Check if any new public transport routes or improvements are planned — the GWRC Long Term Plan and Let's Get Wellington Moving programme may affect future services.",
        ],
    },
    {
        "id": "transit_good",
        "severity": "advisory",
        "title": "Excellent Transit Access",
        "category": "liveability",
        "default_actions": [
            "{transit_stops_400m} public transport stops within 400m — this is excellent by Wellington standards.",
            "Check Metlink at metlink.org.nz for direct routes to your workplace, school, or regular destinations.",
            "Good transit access supports car-free or one-car living, potentially saving $8,000-$10,000 per year.",
            "Strong transit access adds resilience to property value — it's increasingly valued by buyers and renters.",
        ],
    },
    {
        "id": "gp_far",
        "severity": "advisory",
        "title": "Healthcare Access",
        "category": "liveability",
        "default_actions": [
            "The nearest GP clinic is {gp_distance_m}m away. For regular medical appointments, you may need a vehicle.",
            "{pharmacy_line}",
            "Check if the nearest GP practice is accepting new enrolments — many NZ practices have closed books, and you may need to enrol further away.",
            "Register with a GP as soon as you move in — don't wait until you need urgent care.",
        ],
    },
    # ── MARKET ────────────────────────────────────────────────────────────────
    {
        "id": "yield_low",
        "severity": "advisory",
        "title": "Low Rental Yield",
        "category": "market",
        "default_actions": [
            "Indicative gross yield is {yield_pct}% — below the 3-4% typical for NZ metros. This means rental income will not cover mortgage costs at current interest rates (~6-7%).",
            "{hpi_sales_line}",
            "If purchasing as an investment: your return relies heavily on capital gains. Consider whether you expect house prices to rise in this area over your investment horizon.",
            "Compare with alternative investments — term deposits currently offer 4-5% with zero risk.",
            "For owner-occupiers: yield is less relevant, but it indicates the property may be expensive relative to the local rental market.",
        ],
    },
    {
        "id": "yield_good",
        "severity": "advisory",
        "title": "Strong Rental Yield",
        "category": "market",
        "default_actions": [
            "Indicative gross yield is {yield_pct}% — above the Wellington metro average of ~3.5%. This suggests good cash flow potential.",
            "Verify by checking actual rental listings for comparable properties on trademe.co.nz/property/residential-property-to-rent.",
            "Remember: gross yield doesn't account for rates, insurance, maintenance (budget 1-2% of CV), property management (8-10%), or vacancy. Net yield is typically 1.5-2% lower.",
        ],
    },
    {
        "id": "rents_rising",
        "severity": "advisory",
        "title": "Rents Rising in This Area",
        "category": "market",
        "default_actions": [
            "Rents in this SA2 area are rising above inflation for some property types. Check the Market section above for specifics by dwelling type and bedrooms.",
            "For buyers: rising rents support the investment case, but check whether this is a one-off correction or sustained trend by reviewing the CAGR figures.",
            "For renters: budget for a rent increase at your next renewal — landlords in rising-rent areas typically lift rents to market. The maximum increase frequency is once every 12 months.",
            "Check Tenancy Services at tenancy.govt.nz for your rights around rent increases.",
        ],
    },
    {
        "id": "market_active_development",
        "severity": "advisory",
        "title": "Active Development Area",
        "category": "market",
        "default_actions": [
            "{resource_consents_500m} resource consents granted within 500m in the last 2 years — this is a high level of development activity.",
            "Nearby construction may affect short-term livability: noise, dust, traffic disruption, and visual obstruction during build.",
            "New housing supply coming online may moderate future rent growth and property price growth in this specific area.",
            "Check the WCC consent portal for project types — residential intensification often brings improved local amenities (cafes, shops) over time.",
            "If buying to live in: visit during weekday construction hours to assess current disruption.",
        ],
    },
    # ── PLANNING ──────────────────────────────────────────────────────────────
    {
        "id": "epb_listed",
        "severity": "critical",
        "title": "This Building is Earthquake-Prone",
        "category": "planning",
        "default_actions": [
            "This building is on the MBIE Earthquake-Prone Buildings Register. This means it has been assessed below 34% of the New Building Standard (%NBS).",
            "Request the Detailed Seismic Assessment (DSA) from the vendor — it shows the exact %NBS rating and identifies structural weaknesses.",
            "Check the statutory remediation deadline: Priority 1 (hospitals, schools, emergency) = 7.5 years; Priority 2 (high traffic) = 15 years; Priority 3 (all others) = 25 years from the EPB notice date.",
            "Get a structural engineer's estimate for strengthening works. Costs vary enormously: $50,000-$500,000+ depending on building type, size, and target %NBS.",
            "EPB status affects insurance premiums (may be 20-50% higher) and mortgage availability (some banks won't lend on EPB buildings or reduce LVR).",
            "EPB status is disclosed on the LIM and affects resale — factor in the cost of strengthening works when making your offer.",
            "For apartments/units: the body corporate is responsible for strengthening — check what is planned, budgeted, and whether a special levy is expected.",
        ],
    },
    {
        "id": "contaminated_land",
        "severity": "critical",
        "title": "Contaminated Land — Planning Restrictions",
        "category": "planning",
        "default_actions": [
            "This property is listed on the contaminated land register. This may restrict future development, subdivision, or change of land use.",
            "Commission a Preliminary Site Investigation (PSI) before purchase — your lender may require this.",
            "Check whether remediation has been completed and a Site Validation Report (SVR) exists — this confirms the land has been cleaned up to an acceptable standard.",
            "Under the NES for Assessing and Managing Contaminants in Soil, certain activities (subdivision, soil disturbance, change of use) trigger mandatory investigation.",
            "Your lender may require environmental clearance before approving the mortgage — check with your broker early.",
            "If the contamination is historical (e.g., former orchard, petrol station, industrial use) and remediated, the practical risk may be low — but the listing remains.",
        ],
    },
    {
        "id": "heritage_listed",
        "severity": "important",
        "title": "Heritage Listing — What It Means",
        "category": "planning",
        "default_actions": [
            "This property is heritage-listed under the District Plan. External alterations, additions, and demolition require resource consent.",
            "Review the District Plan heritage schedule entry to understand which features are protected — it may be the full building, or specific elements (facade, roof form, interior features).",
            "Factor heritage consent into renovation budgets — resource consent fees ($2,000-$5,000) plus potential requirements for heritage-compatible materials and methods.",
            "Heritage NZ Pouhere Taonga may offer funding, advice, or rate relief for maintenance of listed heritage features — check heritage.org.nz.",
            "Heritage status can be a positive for resale — character homes command premiums of 10-20% in Wellington, and listing protects the neighbourhood character that supports those premiums.",
            "Interior changes that don't affect the exterior generally don't require heritage consent, but check the specific listing provisions.",
        ],
    },
    {
        "id": "transmission_lines",
        "severity": "important",
        "title": "Transmission Line Proximity",
        "category": "planning",
        "default_actions": [
            "A high-voltage transmission line is within {transmission_distance_m}m of this property.",
            "Check the certificate of title for any Transpower easement — this restricts what you can build within the easement corridor.",
            "Some lenders restrict loan-to-value ratio (LVR) or decline to lend on properties directly under transmission lines. Check with your broker.",
            "If you have concerns about electromagnetic fields (EMF), you can request a measurement from the property boundary. Transpower publishes EMF information at transpower.co.nz.",
            "Trees within the easement corridor may be subject to trimming or removal by Transpower.",
        ],
    },
    {
        "id": "heritage_area",
        "severity": "advisory",
        "title": "Heritage Neighbourhood Context",
        "category": "planning",
        "default_actions": [
            "There are {heritage_count_500m} heritage-listed buildings or sites within 500m. You're in a character neighbourhood with heritage protections.",
            "This generally protects property values by preventing unsympathetic development, but may limit what neighbours (and you) can do externally.",
            "If planning renovations: check the District Plan heritage precinct rules, which may apply area-wide controls in addition to individual listing.",
        ],
    },
    {
        "id": "multi_unit_body_corp",
        "severity": "important",
        "title": "Multi-Unit / Body Corporate Due Diligence",
        "category": "planning",
        "default_actions": [
            "This is a multi-unit property. If it has a body corporate (unit title), additional due diligence is required.",
            "Request the body corporate minutes from the last 2 years — look for: deferred maintenance, disputes, proposed special levies, building condition reports.",
            "Ask about the long-term maintenance plan (LTMP) and whether the body corporate fund is adequately funded. Under the Unit Titles Act 2010, the body corporate must have an LTMP.",
            "Check current body corporate levies and whether any special assessments or capital works are pending — strengthening, reclad, or lift replacement can cost $20,000-$100,000+ per unit.",
            "For cross-lease: there is no body corporate, but you share land ownership. Check the flats plan matches the as-built layout.",
            "Ask what the body corporate rules say about pets, Airbnb/short-term letting, renovations, and parking allocation.",
        ],
    },
    {
        "id": "leaky_era",
        "severity": "important",
        "title": "Leaky Building Era (1994-2004)",
        "category": "planning",
        "default_actions": [
            "If this building was constructed or substantially modified between 1994-2004, it falls within the \"leaky building era.\" Monolithic cladding systems (plaster, EIFS, texture-coated polystyrene) from this period are high risk.",
            "Request a specific weathertightness assessment as part of your builder's report. Look for: moisture ingress around windows, balcony junctions, penetrations, and parapet details.",
            "Check the MBIE weathertight homes database and whether any claims have been lodged against this property.",
            "If cladding issues are found: remediation costs range from $50,000 to $300,000+ depending on the extent. Budget accordingly or renegotiate.",
            "Check if the property has been reclad — if so, request documentation of the reclad specification and building consent.",
            "Council records (available via the LIM or property file) will show the original building consent date and any subsequent alterations.",
        ],
    },
    {
        "id": "large_footprint",
        "severity": "advisory",
        "title": "Large Building — Maintenance Considerations",
        "category": "planning",
        "default_actions": [
            "This building has a footprint of {building_footprint_sqm}m\u00b2. Larger buildings have proportionally higher maintenance costs.",
            "{maintenance_line}",
            "Roof replacement, exterior painting, and re-piling are the biggest cost items — check the condition of each in your builder's report.",
        ],
    },
]


# --- Admin check (requires OAuth sign-in + email in ADMIN_EMAILS) ---

@router.get("/check", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_check(request: Request):
    """Check if the signed-in user has admin access. Returns 200 or 403."""
    return {"status": "admin"}


# --- Credit management ---

@router.get("/users", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_list_users(
    request: Request,
    q: str = Query("", description="Search by email or name"),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
):
    """List users with their credit balances."""
    offset = (page - 1) * per_page
    async with _db.pool.connection() as conn:
        if q.strip():
            pattern = f"%{q.strip().lower()}%"
            cur = await conn.execute(
                """
                SELECT u.user_id, u.email, u.display_name, u.plan, u.created_at,
                  COALESCE(SUM(rc.credits_remaining) FILTER (WHERE rc.report_tier = 'quick'
                    AND rc.cancelled_at IS NULL AND (rc.expires_at IS NULL OR rc.expires_at > now())), 0)::int AS quick_credits,
                  COALESCE(SUM(rc.credits_remaining) FILTER (WHERE rc.report_tier = 'full'
                    AND rc.cancelled_at IS NULL AND (rc.expires_at IS NULL OR rc.expires_at > now())), 0)::int AS full_credits,
                  (SELECT COUNT(*) FROM saved_reports sr WHERE sr.user_id = u.user_id)::int AS total_reports
                FROM users u
                LEFT JOIN report_credits rc ON rc.user_id = u.user_id
                WHERE LOWER(u.email) LIKE %s OR LOWER(COALESCE(u.display_name, '')) LIKE %s
                GROUP BY u.user_id
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
                """,
                [pattern, pattern, per_page, offset],
            )
        else:
            cur = await conn.execute(
                """
                SELECT u.user_id, u.email, u.display_name, u.plan, u.created_at,
                  COALESCE(SUM(rc.credits_remaining) FILTER (WHERE rc.report_tier = 'quick'
                    AND rc.cancelled_at IS NULL AND (rc.expires_at IS NULL OR rc.expires_at > now())), 0)::int AS quick_credits,
                  COALESCE(SUM(rc.credits_remaining) FILTER (WHERE rc.report_tier = 'full'
                    AND rc.cancelled_at IS NULL AND (rc.expires_at IS NULL OR rc.expires_at > now())), 0)::int AS full_credits,
                  (SELECT COUNT(*) FROM saved_reports sr WHERE sr.user_id = u.user_id)::int AS total_reports
                FROM users u
                LEFT JOIN report_credits rc ON rc.user_id = u.user_id
                GROUP BY u.user_id
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
                """,
                [per_page, offset],
            )
        rows = cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/users/{user_id}/credits", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_adjust_credits(
    request: Request,
    user_id: str,
    amount: int = Query(..., description="Credits to add (positive) or remove (negative)"),
    tier: str = Query("full", description="quick or full"),
):
    """Add or remove credits for a user. Positive = add, negative = remove."""
    if tier not in ("quick", "full"):
        raise HTTPException(400, "tier must be 'quick' or 'full'")

    async with _db.pool.connection() as conn:
        # Verify user exists
        cur = await conn.execute("SELECT 1 FROM users WHERE user_id = %s", [user_id])
        if not cur.fetchone():
            raise HTTPException(404, "User not found")

        if amount > 0:
            # Add credits — insert a new admin-granted credit row
            await conn.execute(
                """
                INSERT INTO report_credits (user_id, credit_type, credits_remaining, report_tier)
                VALUES (%s, 'promo', %s, %s)
                """,
                [user_id, amount, tier],
            )
        elif amount < 0:
            # Remove credits — decrement from most recent matching credit rows
            remaining = abs(amount)
            cur = await conn.execute(
                """
                SELECT id, credits_remaining FROM report_credits
                WHERE user_id = %s AND report_tier = %s
                  AND credits_remaining > 0
                  AND cancelled_at IS NULL
                  AND (expires_at IS NULL OR expires_at > now())
                ORDER BY purchased_at DESC
                """,
                [user_id, tier],
            )
            for row in cur.fetchall():
                if remaining <= 0:
                    break
                deduct = min(remaining, row["credits_remaining"])
                await conn.execute(
                    "UPDATE report_credits SET credits_remaining = credits_remaining - %s WHERE id = %s",
                    [deduct, row["id"]],
                )
                remaining -= deduct

    logger.info(f"ADMIN_AUDIT: credits_adjusted user={user_id} amount={amount} tier={tier}")
    return {"ok": True, "user_id": user_id, "amount": amount, "tier": tier}


# --- Dashboard ---

@router.get("/dashboard", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_dashboard(request: Request):
    """Summary stats: rent report counts, feedback counts, email signups."""
    async with _db.pool.connection() as conn:
        stats = {}
        for label, days in [("24h", 1), ("7d", 7), ("30d", 30)]:
            cur = await conn.execute(
                "SELECT COUNT(*) AS cnt FROM user_rent_reports WHERE reported_at > NOW() - make_interval(days => %s)",
                [days],
            )
            stats[f"rent_reports_{label}"] = (cur.fetchone())["cnt"]

        cur = await conn.execute(
            "SELECT COUNT(*) AS cnt FROM feedback WHERE created_at > NOW() - interval '7 days'"
        )
        stats["feedback_7d"] = (cur.fetchone())["cnt"]

        cur = await conn.execute("SELECT COUNT(*) AS cnt FROM email_signups")
        stats["total_email_signups"] = (cur.fetchone())["cnt"]

        cur = await conn.execute(
            "SELECT COUNT(*) AS cnt FROM feedback WHERE status = 'new'"
        )
        stats["unresolved_feedback"] = (cur.fetchone())["cnt"]

    return stats


# --- Data Health ---

@router.get("/data-health", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_data_health(request: Request):
    """Per-table row counts + service health checks."""
    table_stats = {}
    async with _db.pool.connection() as conn:
        for t in ALLOWED_TABLES:
            try:
                cur = await conn.execute(sql.SQL("SELECT COUNT(*) AS cnt FROM {}").format(sql.Identifier(t)))
                table_stats[t] = (cur.fetchone())["cnt"]
            except Exception:
                table_stats[t] = "error"

    # Service health
    services = {"db": True, "redis": False}
    if redis_client:
        try:
            await redis_client.ping()
            services["redis"] = True
        except Exception:
            pass

    return {"tables": table_stats, "services": services}


# --- Data Loader ---

@router.get("/data-sources", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_data_sources(request: Request):
    """List available data sources with load status."""
    from ..services.data_loader import DATA_SOURCES

    sources = []
    async with _db.pool.connection() as conn:
        for src in DATA_SOURCES:
            table_counts = {}
            for t in src.tables:
                if t not in ALLOWED_TABLES:
                    continue
                try:
                    cur = await conn.execute(sql.SQL("SELECT COUNT(*) AS cnt FROM {}").format(sql.Identifier(t)))
                    table_counts[t] = (cur.fetchone())["cnt"]
                except Exception:
                    table_counts[t] = 0

            # Check last loaded time from data_versions if it exists
            loaded_at = None
            try:
                cur = await conn.execute(
                    "SELECT loaded_at, row_count FROM data_versions WHERE source = %s",
                    (src.key,),
                )
                row = cur.fetchone()
                if row:
                    loaded_at = str(row["loaded_at"])
            except Exception:
                pass

            total_rows = sum(v for v in table_counts.values() if isinstance(v, int))
            sources.append({
                "key": src.key,
                "label": src.label,
                "tables": table_counts,
                "total_rows": total_rows,
                "loaded_at": loaded_at,
                "status": "loaded" if total_rows > 0 else "empty",
            })

    # Check for active loader job
    active_job = None
    if redis_client:
        try:
            active = await redis_client.get("data_loader:active")
            if active:
                active_job = json.loads(active)
        except Exception:
            pass

    return {"sources": sources, "active_job": active_job}


@router.post("/data-sources/{source_key}/load", dependencies=[Depends(require_admin)])
@limiter.limit("3/minute")
async def admin_load_data_source(request: Request, source_key: str):
    """Trigger a background data load for a source."""
    import uuid
    import asyncio
    from ..services.data_loader import DATA_SOURCES_BY_KEY, run_loader

    if source_key not in DATA_SOURCES_BY_KEY:
        raise HTTPException(404, f"Unknown data source: {source_key}")

    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"ADMIN_AUDIT: load_data_source {source_key} from {client_ip}")

    # Check for active job
    if redis_client:
        try:
            active = await redis_client.get("data_loader:active")
            if active:
                return JSONResponse(
                    {"error": "A data load is already in progress", "active": json.loads(active)},
                    status_code=409,
                )
        except Exception:
            pass

    job_id = str(uuid.uuid4())[:8]
    job = {"id": job_id, "source": source_key, "status": "running", "progress": [], "error": None}

    # Store active job state
    if redis_client:
        try:
            await redis_client.set("data_loader:active", json.dumps(job), ex=1800)
        except Exception:
            pass

    # Run in background thread (data loading is sync + CPU-bound)
    def _run():
        progress_msgs = []

        def on_progress(msg):
            progress_msgs.append(msg)
            # Update Redis progress
            try:
                import asyncio as aio
                loop = aio.new_event_loop()
                job_update = {**job, "progress": progress_msgs[-10:]}  # Keep last 10
                if redis_client:
                    loop.run_until_complete(
                        redis_client.set("data_loader:active", json.dumps(job_update), ex=1800)
                    )
                loop.close()
            except Exception:
                pass

        result = run_loader(source_key, on_progress)
        return result

    loop = asyncio.get_event_loop()
    # Don't await — fire and forget
    async def _background():
        try:
            result = await loop.run_in_executor(None, _run)
            completed = {
                "id": job_id, "source": source_key,
                "status": "completed" if not result["error"] else "failed",
                "rows": result["rows"], "error": result["error"],
            }
            if redis_client:
                await redis_client.set("data_loader:active", json.dumps(completed), ex=300)
                # Flush report cache so new data shows
                await redis_client.delete(*[
                    k async for k in redis_client.scan_iter("report:*")
                ] or ["_noop"])
        except Exception as e:
            if redis_client:
                await redis_client.set(
                    "data_loader:active",
                    json.dumps({"id": job_id, "source": source_key, "status": "failed", "error": str(e)}),
                    ex=300,
                )

    asyncio.create_task(_background())

    return {"job_id": job_id, "source": source_key, "status": "started"}


@router.get("/data-sources/job", dependencies=[Depends(require_admin)])
@limiter.limit("60/minute")
async def admin_data_loader_status(request: Request):
    """Poll active data loader job status."""
    if not redis_client:
        return {"active_job": None}
    try:
        active = await redis_client.get("data_loader:active")
        if active:
            return {"active_job": json.loads(active)}
    except Exception:
        pass
    return {"active_job": None}


@router.delete("/data-sources/job", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
async def admin_clear_loader_job(request: Request):
    """Clear a completed/failed job from the active slot."""
    if redis_client:
        try:
            await redis_client.delete("data_loader:active")
        except Exception:
            pass
    return {"cleared": True}


@router.post("/data-sources/load-new", dependencies=[Depends(require_admin)])
@limiter.limit("1/minute")
async def admin_load_all_new(request: Request):
    """Load all datasets that have never been loaded (not in data_versions).
    Runs migrations first, then loads new datasets sequentially in background."""
    import uuid
    import asyncio
    from ..services.data_loader import DATA_SOURCES, run_loader

    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"ADMIN_AUDIT: load_all_new from {client_ip}")

    # Check for active job
    if redis_client:
        try:
            active = await redis_client.get("data_loader:active")
            if active:
                return JSONResponse(
                    {"error": "A data load is already in progress", "active": json.loads(active)},
                    status_code=409,
                )
        except Exception:
            pass

    # Find unloaded datasets
    unloaded = []
    async with _db.pool.connection() as conn:
        try:
            cur = await conn.execute("SELECT source FROM data_versions")
            loaded = {r["source"] for r in cur.fetchall()}
        except Exception:
            loaded = set()

        unloaded = [s.key for s in DATA_SOURCES if s.key not in loaded]

    if not unloaded:
        return {"status": "nothing_to_load", "message": "All datasets already loaded", "total": len(DATA_SOURCES)}

    job_id = str(uuid.uuid4())[:8]
    job = {
        "id": job_id, "source": f"batch ({len(unloaded)} new)",
        "status": "running", "progress": [], "error": None,
        "pending": unloaded, "total_pending": len(unloaded),
    }

    if redis_client:
        try:
            await redis_client.set("data_loader:active", json.dumps(job), ex=7200)
        except Exception:
            pass

    loop = asyncio.get_event_loop()

    async def _background():
        total_rows = 0
        errors = 0
        completed_keys = []

        # 1. Run migrations
        try:
            import glob
            from ..services.data_loader import _db_url_to_sync
            import psycopg
            mig_conn = psycopg.connect(_db_url_to_sync())
            mig_conn.autocommit = True
            mig_cur = mig_conn.cursor()
            for mf in sorted(glob.glob("migrations/0*.sql")):
                try:
                    with open(mf) as f:
                        mig_cur.execute(f.read())
                except Exception:
                    pass
            mig_conn.close()
        except Exception as e:
            logger.warning(f"Migration error: {e}")

        # 2. Load new datasets sequentially
        for i, key in enumerate(unloaded):
            progress_msg = f"[{i+1}/{len(unloaded)}] Loading {key}..."

            def _run_one(k=key):
                msgs = []
                def on_progress(msg):
                    msgs.append(msg)
                return run_loader(k, on_progress)

            try:
                result = await loop.run_in_executor(None, _run_one)
                if result.get("error"):
                    errors += 1
                    progress_msg += f" FAIL: {result['error'][:60]}"
                else:
                    total_rows += result["rows"]
                    progress_msg += f" OK: {result['rows']:,} rows"
                completed_keys.append(key)
            except Exception as e:
                errors += 1
                progress_msg += f" ERROR: {str(e)[:60]}"

            # Update Redis progress
            if redis_client:
                try:
                    remaining = [k for k in unloaded if k not in completed_keys]
                    update = {
                        "id": job_id,
                        "source": f"batch ({len(unloaded)} new)",
                        "status": "running",
                        "progress": [progress_msg],
                        "completed": len(completed_keys),
                        "total_pending": len(unloaded),
                        "total_rows": total_rows,
                        "errors": errors,
                        "current": key,
                        "remaining": remaining[:5],
                    }
                    await redis_client.set("data_loader:active", json.dumps(update), ex=7200)
                except Exception:
                    pass

        # 3. Mark complete
        final = {
            "id": job_id,
            "source": f"batch ({len(unloaded)} new)",
            "status": "completed" if errors == 0 else "completed_with_errors",
            "rows": total_rows,
            "errors": errors,
            "loaded_count": len(unloaded) - errors,
            "total_pending": len(unloaded),
        }
        if redis_client:
            await redis_client.set("data_loader:active", json.dumps(final), ex=600)
            # Flush report cache
            try:
                await redis_client.delete(*[
                    k async for k in redis_client.scan_iter("report:*")
                ] or ["_noop"])
            except Exception:
                pass

    asyncio.create_task(_background())

    return {
        "job_id": job_id,
        "status": "started",
        "datasets_to_load": len(unloaded),
        "keys": unloaded,
    }


# --- Feedback Management ---

@router.get("/feedback", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_feedback_list(
    request: Request,
    type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """Paginated feedback list with optional type/status filters."""
    offset = (page - 1) * limit
    async with _db.pool.connection() as conn:
        where_clauses = []
        params: list = []
        if type:
            where_clauses.append(sql.SQL("type = %s"))
            params.append(type)
        if status:
            where_clauses.append(sql.SQL("status = %s"))
            params.append(status)
        where = sql.SQL(" WHERE ") + sql.SQL(" AND ").join(where_clauses) if where_clauses else sql.SQL("")

        cur = await conn.execute(sql.SQL("SELECT COUNT(*) AS cnt FROM feedback") + where, params)
        total = (cur.fetchone())["cnt"]

        cur = await conn.execute(
            sql.SQL("""
            SELECT id, type, description, context, page_url, property_address,
                   importance, satisfaction, email, status, created_at
            FROM feedback""") + where + sql.SQL("""
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
            """),
            params + [limit, offset],
        )
        items = cur.fetchall()

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.patch("/feedback/{feedback_id}", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
async def admin_feedback_update(
    request: Request,
    feedback_id: int,
    status: str = Body(..., embed=True),
):
    """Update feedback status."""
    if status not in ("new", "reviewed", "resolved", "wontfix"):
        raise HTTPException(400, "Invalid status")
    async with _db.pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE feedback SET status = %s WHERE id = %s RETURNING id",
            [status, feedback_id],
        )
        if not cur.fetchone():
            raise HTTPException(404, "Feedback not found")
        await conn.commit()
    return {"status": "updated"}


# --- Email Signups ---

@router.get("/emails", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_emails(
    request: Request,
    format: str = Query("json"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    """Email signup list. Supports JSON (paginated) and CSV (full export)."""
    async with _db.pool.connection() as conn:
        if format == "csv":
            cur = await conn.execute(
                "SELECT email, requested_region, created_at FROM email_signups ORDER BY created_at DESC"
            )
            all_rows = cur.fetchall()
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["email", "requested_region", "created_at"])
            for r in all_rows:
                writer.writerow([r["email"], r["requested_region"], str(r["created_at"])])
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=email_signups.csv"},
            )

        offset = (page - 1) * limit
        cur = await conn.execute("SELECT COUNT(*) AS cnt FROM email_signups")
        total = (cur.fetchone())["cnt"]
        cur = await conn.execute(
            """
            SELECT id, email, requested_region, created_at FROM email_signups
            ORDER BY created_at DESC LIMIT %s OFFSET %s
            """,
            [limit, offset],
        )
        items = cur.fetchall()

    return {"items": items, "total": total, "page": page, "limit": limit}


# --- Content Management ---

@router.get("/content", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_content_get(request: Request):
    """Return admin-editable content (banner, demo addresses, FAQ)."""
    async with _db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT key, value FROM admin_content ORDER BY key"
        )
        rows = cur.fetchall()
        content = {r["key"]: r["value"] for r in rows}
    return content


@router.put("/content/{key}", dependencies=[Depends(require_admin)])
@limiter.limit("10/minute")
async def admin_content_update(
    request: Request, key: str, body: dict = Body(...)
):
    """Update banner, demo_addresses, or FAQ content."""
    valid_keys = ("banner", "demo_addresses", "faq", "recommendations")
    if key not in valid_keys:
        raise HTTPException(400, "Invalid content key")
    async with _db.pool.connection() as conn:
        await conn.execute(
            """
            INSERT INTO admin_content (key, value, updated_at)
            VALUES (%s, %s::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """,
            [key, orjson.dumps(body).decode()],
        )
        await conn.commit()
    return {"status": "updated"}


# --- Recommendations Management ---

@router.get("/recommendations", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def admin_recommendations_list(request: Request):
    """Return all recommendation rules merged with any admin overrides."""
    overrides = {}
    async with _db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT value FROM admin_content WHERE key = 'recommendations'"
        )
        row = cur.fetchone()
        if row:
            overrides = (row["value"] or {}).get("overrides", {})

    rules = []
    for rule in DEFAULT_RECOMMENDATIONS:
        # Extract {placeholder} names from default action templates
        placeholders = sorted({
            m for action in rule.get("default_actions", [])
            for m in re.findall(r"\{(\w+)\}", action)
        })
        merged = {
            **rule,
            "disabled": False,
            "extra_actions": [],
            "severity_override": None,
            "title_override": None,
            "actions_override": None,
            "placeholders": placeholders,
        }
        ovr = overrides.get(rule["id"])
        if ovr:
            merged["disabled"] = ovr.get("disabled", False)
            merged["severity_override"] = ovr.get("severity")
            merged["title_override"] = ovr.get("title")
            merged["extra_actions"] = ovr.get("extra_actions", [])
            merged["actions_override"] = ovr.get("actions")
        rules.append(merged)

    return {"rules": rules}


# =============================================================================
# Analytics endpoints
# =============================================================================

@router.get("/analytics/overview", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def analytics_overview(request: Request, days: int = Query(7, le=90)):
    """Analytics overview: today's stats, trends, top endpoints, slow requests, recent errors."""
    async with _db.pool.connection() as conn:
        result: dict = {}

        # --- Today's live stats ---
        cur = await conn.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN event_type = 'search' THEN 1 END), 0) AS searches,
                COALESCE(SUM(CASE WHEN event_type = 'report_view' THEN 1 END), 0) AS report_views,
                COALESCE(SUM(CASE WHEN event_type = 'report_generated' THEN 1 END), 0) AS reports_generated,
                COALESCE(SUM(CASE WHEN event_type = 'payment_completed' THEN 1 END), 0) AS payments,
                COUNT(DISTINCT session_id) AS active_sessions
            FROM app_events
            WHERE created_at >= CURRENT_DATE
        """)
        today_events = cur.fetchone() or {}

        cur = await conn.execute("""
            SELECT
                COUNT(*) AS total_requests,
                ROUND(AVG(duration_ms)::numeric, 1) AS avg_response_ms,
                COALESCE(SUM(CASE WHEN status_code >= 500 THEN 1 END), 0) AS server_errors
            FROM perf_metrics
            WHERE created_at >= CURRENT_DATE
        """)
        today_perf = cur.fetchone() or {}

        cur = await conn.execute("""
            SELECT COUNT(*) AS count FROM error_log
            WHERE created_at >= CURRENT_DATE
        """)
        today_errors = cur.fetchone() or {}

        result["today"] = {
            "searches": today_events.get("searches", 0),
            "report_views": today_events.get("report_views", 0),
            "reports_generated": today_events.get("reports_generated", 0),
            "payments": today_events.get("payments", 0),
            "active_sessions": today_events.get("active_sessions", 0),
            "total_requests": today_perf.get("total_requests", 0),
            "avg_response_ms": float(today_perf.get("avg_response_ms") or 0),
            "server_errors": today_perf.get("server_errors", 0),
            "errors": today_errors.get("count", 0),
        }

        # --- Trends (from daily_metrics, falling back to live for recent days) ---
        cur = await conn.execute("""
            SELECT day::text, metric_name, metric_value
            FROM daily_metrics
            WHERE day >= CURRENT_DATE - %s * INTERVAL '1 day'
            ORDER BY day
        """, [days])
        trend_rows = cur.fetchall()

        trends: dict = {}
        for row in trend_rows:
            name = row["metric_name"]
            trends.setdefault(name, []).append({
                "day": row["day"], "value": row["metric_value"]
            })
        result["trends"] = trends

        # --- Top endpoints (last 24h) ---
        cur = await conn.execute("""
            SELECT
                COALESCE(path_template, path) AS endpoint,
                COUNT(*) AS count,
                ROUND(AVG(duration_ms)::numeric, 1) AS avg_ms,
                ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 1) AS p95_ms
            FROM perf_metrics
            WHERE created_at >= now() - INTERVAL '24 hours'
            GROUP BY COALESCE(path_template, path)
            ORDER BY count DESC
            LIMIT 15
        """)
        result["top_endpoints"] = cur.fetchall()

        # --- Slow requests (>2s, last 24h) ---
        cur = await conn.execute("""
            SELECT path, duration_ms, method, status_code, created_at::text, request_id
            FROM perf_metrics
            WHERE duration_ms > 2000 AND created_at >= now() - INTERVAL '24 hours'
            ORDER BY duration_ms DESC
            LIMIT 10
        """)
        result["slow_requests"] = cur.fetchall()

        # --- Recent errors ---
        cur = await conn.execute("""
            SELECT id, category, level, message, path, created_at::text,
                   properties->>'resolved_at' AS resolved_at
            FROM error_log
            ORDER BY created_at DESC
            LIMIT 20
        """)
        result["recent_errors"] = cur.fetchall()

        # --- Unresolved error count (for badge) ---
        cur = await conn.execute("""
            SELECT COUNT(*) AS count FROM error_log
            WHERE NOT (properties ? 'resolved_at')
              AND created_at >= now() - INTERVAL '24 hours'
        """)
        result["unresolved_errors_24h"] = (cur.fetchone() or {}).get("count", 0)

    return result


@router.get("/analytics/events", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def analytics_events(
    request: Request,
    event_type: str | None = None,
    days: int = Query(7, le=90),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=100),
):
    """Paginated event browser."""
    offset = (page - 1) * per_page
    async with _db.pool.connection() as conn:
        where = "WHERE created_at >= CURRENT_DATE - %s * INTERVAL '1 day'"
        params: list = [days]
        if event_type:
            where += " AND event_type = %s"
            params.append(event_type)

        cur = await conn.execute(
            f"SELECT COUNT(*) AS total FROM app_events {where}", params
        )
        total = (cur.fetchone() or {}).get("total", 0)

        cur = await conn.execute(
            f"""SELECT id, event_type, created_at::text, user_id, session_id, properties
                FROM app_events {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s""",
            params + [per_page, offset],
        )
        events = cur.fetchall()

    return {"total": total, "page": page, "per_page": per_page, "events": events}


@router.get("/analytics/errors", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def analytics_errors(
    request: Request,
    category: str | None = None,
    days: int = Query(7, le=90),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, le=100),
):
    """Paginated error browser."""
    offset = (page - 1) * per_page
    async with _db.pool.connection() as conn:
        where = "WHERE created_at >= CURRENT_DATE - %s * INTERVAL '1 day'"
        params: list = [days]
        if category:
            where += " AND category = %s"
            params.append(category)

        cur = await conn.execute(
            f"SELECT COUNT(*) AS total FROM error_log {where}", params
        )
        total = (cur.fetchone() or {}).get("total", 0)

        cur = await conn.execute(
            f"""SELECT id, category, level, message, traceback, path,
                       request_id, user_id, created_at::text, properties
                FROM error_log {where}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s""",
            params + [per_page, offset],
        )
        errors = cur.fetchall()

    return {"total": total, "page": page, "per_page": per_page, "errors": errors}


@router.post("/analytics/errors/{error_id}/resolve", dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
async def resolve_error(request: Request, error_id: int):
    """Mark an error as resolved."""
    async with _db.pool.connection() as conn:
        await conn.execute(
            """UPDATE error_log
               SET properties = properties || jsonb_build_object('resolved_at', now()::text)
               WHERE id = %s""",
            [error_id],
        )
    return {"status": "resolved"}

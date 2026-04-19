'use client';

import { useState } from 'react';
import {
  AlertTriangle, ChevronDown, Droplets, Waves, Mountain, Flame, Skull,
  Shield, Wind, Volume2, Zap, MapPin, Home, Heart, Phone, CheckCircle2,
} from 'lucide-react';
import type { PropertyReport, ReportSnapshot } from '@/lib/types';
import { isInFloodZone, floodLabel } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
  snapshot: ReportSnapshot;
  persona: 'buyer' | 'renter';
}

/* ────────────────────────────────────────────
   Hazard Advice Data — NZ-specific, researched
   ──────────────────────────────────────────── */

interface AdviceSection {
  id: string;
  icon: typeof AlertTriangle;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  intro: string;
  subsections: {
    heading: string;
    items: string[];
  }[];
}

// Region detection helpers
function isWellington(ta: string): boolean {
  return /wellington|lower hutt|upper hutt|porirua|kapiti/i.test(ta);
}
function isChristchurch(ta: string): boolean {
  return /christchurch|selwyn|waimakariri/i.test(ta);
}
function isHawkesBay(ta: string): boolean {
  return /hastings|napier|central hawke/i.test(ta);
}
function isWestCoast(ta: string): boolean {
  return /buller|grey|westland/i.test(ta);
}
function isCoastal(hazards: PropertyReport['hazards']): boolean {
  return !!(hazards.tsunami_zone || hazards.coastal_erosion || hazards.coastal_elevation_cm != null);
}

function buildAdviceSections(report: PropertyReport, ta: string, persona: string): AdviceSection[] {
  const h = report.hazards;
  const env = report.environment;
  const sections: AdviceSection[] = [];

  // ── EARTHQUAKE ──
  if (h.earthquake_count != null || h.active_fault_nearest || h.fault_avoidance_zone || isWellington(ta) || isChristchurch(ta)) {
    const isWgtn = isWellington(ta);
    const isChch = isChristchurch(ta);
    const hasFault = h.fault_distance_m != null && h.fault_distance_m < 10000;

    const subsections: AdviceSection['subsections'] = [
      {
        heading: 'Prepare Your Home Now',
        items: [
          'Strap your hot water cylinder to the wall with two brackets (top and bottom) — this is a legal requirement and one of the most common causes of post-earthquake damage.',
          'Bolt tall furniture (bookshelves, dressers, TVs) to wall studs using L-brackets or anti-tip straps.',
          'Know how to turn off gas, water, and electricity at the mains. Label the shutoffs clearly.',
          'If you have an unreinforced masonry chimney, get it assessed — chimney collapse killed people in the 2011 Christchurch earthquake.',
          'Store sturdy shoes and a torch under your bed. Broken glass will be everywhere after a quake.',
          ...(persona === 'buyer' ? [
            'Commission a specific seismic assessment if the building is pre-1976 (before modern seismic code).',
            'Check the property\'s EQC claim history — you can request this through Toka Tu Ake (formerly EQC).',
          ] : [
            'Ask your landlord about the building\'s seismic strengthening status.',
            'Check if the building has an Earthquake Prone Building (EPB) notice.',
          ]),
        ],
      },
      {
        heading: 'Emergency Kit (7-Day Minimum)',
        items: [
          'Water: 3 litres per person per day for at least 7 days. Store in a cool, dark place.',
          'Non-perishable food and a manual can opener.',
          'First aid kit and at least a 2-week supply of essential medications.',
          'Battery-powered or hand-crank radio (for Civil Defence updates — phone networks will be overwhelmed).',
          'Cash in small notes (EFTPOS terminals will be down for days).',
          'Phone charger / power bank, fully charged.',
          'Toilet paper and large rubbish bags (for emergency sanitation — sewerage will likely be offline).',
          'Copies of insurance policies and ID in a waterproof bag.',
        ],
      },
      {
        heading: 'During an Earthquake — Drop, Cover, Hold',
        items: [
          'DROP to your hands and knees immediately.',
          'COVER your head and neck — get under a sturdy table or desk if one is nearby.',
          'HOLD on to your shelter and be prepared to move with it.',
          'In bed? Stay there. Cover your head with a pillow. Glass will shatter.',
          'Do NOT stand in a doorway (outdated advice), do NOT run outside (falling debris kills).',
          'If near the coast and shaking lasts more than a minute, or you can\'t stand: move immediately to high ground — "long or strong, get gone." A tsunami could arrive in minutes.',
        ],
      },
      {
        heading: 'After the Quake',
        items: [
          'Expect aftershocks — they can be nearly as strong as the main shock.',
          'If you smell gas: turn it off at the mains, open windows, leave, do NOT use electrical switches or flames.',
          'Check for: foundation cracks, chimney damage (inspect from a distance first), diagonal wall cracks near doors/windows, uneven floors.',
          'Do not use the fireplace until the chimney has been professionally inspected.',
          'Check on neighbours, especially elderly and those living alone.',
          'Use your phone only for emergencies — networks will be overloaded.',
          'Flush toilets carefully — damaged sewer lines cause contamination. If in doubt, use an emergency bucket toilet.',
        ],
      },
    ];

    if (isWgtn) {
      subsections.push({
        heading: 'Wellington-Specific: Be Ready for Isolation',
        items: [
          'Wellington could be cut off for weeks after a major earthquake. The Hutt Valley motorway, rail, and port could all be damaged. Prepare for 7+ days of self-sufficiency.',
          'Water supply is especially vulnerable — pipes cross the Wellington Fault. Store extra water beyond the minimum.',
          'Hillside homes: have retaining walls engineer-assessed. Single-access driveways could be blocked — plan alternative routes out.',
          'Low-lying areas (Oriental Bay, Petone, Seatoun, Eastbourne) may face tsunami risk. Know the blue-line evacuation routes from WREMO maps.',
          'Join your local Community Emergency Hub — WREMO runs preparedness programmes in your suburb.',
          'Liquefaction zones: Petone, Kilbirnie, Rongotai, and CentrePort/Thorndon Quay are on soft or reclaimed ground.',
        ],
      });
    }

    if (isChch) {
      subsections.push({
        heading: 'Canterbury Lessons (from 2010/2011)',
        items: [
          'Liquefaction destroyed thousands of homes — not by shaking but by the ground turning to liquid. Sand and silt erupted through floors, driveways, and gardens.',
          'Aftershocks continued for years. The February 2011 aftershock (M6.3) was more destructive than the original September 2010 earthquake (M7.1) because it was shallower.',
          'Check your property\'s TC (Technical Category) zone — TC3 properties required the most extensive foundation remediation.',
          'If buying: look for diagonal wall cracks, doors that stick, uneven floors, repaired foundations, and evidence of re-levelled piles. Use a marble on the floor to test.',
          'Document everything in your home with photos/video NOW. After the Canterbury quakes, many claims took years to settle because of insufficient documentation.',
        ],
      });
    }

    if (persona === 'buyer') {
      subsections.push({
        heading: 'What to Look For When Buying',
        items: [
          'Diagonal cracks in plaster near window and door frames = possible racking damage.',
          'Doors and windows that stick or don\'t close = frame distortion.',
          'Uneven floors — test with a marble or ball.',
          'Fresh paint or plaster in specific spots = possible covered-up earthquake damage.',
          'Gaps between walls and ceiling or floor.',
          'Evidence of re-laid foundations or re-levelled piles.',
          'Ground cracks, repaired driveway sections, or sand/silt residue (past liquefaction).',
          'Check the council LIM for earthquake-prone building notices and hazard overlays.',
        ],
      });
    }

    sections.push({
      id: 'earthquake',
      icon: Zap,
      title: 'Earthquake Preparedness',
      severity: hasFault || isWgtn ? 'critical' : 'warning',
      intro: isWgtn
        ? 'Wellington sits on multiple active fault lines. The Wellington Fault has a ~7-8% probability of a M7.5+ rupture in the next 50 years. Being prepared isn\'t optional here.'
        : isChch
          ? 'Canterbury has experienced devastating earthquakes. While the major sequence is over, the area remains seismically active and new faults can be discovered.'
          : `This property has ${h.earthquake_count ?? 0} recorded earthquakes (M3+) within 30km in the past 10 years${h.earthquake_max_mag ? `, largest M${h.earthquake_max_mag.toFixed(1)}` : ''}. New Zealand sits on the Pacific Ring of Fire — earthquakes can happen anywhere.`,
      subsections,
    });
  }

  // ── GROUND SHAKING AMPLIFICATION ──
  if (h.ground_shaking_severity || h.ground_shaking_zone) {
    const gsHigh = h.ground_shaking_severity?.toLowerCase().includes('high');
    sections.push({
      id: 'ground-shaking',
      icon: Zap,
      title: 'Ground Shaking Amplification',
      severity: gsHigh ? 'warning' : 'info',
      intro: `This property is in a ${h.ground_shaking_severity || h.ground_shaking_zone || 'mapped'} ground shaking zone. The underlying soil conditions amplify earthquake shaking compared to bedrock areas — the same earthquake feels significantly stronger here.`,
      subsections: [
        {
          heading: 'Why This Matters',
          items: [
            'Ground shaking amplification means the same earthquake causes more damage in this location than on bedrock.',
            'Soft soils (reclaimed land, river sediments, peat) amplify shaking by 2-5x compared to rock.',
            h.gwrc_liquefaction_geology
              ? `This area is built on ${h.gwrc_liquefaction_geology.toLowerCase()}, which is particularly prone to amplification.`
              : 'The soil type beneath your property determines how much shaking is amplified.',
            'The 2016 Kaikoura earthquake caused far more damage to Wellington CBD buildings on reclaimed land than those on nearby rock.',
          ],
        },
        {
          heading: 'What to Check',
          items: [
            ...(persona === 'buyer' ? [
              'Ask about the building\'s seismic rating (%NBS). Buildings below 34%NBS are legally earthquake-prone.',
              'Older buildings (pre-1976) on amplified-shaking sites are highest risk. Check for seismic strengthening work.',
              'Foundation type matters more here — deep piles through soft soil to bedrock are ideal.',
            ] : [
              'Ask your landlord about the building\'s earthquake rating.',
              'Ground-floor apartments on soft soils may experience more shaking than upper floors.',
              'Secure heavy furniture and water heaters to walls.',
            ]),
          ],
        },
      ],
    });
  }

  // ── TSUNAMI ──
  if (h.tsunami_zone) {
    sections.push({
      id: 'tsunami',
      icon: Waves,
      title: 'Tsunami Zone Safety',
      severity: 'critical',
      intro: `This property is in a tsunami zone (${h.tsunami_zone}). NZ faces both local-source tsunamis (minutes warning) and distant-source tsunamis (hours warning).`,
      subsections: [
        {
          heading: 'The Core Rule: Long or Strong, Get Gone',
          items: [
            'If you feel an earthquake that lasts more than a minute, or is so strong you can\'t stand — move immediately to high ground or as far inland as possible.',
            'Do NOT wait for an official warning. A local-source tsunami (e.g., from the Hikurangi subduction zone) can arrive in MINUTES.',
            'For distant-source tsunamis (South America, Alaska), you will get hours of warning through the official system.',
          ],
        },
        {
          heading: 'Natural Warning Signs',
          items: [
            'A strong or prolonged earthquake felt near the coast.',
            'The sea suddenly recedes unusually far from the shore, exposing the sea floor.',
            'A loud roaring sound from the ocean.',
            'Unusual rapid rise or fall in water level.',
          ],
        },
        {
          heading: 'Know Your Evacuation Route NOW',
          items: [
            'Check your council\'s tsunami evacuation zone map (look for blue-line signs in your neighbourhood).',
            'Walk your evacuation route to high ground. Time it. You may not be able to drive — roads will be gridlocked.',
            'Aim for at least 30m above sea level or 1km+ inland (follow local signage — it\'s specific to your area).',
            'Keep a grab bag near the door: documents, medications, phone charger, water, warm clothes.',
            'If you absolutely cannot reach high ground: go to the highest floor of the strongest reinforced concrete building nearby (3+ stories). This is a last resort called "vertical evacuation."',
          ],
        },
        {
          heading: 'During a Tsunami',
          items: [
            'Tsunami come as a series of waves. The first wave is often NOT the largest.',
            'Do not return to low ground after the first wave passes.',
            'Stay away from river mouths and estuaries — tsunami energy funnels up these.',
            'Stay away from the coast for at least 24 hours or until the official all-clear from NEMA/Civil Defence.',
          ],
        },
        ...(isWellington(ta) ? [{
          heading: 'Wellington Tsunami Zones',
          items: [
            'High-risk areas: Oriental Bay, Evans Bay, Petone waterfront, Eastbourne, Seatoun, Lyall Bay.',
            'The Hikurangi subduction zone (off the east coast of the North Island) is the most likely local-source tsunami trigger.',
            'WREMO has detailed evacuation maps for every coastal suburb — download and print yours.',
          ],
        }] : []),
      ],
    });
  }

  // ── FLOODING ──
  if (isInFloodZone(h) || h.on_overland_flow_path || h.overland_flow_within_50m) {
    const isHB = isHawkesBay(ta);
    const isWC = isWestCoast(ta);

    sections.push({
      id: 'flooding',
      icon: Droplets,
      title: 'Flood Risk — What To Do',
      severity: 'critical',
      intro: isInFloodZone(h)
        ? `This property is in a mapped flood zone (${floodLabel(h)}). ${isHB ? 'Hawke\'s Bay was devastated by Cyclone Gabrielle in 2023 — take this seriously.' : isWC ? 'Westport has flooded repeatedly in recent years.' : 'Flood events are becoming more frequent due to climate change.'}`
        : 'This property is near an overland flow path, which means stormwater can flow across the property during heavy rain events.',
      subsections: [
        {
          heading: 'Protect Your Property Now',
          items: [
            'Check your floor level relative to known flood levels — council LIMs often include this. If your floor is below the 1% AEP (1-in-100-year) flood level, you are at significant risk.',
            'Clear gutters, downpipes, and stormwater drains regularly, especially in autumn.',
            'Install non-return valves on drainage pipes to prevent sewage backflow during floods.',
            'If you have a sump pump, ensure it has a battery backup (mains power fails during floods).',
            'Store important documents above flood level or in waterproof containers.',
            'Know where your local sandbag collection point is — councils distribute free sandbags before forecast events.',
            ...(persona === 'buyer' ? [
              'Before buying: get insurance quotes FIRST. Some flood-prone properties face $10,000-$20,000+ excess or flood exclusions entirely.',
              'Ask the selling agent directly: has this property ever flooded? When? How deep?',
            ] : []),
          ],
        },
        {
          heading: 'During a Flood',
          items: [
            'NEVER walk, swim, or drive through floodwater. 15cm of moving water can knock you off your feet. 60cm can float a car. "Turn around, don\'t drown."',
            'If told to evacuate, do so immediately. Don\'t wait for conditions to worsen.',
            'Turn off electricity at the mains if water is entering your home (only if safe to reach).',
            'Stay away from streams, rivers, and drains — they can flash-flood with no warning.',
            'Floodwater is contaminated with sewage, chemicals, and debris. Avoid all contact.',
            'If trapped: go to the highest floor. Do NOT enter the roof space unless you can break out (people have drowned trapped in attics).',
          ],
        },
        {
          heading: 'After a Flood',
          items: [
            'Photograph ALL damage before cleanup — your insurer needs this.',
            'Everything touched by floodwater is contaminated. Wear gloves, gumboots, mask.',
            'Remove mud and silt as soon as possible — it sets hard and breeds mould within 24-48 hours.',
            'Remove wet carpet, underlay, and soft furnishings immediately.',
            'Cut out wet wall linings (GIB) to at least 500mm above the waterline to allow framing to dry.',
            'Use dehumidifiers and fans. Mould is a serious long-term health risk.',
            'Discard ALL food that has been in contact with floodwater.',
            'Boil or bottle water until supply is confirmed safe.',
          ],
        },
        {
          heading: 'Insurance Reality',
          items: [
            'Building flood damage is covered by your PRIVATE insurer (not EQC). Check your policy NOW.',
            'Ask your insurer specifically: "Is flood covered? What is the flood excess?"',
            'After Cyclone Gabrielle and the 2023 Auckland floods, insurers tightened flood cover significantly. Some properties have had policies cancelled.',
            'Keep receipts for all emergency repairs and temporary accommodation.',
            'EQC covers flood damage to LAND only (up to $300K + GST), not building damage.',
          ],
        },
        ...(isHB ? [{
          heading: 'Hawke\'s Bay: Lessons from Cyclone Gabrielle',
          items: [
            '11 deaths, 9,000+ properties flooded. Silt damage was catastrophic — some houses had 1m+ of silt inside.',
            'People underestimated how fast rivers could rise. Evacuation warnings came too late for some.',
            'Rural communities were isolated for weeks. Have supplies for extended isolation.',
            'Government offered voluntary buy-outs for the most at-risk (Category 3) properties.',
          ],
        }] : []),
      ],
    });
  }

  // ── LIQUEFACTION ──
  if (h.liquefaction_zone && /moderate|high|significant|possible|susceptible/i.test(String(h.liquefaction_zone))) {
    sections.push({
      id: 'liquefaction',
      icon: Mountain,
      title: 'Liquefaction Risk',
      severity: 'warning',
      intro: `This property is in a ${h.liquefaction_zone} liquefaction zone. During strong shaking, the ground can behave like liquid — sand and water erupt through the surface, buildings sink and tilt.`,
      subsections: [
        {
          heading: 'What Liquefaction Means for This Property',
          items: [
            'During a strong earthquake, saturated sandy soils lose strength and behave like liquid. Buildings can sink, tilt, or be damaged by lateral spreading.',
            'Liquefaction destroyed thousands of Christchurch homes in 2010/2011 — not by shaking, but by the ground failing beneath them.',
            'Lateral spreading (ground moving sideways toward rivers or waterways) can crack and shift foundations even hundreds of metres from the waterway.',
          ],
        },
        {
          heading: persona === 'buyer' ? 'Before You Buy' : 'What to Check',
          items: [
            ...(persona === 'buyer' ? [
              'Commission a geotechnical report ($2,000-$8,000+). Insist on bore logs, not just a visual inspection.',
              'Check the foundation type: deep piles are better than shallow slab foundations on liquefiable ground.',
              'Look for: uneven floors, cracked driveways, repaired concrete, sand/silt residue in gardens.',
              'Ask about the property\'s TC (Technical Category) zone if in Canterbury.',
              'Budget for potential foundation strengthening — ground improvement can cost $20,000-$100,000+.',
            ] : [
              'Ask your landlord about the building\'s foundation type and whether it has been assessed for liquefaction.',
              'Know that ground-floor units in multi-storey buildings on liquefiable ground may be more affected.',
              'Check your contents insurance covers natural disaster damage.',
            ]),
          ],
        },
        {
          heading: 'Signs of Past Liquefaction',
          items: [
            'Sand or silt deposits in garden beds or around foundations.',
            'Uneven or sunken areas in driveways, paths, or lawns.',
            'Cracked or re-laid concrete slabs.',
            'Evidence of re-levelled piles or foundation repairs.',
            'Tilting fences or retaining walls.',
          ],
        },
      ],
    });
  }

  // ── LANDSLIDE / SLOPE FAILURE ──
  if (h.slope_failure || h.landslide_count_500m || h.landslide_in_area || h.landslide_nearest) {
    sections.push({
      id: 'landslide',
      icon: Mountain,
      title: 'Landslide & Slope Stability',
      severity: 'warning',
      intro: h.landslide_nearest
        ? `There are ${h.landslide_count_500m ?? 'multiple'} recorded landslide events within 500m of this property. The nearest was ${Math.round(h.landslide_nearest.distance_m)}m away${h.landslide_nearest.trigger ? ` (triggered by ${h.landslide_nearest.trigger.toLowerCase()})` : ''}${h.landslide_nearest.damage ? ` — damage: ${h.landslide_nearest.damage}` : ''}${h.landslide_nearest.movement_type ? `. Movement type: ${h.landslide_nearest.movement_type}` : ''}.`
        : 'This property is in an area with slope instability risk. Landslides are NZ\'s most widespread natural hazard.',
      subsections: [
        {
          heading: 'Warning Signs to Watch For',
          items: [
            'New cracks in the ground, driveways, paths, or retaining walls — especially if widening over time.',
            'Springs or seepage appearing where there were none before. Pooling water on slopes.',
            'Doors and windows sticking or jamming. New cracks in interior walls.',
            'Trees leaning downhill (especially if previously upright). Curved tree trunks ("pistol-butted") indicate historical creep.',
            'Rumbling sounds from hillsides. Ground that feels soft or "spongy" after rain.',
            'Bulging ground at the base of a slope.',
          ],
        },
        {
          heading: 'During a Landslip',
          items: [
            'Evacuate immediately if you hear rumbling, see cracks widening, or notice rapid water changes. Do NOT wait for official warnings.',
            'Move PERPENDICULAR to the slide path — never downhill and never along the slide direction.',
            'If indoors and cannot evacuate: move to an upper floor, to the UPHILL side of the building, away from windows.',
            'After the event: stay away — secondary slides are common, especially after rain. Do not re-enter damaged buildings until professionally assessed.',
          ],
        },
        {
          heading: 'Protecting Your Property',
          items: [
            'Drainage is the #1 factor. Maintain gutters, downpipes, stormwater drains, and subsoil drainage. A blocked drain can trigger a slope failure.',
            'Maintain tree cover on slopes — roots significantly improve stability. Native species (kanuka, manuka, cabbage tree) are excellent for slope stabilisation.',
            'Do NOT remove large trees on slopes without geotechnical advice.',
            'Inspect retaining walls annually and after heavy rain or earthquakes.',
            'Monitor cracks: install simple glass tell-tales or photograph reference points seasonally.',
          ],
        },
        ...(persona === 'buyer' ? [{
          heading: 'Before You Buy on a Slope',
          items: [
            'Always get a geotechnical report ($2,000-$8,000+). Insist on bore logs.',
            'Check the LIM for slope instability or mass movement notations.',
            'Check council hazard maps for landslide susceptibility zones.',
            'Inspect ALL retaining walls — unconsented walls without engineering are very common in NZ.',
            'NZ Building Code requires consent for retaining walls over 1.5m. Many older walls lack proper design.',
            'A $5,000 drainage repair NOW can prevent a $100,000+ wall rebuild later.',
          ],
        }] : []),
      ],
    });
  }

  // ── COASTAL EROSION ──
  if (h.coastal_erosion || h.council_coastal_erosion) {
    sections.push({
      id: 'coastal-erosion',
      icon: Waves,
      title: 'Coastal Erosion & Sea-Level Rise',
      severity: 'warning',
      intro: `This property is in a coastal erosion zone${h.council_coastal_erosion?.scenario ? ` (${h.council_coastal_erosion.scenario} scenario)` : ''}. Sea levels are projected to rise 0.3m-1.0m+ by 2100. Erosion rates are accelerating.`,
      subsections: [
        {
          heading: 'What This Means',
          items: [
            'NZ Ministry for the Environment recommends planning for at least 1.0m of sea-level rise by 2100.',
            'A current 1-in-100-year coastal flood event becomes a near-annual event with relatively modest sea-level rise.',
            'Some councils are adopting "managed retreat" — they will not defend the coastline forever.',
            'Hard protection (seawalls) may not be permitted and can transfer erosion to neighbouring properties.',
          ],
        },
        {
          heading: 'Property Implications',
          items: [
            'Property values in identified coastal hazard zones can be significantly affected long-term.',
            'Building consents may be refused or have conditions (e.g., relocatable buildings, limited lifespan consents).',
            'Insurers are increasingly excluding or restricting cover for properties in known erosion zones.',
            ...(persona === 'buyer' ? [
              'Check the LIM for coastal hazard overlays and managed retreat classifications.',
              'Look for: exposed foundations, tilting seawalls, eroding cliffs, previous protection works.',
              'Check if future building work will be restricted.',
            ] : []),
          ],
        },
      ],
    });
  }

  // ── COASTAL INUNDATION / STORM SURGE ──
  if (h.coastal_inundation_ranking || h.coastal_elevation_cm != null) {
    const lowElevation = h.coastal_elevation_cm != null && h.coastal_elevation_cm < 300;
    sections.push({
      id: 'coastal-inundation',
      icon: Waves,
      title: 'Coastal Inundation & Storm Surge',
      severity: lowElevation ? 'critical' : 'warning',
      intro: h.coastal_elevation_cm != null
        ? `This property is ${(h.coastal_elevation_cm / 100).toFixed(1)}m above mean high water springs. ${lowElevation ? 'This is very low — storm surge and sea-level rise are direct threats.' : 'Coastal flooding may affect this area during extreme events.'}`
        : `This property is in a mapped coastal inundation zone${h.coastal_inundation_scenario ? ` (${h.coastal_inundation_scenario})` : ''}. Storm surge combined with sea-level rise can cause widespread flooding of low-lying coastal areas.`,
      subsections: [
        {
          heading: 'Understanding Coastal Inundation',
          items: [
            'Coastal inundation is different from river flooding — it\'s driven by storm surge (low atmospheric pressure + wind) combined with high tides.',
            'A 1-in-100-year storm tide event with 1m of sea-level rise could affect areas currently well above normal high tide.',
            'Climate change is increasing both the frequency and severity of coastal inundation events.',
            'King tides + storm surge + sea-level rise = significantly higher flood levels than historical records suggest.',
          ],
        },
        {
          heading: 'Protecting Your Property',
          items: [
            'Know your elevation above mean high water springs (MHWS). Below 2m is high risk with projected sea-level rise.',
            'Non-return valves on stormwater drains prevent saltwater backflow during surge events.',
            'Saltwater flooding is more damaging than freshwater — it corrodes steel, kills plants, and contaminates soil.',
            'Check if your insurance covers storm surge and coastal flooding specifically (many policies exclude it).',
            ...(persona === 'buyer' ? [
              'Check the LIM for coastal hazard overlays and any building consent conditions related to sea-level rise.',
              'Consider the 50-year outlook: properties low-lying near the coast may face significantly reduced insurability.',
            ] : []),
          ],
        },
      ],
    });
  }

  // ── WILDFIRE ──
  if (h.wildfire_risk && !/none|nil|very low/i.test(h.wildfire_risk)) {
    sections.push({
      id: 'wildfire',
      icon: Flame,
      title: 'Wildfire Risk',
      severity: 'warning',
      intro: `This area has ${h.wildfire_risk.toLowerCase()} wildfire risk. NZ averages ~4,000 wildfires per year. The 2019 Nelson fire burned 2,400 hectares; the 2017 Port Hills fire destroyed 9 homes.`,
      subsections: [
        {
          heading: 'Create Defensible Space',
          items: [
            '0-10m from house: keep vegetation low and green. Remove dead vegetation, leaf litter, and firewood. Use non-combustible landscaping.',
            '10-30m: reduce fuel load. Space trees so canopies don\'t touch. Remove "ladder fuels" that let fire climb from ground to canopy.',
            '30-100m: manage fuel loads. Create fuel breaks along driveways.',
            'Keep gutters clear of leaf debris — embers land in gutters and ignite.',
            'Ensure your driveway is at least 4m wide with turning space for fire trucks.',
          ],
        },
        {
          heading: 'Fire Season Preparation',
          items: [
            'Monitor FENZ fire danger forecasts. Know your fire season status (open/restricted/prohibited).',
            'Maintain a dedicated water supply (minimum 20,000L recommended for rural properties).',
            'Keep a grab bag ready: documents, medications, phone charger, water.',
            'Have at least two escape routes planned. Know alternatives if main roads are blocked.',
            'If you see flames or heavy smoke approaching, leave early. Do NOT wait for an official order.',
          ],
        },
        {
          heading: 'If Trapped',
          items: [
            'Go to a large cleared area (sports field, car park, beach).',
            'In a car: park away from vegetation, engine off, windows up, lie on the floor.',
            'In a building: close all doors/windows, move to the room furthest from the fire, fill sinks and baths with water.',
          ],
        },
      ],
    });
  }

  // ── CONTAMINATED LAND ──
  if (h.contamination_count && h.contamination_count > 0) {
    sections.push({
      id: 'contamination',
      icon: Skull,
      title: 'Contaminated Land Nearby',
      severity: 'warning',
      intro: `There are ${h.contamination_count} contaminated (HAIL) sites near this property. HAIL = Hazardous Activities and Industries List, maintained by the Ministry for the Environment.`,
      subsections: [
        {
          heading: 'What HAIL Sites Mean',
          items: [
            'HAIL lists 53 activity categories that could cause contamination: petrol stations, timber treatment, sheep dips, orchards, dry cleaners, landfills, and more.',
            'Common contaminants: heavy metals (lead, arsenic from old paint/orchards), hydrocarbons (petrol/diesel), pesticides (DDT, PCP from historic agriculture).',
            'Health effects can include neurological damage (especially in children), cancer risk, and endocrine disruption.',
          ],
        },
        {
          heading: 'Practical Health Measures',
          items: [
            'Do not let children play in bare soil near suspected HAIL sites.',
            'Do not grow vegetables in potentially contaminated soil — use raised beds with imported clean soil.',
            'Wash hands thoroughly after gardening.',
            'If your property IS on the HAIL list, you may need a Preliminary Site Investigation (PSI, $2,000-$5,000) before any earthworks or land use changes.',
          ],
        },
        ...(persona === 'buyer' ? [{
          heading: 'Before You Buy',
          items: [
            'Check your regional council\'s Listed Land Use Register (LLUR/SLUS) for this specific property.',
            'Check historical aerial photos (retrolens.nz) for past land uses — former orchards and farms often have pesticide residues.',
            'If a HAIL activity is identified, budget for investigation ($2,000-$25,000+) and potential remediation.',
            'Under the NES-CS 2011, changing land use or doing earthworks on a HAIL site triggers mandatory investigation.',
          ],
        }] : []),
      ],
    });
  }

  // ── FAULT AVOIDANCE ZONE ──
  if (h.fault_avoidance_zone) {
    const fazType = typeof h.fault_avoidance_zone === 'string'
      ? h.fault_avoidance_zone
      : h.fault_avoidance_zone?.zone_type ?? h.fault_avoidance_zone?.fault_name ?? 'Active Fault';
    sections.push({
      id: 'fault-zone',
      icon: Shield,
      title: `Fault Avoidance Zone: ${fazType}`,
      severity: 'critical',
      intro: `This property is within a Fault Avoidance Zone (${fazType}). Building restrictions may apply.`,
      subsections: [
        {
          heading: 'What This Means',
          items: [
            'Fault Avoidance Zones are defined either side of known active fault traces. Width varies by fault complexity.',
            'Building new structures or significant extensions may be prohibited or require resource consent.',
            'For Class I faults (recurrence <2,000 years), residential buildings are typically a "non-complying activity."',
            'Fault location studies ($10,000-$50,000+ for trenching) may be required to determine the exact fault trace.',
          ],
        },
        ...(persona === 'buyer' ? [{
          heading: 'Critical for Buyers',
          items: [
            'Check council planning maps for the exact Fault Avoidance Zone boundaries before purchasing.',
            'Understand that future building, renovating, or even significant landscaping may be restricted.',
            'Get legal advice on what the FAZ classification means for property value and development potential.',
            'Insurance may be available but at a higher premium — get quotes before going unconditional.',
          ],
        }] : []),
      ],
    });
  }

  // ── ACTIVE FAULT NEARBY ──
  if (h.active_fault_nearest && !h.fault_avoidance_zone) {
    const af = h.active_fault_nearest;
    sections.push({
      id: 'active-fault',
      icon: Zap,
      title: `Active Fault: ${af.name} (${af.distance_m < 1000 ? `${af.distance_m} m` : `${(af.distance_m / 1000).toFixed(1)} km`} away)`,
      severity: af.distance_m < 2000 ? 'warning' : 'info',
      intro: `The ${af.name} is ${af.distance_m < 1000 ? `${af.distance_m} m` : `${(af.distance_m / 1000).toFixed(1)} km`} from this property${af.slip_rate_mm_yr ? ` with a slip rate of ${af.slip_rate_mm_yr} mm/yr` : ''}.`,
      subsections: [{
        heading: 'Understanding Active Faults',
        items: [
          `Fault type: ${af.fault_type || 'not classified'}. Proximity to an active fault increases earthquake shaking intensity.`,
          'GNS Science maps active faults across NZ — proximity affects insurance premiums and building code requirements.',
          ...(persona === 'buyer' ? [
            'Request a seismic hazard assessment if the property is within 2km of an active fault.',
            'Check if the property falls within any council Fault Awareness or Fault Avoidance overlay.',
          ] : []),
        ],
      }],
    });
  }

  // ── AIRCRAFT NOISE ──
  if (h.aircraft_noise_name) {
    const isHigh = (h.aircraft_noise_dba ?? 0) >= 65;
    sections.push({
      id: 'aircraft-noise',
      icon: Volume2,
      title: `Aircraft Noise Zone: ${h.aircraft_noise_name}${h.aircraft_noise_dba ? ` (${h.aircraft_noise_dba} dBA)` : ''}`,
      severity: isHigh ? 'warning' : 'info',
      intro: `This property is within an aircraft noise overlay${h.aircraft_noise_category ? ` (${h.aircraft_noise_category})` : ''}.`,
      subsections: [{
        heading: 'What This Means',
        items: [
          'District Plan rules may require acoustic insulation for new buildings or additions.',
          'Sound insulation costs $5,000-$30,000+ depending on building size and existing construction.',
          ...(isHigh ? [
            'At 65+ dBA, some councils prohibit new noise-sensitive activities (e.g., residential, schools).',
            'Existing buildings may be eligible for airport company noise insulation programmes.',
          ] : [
            'Below 65 dBA, residential use is typically permitted but insulation standards still apply.',
          ]),
          ...(persona === 'buyer' ? [
            'Check the District Plan noise overlay maps for exact boundaries and rules.',
            'Factor in acoustic insulation costs for any renovation or building consent work.',
          ] : [
            'If noise is bothersome, ask your landlord about acoustic insulation options.',
          ]),
        ],
      }],
    });
  }

  // ── EROSION PRONE LAND ──
  if (h.on_erosion_prone_land) {
    sections.push({
      id: 'erosion-prone',
      icon: Mountain,
      title: 'Erosion Prone Land',
      severity: 'warning',
      intro: 'This property is mapped as erosion prone land by the regional council.',
      subsections: [{
        heading: 'What This Means',
        items: [
          'Erosion prone land may be subject to soil loss, slipping, or land instability.',
          'Resource consent may be required for earthworks, vegetation removal, or new construction.',
          'Regional council rules may restrict activities that could worsen erosion.',
          ...(persona === 'buyer' ? [
            'Commission a geotechnical assessment before purchasing — slope stability is critical.',
            'Retaining walls, drainage, and vegetation management can add ongoing costs.',
          ] : [
            'Report any signs of ground movement (cracks in walls/driveways, leaning fences) to your landlord.',
          ]),
        ],
      }],
    });
  }

  // ── WIND ZONES ──
  if (env.wind_zone && /high|very high|extra high/i.test(env.wind_zone)) {
    sections.push({
      id: 'wind',
      icon: Wind,
      title: `Wind Zone: ${env.wind_zone}`,
      severity: 'info',
      intro: isWellington(ta)
        ? 'Wellington is one of the windiest cities in the world. Many suburbs are classified High, Very High, or Extra High.'
        : `This property is in a ${env.wind_zone} wind zone, meaning buildings must be designed for stronger wind loads.`,
      subsections: [
        {
          heading: 'What This Means for Your Property',
          items: [
            'Cladding, roofing, and windows must meet higher specifications for wind resistance.',
            'Roof fixings need closer spacing and stronger fasteners. Some lightweight claddings can\'t be used.',
            'Solid fences can become projectiles — consider permeable fencing (louvred, pool-style) in exposed locations.',
            'Higher wind zones need more structural bracing, which can affect floor plan flexibility for renovations.',
            ...(persona === 'buyer' ? [
              'When renovating, any structural changes must meet current wind zone requirements — this can add significant cost.',
              'Check that the existing building was actually built to the correct wind zone specification.',
            ] : [
              'Report any loose roofing, cladding, or fencing to your landlord — in high winds these become dangerous.',
              'Secure outdoor furniture, trampolines, and bins. These cause significant damage in NZ storms.',
            ]),
          ],
        },
      ],
    });
  }

  // ── ROAD NOISE ──
  if (env.noise_db && env.noise_db >= 55) {
    const isHigh = env.noise_db >= 65;
    sections.push({
      id: 'road-noise',
      icon: Volume2,
      title: `Road Noise: ${Math.round(env.noise_db)} dB`,
      severity: isHigh ? 'warning' : 'info',
      intro: `Road noise at this property is ${Math.round(env.noise_db)} dB LAeq(24h). ${isHigh ? 'This exceeds the WHO guideline of 53 dB for residential areas.' : 'This is above the 55 dB threshold where health effects begin to be measurable.'}`,
      subsections: [
        {
          heading: 'Health Effects of Road Noise',
          items: [
            'Sleep disruption begins above 40 dB at night (WHO). Poor sleep increases cardiovascular risk, impairs immunity, and affects mental health.',
            'Long-term exposure above 53 dB increases risk of hypertension, heart disease, and stroke by 5-15%.',
            'Children\'s cognitive performance (reading, memory) is impaired by chronic noise exposure.',
            'Constant background noise causes listening fatigue and increased stress hormones.',
          ],
        },
        {
          heading: 'Mitigation — What Actually Works',
          items: [
            'Double or triple glazing reduces noise by 25-35 dB (vs ~15 dB for single glazing). Laminated glass with PVB interlayer is especially effective.',
            'Window frame seals matter as much as the glass — check for airtight aluminium frames.',
            'Acoustic fencing (solid, no gaps, minimum 1.8m) reduces noise by 5-10 dB. Purpose-built acoustic panels achieve 10-15 dB reduction. Even small gaps dramatically reduce effectiveness.',
            'Insulate walls facing the road (R2.6 minimum, ideally R4.0+). Use resilient channels to decouple wall linings.',
            'Locate bedrooms on the QUIET side of the house. Use garages, laundries, and bathrooms as noise buffers.',
            'Mechanical ventilation (ducted HRV/ERV) lets you keep windows closed without sacrificing air quality.',
            'Dense planting provides psychological benefit but only ~1 dB per 10m of dense bush.',
          ],
        },
      ],
    });
  }

  // ── EPB (EARTHQUAKE PRONE BUILDING) ──
  if (h.epb_count && h.epb_count > 0) {
    sections.push({
      id: 'epb',
      icon: AlertTriangle,
      title: 'Earthquake-Prone Buildings Nearby',
      severity: h.epb_rating ? 'critical' : 'warning',
      intro: h.epb_rating
        ? 'This property is listed on the MBIE Earthquake-Prone Buildings register. There is a legal deadline for remediation or demolition.'
        : `There are ${h.epb_count} earthquake-prone buildings within 300m. In a major earthquake, these buildings pose a risk from falling masonry and structural collapse.`,
      subsections: [
        {
          heading: 'What EPBs Mean',
          items: [
            'A building is "earthquake prone" if it is below 34% of the New Building Standard (NBS) — meaning it\'s less than a third as strong as a new building.',
            'Unreinforced masonry (URM) buildings are the highest risk. Falling facades and parapets were a leading cause of death in Christchurch.',
            'The CTV building collapse in Christchurch killed 115 people. Multi-storey concrete buildings should have their NBS percentage checked.',
            ...(h.epb_deadline ? [`Deadline for this property: ${h.epb_deadline}. The owner must either strengthen or demolish the building by this date.`] : []),
            'You can search the MBIE EPB register online at building.govt.nz to check any building in NZ.',
          ],
        },
        {
          heading: 'Practical Safety',
          items: [
            'When walking near URM buildings during or after an earthquake, stay in the middle of the street away from facades.',
            'Identify the URM buildings on your daily route (brick buildings with no visible reinforcement).',
            ...(persona === 'buyer' ? [
              'If the property itself is EPB-listed: seismic strengthening can cost $200-$2,000+ per m². Get engineering estimates before buying.',
              'Check if the building has been strengthened to at least 67% NBS (the threshold for "not earthquake prone").',
            ] : [
              'Ask your landlord about the building\'s NBS rating. You have a right to know.',
              'If the building is earthquake prone, understand that your landlord has a legal obligation to remediate within the deadline.',
            ]),
          ],
        },
      ],
    });
  }

  // ── GENERAL EMERGENCY PREPAREDNESS (always show) ──
  sections.push({
    id: 'emergency-general',
    icon: Heart,
    title: 'Emergency Preparedness Essentials',
    severity: 'info',
    intro: 'Every NZ household should be prepared for emergencies — regardless of specific hazards. Here\'s what the experts recommend.',
    subsections: [
      {
        heading: 'Household Emergency Plan',
        items: [
          'Agree on a meeting point with your household if you\'re separated.',
          'Know how to turn off gas, water, and electricity at the mains.',
          'Keep a torch and sturdy shoes beside your bed.',
          'Register for local council emergency alerts (most councils have text/email systems).',
          'Download the Red Cross Hazards app for NZ-specific alerts.',
        ],
      },
      {
        heading: 'Insurance Checklist',
        items: [
          'Take dated photos/video of every room, including inside cupboards and wardrobes. Store in the cloud (Google Photos, iCloud, Dropbox).',
          'Toka Tu Ake (formerly EQC) automatically covers the first $300,000+GST of dwelling damage from natural disasters when you have fire insurance.',
          'Contents cover from Toka Tu Ake is up to $20,000+GST per claim.',
          'Most NZ home policies are "sum insured" — ensure your sum is accurate and updated for construction cost inflation.',
          'If renting: get contents insurance. Your landlord\'s policy does NOT cover your belongings.',
        ],
      },
      {
        heading: 'Key NZ Resources',
        items: [
          'getready.govt.nz — national emergency preparedness (NEMA)',
          'geonet.org.nz — real-time earthquake monitoring',
          'metservice.com — severe weather warnings',
          'building.govt.nz/epb — search earthquake-prone buildings',
          'Your regional council website — property-specific hazard maps',
          'In an emergency: call 111',
        ],
      },
    ],
  });

  return sections;
}

/* ────────────────────────────────────────────
   Component
   ──────────────────────────────────────────── */

export function HostedHazardAdvice({ report, snapshot, persona }: Props) {
  const ta = snapshot.meta.ta_name;
  const sections = buildAdviceSections(report, ta, persona);

  // Filter: only show sections with actual hazards present (always show the general one)
  // Keep all — the buildAdviceSections function already only adds sections for detected hazards

  if (sections.length <= 1) return null; // Only the general section, no specific hazards

  const criticalCount = sections.filter(s => s.severity === 'critical').length;
  const warningCount = sections.filter(s => s.severity === 'warning').length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Shield className="h-5 w-5 text-piq-primary" />
          <h3 className="text-lg font-bold">Safety & Hazard Guide</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Actionable advice specific to this property&apos;s detected hazards. Based on NZ Civil Defence, GNS Science, NEMA, and post-disaster research.
        </p>
        <div className="flex gap-2 mt-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {criticalCount} Critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {warningCount} Watch
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {sections.length} Topics
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-3">
        {sections.map((section) => (
          <HazardAdviceCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

const SEVERITY_STYLES = {
  critical: { border: 'border-l-red-500', bg: 'bg-red-50/50 dark:bg-red-950/10', text: 'text-red-600 dark:text-red-400', label: 'Critical' },
  warning: { border: 'border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-950/10', text: 'text-amber-600 dark:text-amber-400', label: 'Watch' },
  info: { border: 'border-l-blue-400', bg: 'bg-blue-50/30 dark:bg-blue-950/10', text: 'text-blue-600 dark:text-blue-400', label: 'Info' },
};

function HazardAdviceCard({ section }: { section: AdviceSection }) {
  const [open, setOpen] = useState(section.severity === 'critical');
  const style = SEVERITY_STYLES[section.severity];
  const Icon = section.icon;

  return (
    <div className={`rounded-lg border-l-4 ${style.border} border border-border/50 overflow-hidden ${style.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <Icon className={`h-5 w-5 ${style.text} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${style.text}`}>
              {style.label}
            </span>
            <span className="text-sm font-semibold">{section.title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{section.intro}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {section.subsections.map((sub, i) => (
            <div key={i}>
              <h5 className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                {sub.heading}
              </h5>
              <ul className="space-y-1.5">
                {sub.items.map((item, j) => (
                  <li key={j} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/30" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"""Coastal exposure timeline.

Builds the CoastalExposure payload consumed by HostedCoastalTimeline.tsx.
See docs/SYSTEM-FLOWS.md section "Coastal timeline" for the tier rules.

MVP data strategy: per-point NZ SeaRise + LINZ coastline + NIWA storm-tide
polygons are not yet loaded. Until then we fall back to:
  * terrain.elevation_m  (national SRTM, already loaded)
  * existing coastal flags in hazards.* (coastal_elevation_cm,
    coastal_erosion*, coastal_inundation_ranking, tsunami_zone_class)
  * NZ SeaRise national-average SLR projections for the 3 scenarios

When the per-point loaders land, swap NATIONAL_SLR for a lookup against
searise_points and add coast_distance_m + storm_tide_100yr_distance_m.
The frontend contract does not change.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# NZ SeaRise + IPCC AR6 national-median absolute SLR, cm above 1995-2014
# baseline. "Central Aotearoa" figures, excluding vertical land motion.
# Source: Ministry for the Environment, "Coastal Hazards and Climate Change
# Guidance" (2024), Chapter 2, Table 6. Cross-checked against NZ SeaRise
# platform national medians and IPCC AR6 WG1 Ch9 Table 9.9.
#
# Per-address numbers (which include local VLM) replace these once the
# searise_points table is loaded from the Takiwā CSV export.
NATIONAL_SLR = {
    "strong_action": {  # SSP1-2.6 median
        "label": "Strong global action",
        "description": "Paris 1.5-2°C targets met",
        "points": [
            {"year": 2050, "slr_cm": 20},
            {"year": 2100, "slr_cm": 43},
            {"year": 2150, "slr_cm": 58},
        ],
    },
    "current_trajectory": {  # SSP2-4.5 median
        "label": "Current trajectory",
        "description": "Present-day policy path",
        "points": [
            {"year": 2050, "slr_cm": 23},
            {"year": 2100, "slr_cm": 51},
            {"year": 2150, "slr_cm": 75},
        ],
    },
    "high_emissions": {  # SSP5-8.5 median
        "label": "High emissions",
        "description": "If emissions don't decline",
        "points": [
            {"year": 2050, "slr_cm": 27},
            {"year": 2100, "slr_cm": 72},
            {"year": 2150, "slr_cm": 113},
        ],
    },
}

MAX_HAZARD_DELTA = 15


def _as_float(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _council_layer_firing(hazards: dict) -> bool:
    """True when an existing council layer already flags this property,
    so we halve the timeline's score delta to avoid double-counting."""
    if hazards.get("coastal_erosion") or hazards.get("coastal_erosion_nearby"):
        return True
    if hazards.get("coastal_inundation_ranking"):
        return True
    cce = hazards.get("council_coastal_erosion")
    if isinstance(cce, dict) and cce.get("distance_m") is not None:
        return True
    return False


def _looks_coastal(hazards: dict, terrain: dict) -> bool:
    """Cheap filter: is this property plausibly near the coast at all?
    Avoids emitting a timeline for inland properties with no coastal data."""
    if hazards.get("coastal_elevation_cm") is not None:
        return True
    if hazards.get("coastal_erosion") or hazards.get("coastal_erosion_nearby"):
        return True
    if hazards.get("coastal_inundation_ranking"):
        return True
    if hazards.get("coastal_exposure"):
        return True
    # Tsunami zones 1-3 imply coastal proximity.
    tsunami = hazards.get("tsunami_zone_class")
    if tsunami is not None and int(tsunami) >= 1:
        return True
    return False


def _scenarios_from_point(searise_point: dict) -> Optional[list]:
    """Build scenarios[] from a per-site searise_points row. Returns None
    if required projections are missing."""
    proj = searise_point.get("projections") or {}
    meta = {
        "SSP126": ("Strong global action", "Paris 1.5-2°C targets met"),
        "SSP245": ("Current trajectory", "Present-day policy path"),
        "SSP585": ("High emissions", "If emissions don't decline"),
    }
    out = []
    for ssp, (label, desc) in meta.items():
        ssp_data = proj.get(ssp)
        if not ssp_data:
            return None
        pts = []
        for year in (2050, 2100, 2150):
            # JSONB returns keys as strings; Python dicts may have ints.
            entry = ssp_data.get(str(year)) or ssp_data.get(year)
            if not entry or "median_cm" not in entry:
                return None
            pts.append({"year": year, "slr_cm": round(entry["median_cm"])})
        out.append({"label": label, "description": desc, "points": pts})
    return out


def build_coastal_exposure(
    report: dict,
    searise_point: Optional[dict] = None,
) -> Optional[dict]:
    """Build the CoastalExposure payload or return None for non-coastal
    properties. Shape matches frontend/src/components/report/HostedCoastalTimeline.tsx.

    searise_point: optional per-site row from the searise_points table
    ({vlm_mm_yr, projections: {SSPxxx: {year: {median_cm, upper_cm}}}}).
    When provided, scenarios + VLM come from the per-site data. When absent
    or malformed, falls back to NATIONAL_SLR averages.
    """
    hazards = report.get("hazards") or {}
    terrain = report.get("terrain") or {}

    if not _looks_coastal(hazards, terrain):
        return None

    # Elevation above mean-high-water-springs. Prefer council-supplied value
    # (in cm) when present, else fall back to SRTM terrain elevation in m.
    elev_cm = hazards.get("coastal_elevation_cm")
    if elev_cm is not None:
        elevation_m = round(float(elev_cm) / 100.0, 1)
    else:
        te = _as_float(terrain.get("elevation_m"))
        elevation_m = round(te, 1) if te is not None else 5.0  # fallback to "mid"

    # Distance fields are not yet in the report (need LINZ coastline + NIWA
    # storm-tide polygons). Emit None placeholders so UI hides those stats
    # rather than showing fake numbers.
    coast_distance_m: Optional[int] = None
    storm_tide_100yr_distance_m: Optional[int] = None

    # Tier classification. Without coast distance we lean on elevation + the
    # existing hazard flags. This is intentionally conservative: a real
    # happens_now tier requires both low elevation and a council flag
    # OR a tsunami zone 2-3.
    tsunami = int(hazards.get("tsunami_zone_class") or 0)
    council_fires = _council_layer_firing(hazards)
    inundation = bool(hazards.get("coastal_inundation_ranking"))

    if elevation_m <= 3 and (inundation or tsunami >= 3):
        tier = "happens_now"
    elif elevation_m <= 3 and council_fires:
        tier = "happens_now"
    elif elevation_m <= 5 and (council_fires or inundation or tsunami >= 2):
        tier = "within_30_years"
    elif elevation_m <= 10 and (council_fires or tsunami >= 1):
        tier = "within_30_years"
    elif council_fires or tsunami >= 1:
        tier = "longer_term"
    else:
        return None

    # Prefer per-site projections when we have them.
    point_scenarios = _scenarios_from_point(searise_point) if searise_point else None
    if point_scenarios is not None:
        scenarios = point_scenarios
        vlm_mm_yr = searise_point.get("vlm_mm_yr") if searise_point else None
    else:
        scenarios = [
            NATIONAL_SLR["strong_action"],
            NATIONAL_SLR["current_trajectory"],
            NATIONAL_SLR["high_emissions"],
        ]
        vlm_mm_yr = None

    # Use the SLR values in narrative copy (per-site if we have them, else
    # national fallback).
    slr_2050 = scenarios[1]["points"][0]["slr_cm"]        # current trajectory 2050
    slr_2100_mid = scenarios[1]["points"][1]["slr_cm"]    # current trajectory 2100
    slr_2100_high = scenarios[2]["points"][1]["slr_cm"]   # high emissions 2100

    if tier == "happens_now":
        headline = "Big storms already reach this property"
        narrative = (
            f"The section sits {elevation_m:.1f}m above high tide. "
            f"Existing council coastal or tsunami mapping already flags this property.\n\n"
            f"By the 2050s the sea is projected to rise about {slr_2050}cm on the current "
            f"emissions path, pushing the same storms further inland.\n\n"
            f"**What this means:** Talk to your insurer now about cover for this address "
            f"and whether they'll still cover it in 15 years. Insurers lift excess or pull "
            f"cover well before flooding becomes frequent."
        )
        narrative_renter = (
            f"The section sits {elevation_m:.1f}m above high tide. Council mapping already "
            f"flags this property for coastal hazard.\n\n"
            f"By the 2050s the sea here is projected to rise about {slr_2050}cm, bringing "
            f"storm water closer.\n\n"
            f"**What this means:** Know your evacuation route. Check that your contents "
            f"insurance covers flood, many basic policies don't. Ask the landlord whether "
            f"this property has flooded before."
        )
        base_delta = 12
    elif tier == "within_30_years":
        headline = "The same storms will reach here within a few decades"
        narrative = (
            f"The section sits {elevation_m:.1f}m above high tide. By the 2050s the sea "
            f"here is projected to rise about {slr_2050}cm on the current emissions path, "
            f"enough that today's big storms start reaching further inland without getting "
            f"any bigger.\n\n"
            f"**What this means:** Insurers reprice flood-exposed properties 10-15 years "
            f"before events become frequent. If you're holding through the 2040s, assume "
            f"premiums rise and cover narrows."
        )
        narrative_renter = (
            f"The section sits {elevation_m:.1f}m above high tide. By the 2050s the sea is "
            f"projected to rise about {slr_2050}cm, bringing storms further inland.\n\n"
            f"**What this means:** Check your contents insurance covers flood, many basic "
            f"policies don't. Ask the landlord about past flooding or storm damage here."
        )
        base_delta = 8
    else:  # longer_term
        headline = "Notably higher sea level here by 2100"
        narrative = (
            f"On the current emissions path sea level is projected to be about "
            f"{slr_2100_mid}cm higher by 2100. Under a worst-case scenario it's closer to "
            f"{slr_2100_high}cm.\n\n"
            f"Beyond most ownership horizons, but it affects resale to the next buyer who "
            f"will have a shorter runway than you did.\n\n"
            f"**What this means:** Probably not decision-relevant for a 10-15 year hold. "
            f"Worth noting for multi-generational holds."
        )
        narrative_renter = None  # Renters don't see longer_term tier
        base_delta = 1

    # Halve delta when a council layer already fires, so Hazards score
    # doesn't double-count the same risk.
    delta = base_delta // 2 if council_fires and base_delta > 1 else base_delta

    result = {
        "tier": tier,
        "ground_elevation_m": elevation_m,
        "coast_distance_m": coast_distance_m,
        "storm_tide_100yr_distance_m": storm_tide_100yr_distance_m,
        "vlm_mm_yr": round(vlm_mm_yr, 1) if vlm_mm_yr is not None else None,
        "scenarios": scenarios,
        "headline": headline,
        "narrative": narrative,
        "score_impact": {
            "delta": delta,
            "max_possible": MAX_HAZARD_DELTA,
            "suppressed_by_council_layer": council_fires,
        },
    }
    if narrative_renter is not None:
        result["narrative_renter"] = narrative_renter
    return result

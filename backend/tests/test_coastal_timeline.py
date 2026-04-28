"""Unit tests for coastal_timeline.build_coastal_exposure.

Pure function, no DB. Covers the tier classifier and the council-layer
suppression logic that prevents double-counting against risk_score.py.
"""
from __future__ import annotations

from app.services.coastal_timeline import (
    NATIONAL_SLR,
    MAX_HAZARD_DELTA,
    build_coastal_exposure,
)


def _report(hazards: dict | None = None, terrain: dict | None = None) -> dict:
    return {"hazards": hazards or {}, "terrain": terrain or {}}


def test_inland_property_returns_none():
    # No coastal flags, no coastal_elevation, not in tsunami zone.
    r = _report(hazards={}, terrain={"elevation_m": 120})
    assert build_coastal_exposure(r) is None


def test_happens_now_tier_from_council_inundation_and_low_elevation():
    r = _report(
        hazards={
            "coastal_inundation_ranking": "high",
            "coastal_elevation_cm": 210,  # 2.1m
        }
    )
    out = build_coastal_exposure(r)
    assert out is not None
    assert out["tier"] == "happens_now"
    assert out["ground_elevation_m"] == 2.1
    # Council layer is firing, so delta must be halved.
    assert out["score_impact"]["suppressed_by_council_layer"] is True
    assert 0 < out["score_impact"]["delta"] < 12


def test_within_30_years_tier_from_tsunami_zone_2():
    r = _report(
        hazards={"tsunami_zone_class": 2},
        terrain={"elevation_m": 4.5},
    )
    out = build_coastal_exposure(r)
    assert out is not None
    assert out["tier"] == "within_30_years"


def test_longer_term_tier_from_tsunami_zone_1_high_elevation():
    r = _report(
        hazards={"tsunami_zone_class": 1},
        terrain={"elevation_m": 30},
    )
    out = build_coastal_exposure(r)
    assert out is not None
    assert out["tier"] == "longer_term"


def test_council_erosion_halves_delta():
    r_plain = _report(
        hazards={"tsunami_zone_class": 3},
        terrain={"elevation_m": 2.0},
    )
    r_with_erosion = _report(
        hazards={"tsunami_zone_class": 3, "coastal_erosion": True},
        terrain={"elevation_m": 2.0},
    )
    out_plain = build_coastal_exposure(r_plain)
    out_erosion = build_coastal_exposure(r_with_erosion)
    assert out_plain["score_impact"]["delta"] > out_erosion["score_impact"]["delta"]
    assert out_erosion["score_impact"]["suppressed_by_council_layer"] is True


def test_scenarios_always_three_ordered_increasing_emissions():
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.5},
    )
    out = build_coastal_exposure(r)
    assert out is not None
    assert len(out["scenarios"]) == 3
    by_2100 = [s["points"][1]["slr_cm"] for s in out["scenarios"]]
    assert by_2100 == sorted(by_2100)  # increasing: strong, current, high


def test_delta_never_exceeds_max_possible():
    r = _report(
        hazards={"coastal_inundation_ranking": "high", "tsunami_zone_class": 3},
        terrain={"elevation_m": 1.5},
    )
    out = build_coastal_exposure(r)
    assert out["score_impact"]["delta"] <= MAX_HAZARD_DELTA
    assert out["score_impact"]["max_possible"] == MAX_HAZARD_DELTA


def test_renter_narrative_present_for_happens_now_only():
    # happens_now: renter narrative MUST exist
    r_now = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.0},
    )
    out_now = build_coastal_exposure(r_now)
    assert "narrative_renter" in out_now

    # longer_term: renter won't see this tier in the UI, so no renter copy
    r_long = _report(
        hazards={"tsunami_zone_class": 1},
        terrain={"elevation_m": 30},
    )
    out_long = build_coastal_exposure(r_long)
    assert out_long["tier"] == "longer_term"
    assert "narrative_renter" not in out_long


def test_narrative_has_no_em_dashes():
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.0},
    )
    out = build_coastal_exposure(r)
    for field in ("headline", "narrative", "narrative_renter"):
        assert "—" not in out.get(field, ""), f"em-dash found in {field}"


def test_national_slr_values_within_published_ranges():
    """Sanity-check the NATIONAL_SLR fallback constants against three
    authoritative sources so we don't drift off published NZ guidance.

    Sources (accessed 2026-04-22):
      * Ministry for the Environment, Coastal Hazards and Climate Change
        Guidance (2024), Chapter 2 Table 6.
        https://environment.govt.nz/publications/coastal-hazards-and-climate-change-guidance/
      * IPCC AR6 WG1 Chapter 9 Table 9.9 (global mean SLR median).
        https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-9/
      * NZ SeaRise 2022 national medians (searise.nz).

    Ranges below reflect agreement across those three, widened by ±5cm
    to allow for NZ-regional vs global-mean discrepancy.
    """
    expected = {
        # (scenario_key, year): (min_cm, max_cm)
        ("strong_action", 2050): (15, 25),     # IPCC 0.19m ± regional
        ("strong_action", 2100): (38, 55),     # IPCC 0.44m
        ("strong_action", 2150): (50, 75),
        ("current_trajectory", 2050): (18, 30),
        ("current_trajectory", 2100): (45, 65),
        ("current_trajectory", 2150): (68, 100),
        ("high_emissions", 2050): (22, 35),
        ("high_emissions", 2100): (65, 90),
        ("high_emissions", 2150): (100, 150),
    }
    for (scenario, year), (lo, hi) in expected.items():
        point = next(
            p for p in NATIONAL_SLR[scenario]["points"] if p["year"] == year
        )
        assert lo <= point["slr_cm"] <= hi, (
            f"{scenario} @ {year} = {point['slr_cm']}cm outside published range {lo}-{hi}cm"
        )


def test_national_slr_monotonic_by_scenario_and_year():
    """Strong action < current trajectory < high emissions at every year.
    And SLR grows with time within every scenario."""
    for year in (2050, 2100, 2150):
        strong = next(p for p in NATIONAL_SLR["strong_action"]["points"] if p["year"] == year)
        current = next(p for p in NATIONAL_SLR["current_trajectory"]["points"] if p["year"] == year)
        high = next(p for p in NATIONAL_SLR["high_emissions"]["points"] if p["year"] == year)
        assert strong["slr_cm"] <= current["slr_cm"] <= high["slr_cm"], (
            f"Scenarios not ordered at {year}: {strong['slr_cm']}/{current['slr_cm']}/{high['slr_cm']}"
        )

    for scenario in NATIONAL_SLR:
        points = NATIONAL_SLR[scenario]["points"]
        vals = [p["slr_cm"] for p in points]
        assert vals == sorted(vals), f"{scenario} SLR not increasing over time: {vals}"


def _point(vlm: float = -2.5, variant: str = "wellington") -> dict:
    """Fabricate a per-site projection matching the Zenodo schema."""
    # Wellington-ish values from the dry-run sample.
    wellington = {
        "SSP126": {"2050": {"median_cm": 32, "upper_cm": 42}, "2100": {"median_cm": 72, "upper_cm": 95}, "2150": {"median_cm": 100, "upper_cm": 140}},
        "SSP245": {"2050": {"median_cm": 36, "upper_cm": 46}, "2100": {"median_cm": 85, "upper_cm": 110}, "2150": {"median_cm": 130, "upper_cm": 170}},
        "SSP585": {"2050": {"median_cm": 39, "upper_cm": 51}, "2100": {"median_cm": 112, "upper_cm": 145}, "2150": {"median_cm": 203, "upper_cm": 260}},
    }
    return {"vlm_mm_yr": vlm, "projections": wellington, "distance_m": 150}


def test_per_point_data_drives_scenarios():
    """When a per-site searise_point is passed, scenarios come from it
    rather than NATIONAL_SLR."""
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.5},
    )
    out = build_coastal_exposure(r, searise_point=_point())
    assert out is not None
    # Wellington 2100 current-trajectory = 85cm per fixture; NATIONAL_SLR is 51.
    current_2100 = next(
        p["slr_cm"] for s in out["scenarios"] if s["label"] == "Current trajectory"
        for p in s["points"] if p["year"] == 2100
    )
    assert current_2100 == 85, f"Expected per-point 85cm, got {current_2100}"


def test_per_point_populates_vlm():
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.5},
    )
    out = build_coastal_exposure(r, searise_point=_point(vlm=-3.1))
    assert out["vlm_mm_yr"] == -3.1


def test_falls_back_to_national_when_point_missing():
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.5},
    )
    out_with = build_coastal_exposure(r, searise_point=_point())
    out_without = build_coastal_exposure(r, searise_point=None)

    # Both should emit a full CoastalExposure; scenarios will differ.
    assert out_with["scenarios"][1]["points"][1]["slr_cm"] != out_without["scenarios"][1]["points"][1]["slr_cm"]
    # Without a point, vlm stays null.
    assert out_without["vlm_mm_yr"] is None


def test_malformed_point_falls_back_gracefully():
    """If projections are missing a scenario or year, we fall back
    to NATIONAL_SLR rather than emitting a partial scenarios list."""
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.5},
    )
    broken = {
        "vlm_mm_yr": -1.0,
        "projections": {"SSP245": {"2050": {"median_cm": 30}}},  # missing 2100, 2150, SSP126, SSP585
    }
    out = build_coastal_exposure(r, searise_point=broken)
    # Must still emit 3 scenarios via fallback.
    assert len(out["scenarios"]) == 3
    # Current-trajectory 2100 should be the NATIONAL_SLR value (51), not 30.
    current_2100 = next(
        p["slr_cm"] for s in out["scenarios"] if s["label"] == "Current trajectory"
        for p in s["points"] if p["year"] == 2100
    )
    assert current_2100 == 51


def test_score_override_applied_when_coastal_present():
    """enrich_with_scores should map coastal.score_impact.delta into the
    coastal_erosion indicator and drop coastal_erosion_council to prevent
    double-counting."""
    from app.services.risk_score import enrich_with_scores

    report = {
        "hazards": {
            # Legacy coastal data that would have set both indicators.
            "coastal_exposure": "E",  # would normally score 65
            "coastal_erosion_exposure": "High",
        },
        "scores": None,  # let enrich populate
        "coastal": {
            "tier": "happens_now",
            "score_impact": {"delta": 12, "max_possible": 15, "suppressed_by_council_layer": False},
        },
    }
    out = enrich_with_scores(report)
    indicators = out["scores"]["indicators"]
    # delta 12 / max 15 = 80
    assert indicators["coastal"] == 80, indicators
    # Council variant suppressed.
    assert "coastal_erosion_council" not in indicators


def test_score_override_skipped_without_coastal_block():
    """When report.coastal is absent, legacy coastal_erosion logic stands."""
    from app.services.risk_score import enrich_with_scores

    report = {
        "hazards": {"coastal_exposure": "E"},  # legacy: 65
        "scores": None,
    }
    out = enrich_with_scores(report)
    indicators = out["scores"]["indicators"]
    assert indicators["coastal"] == 65, indicators


def test_coast_distance_is_null_placeholder():
    # Until LINZ coastline + NIWA polygons are loaded, these stay null.
    r = _report(
        hazards={"coastal_inundation_ranking": "high"},
        terrain={"elevation_m": 2.0},
    )
    out = build_coastal_exposure(r)
    assert out["coast_distance_m"] is None
    assert out["storm_tide_100yr_distance_m"] is None
    assert out["vlm_mm_yr"] is None

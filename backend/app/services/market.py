# backend/app/services/market.py
"""
Market analysis helper functions.
Reference: FAIR-PRICE-ENGINE.md
"""
from __future__ import annotations

import math


# --- Regional Gross Yield Table (FAIR-PRICE-ENGINE.md §4 Method B) ---
YIELD_TABLE = {
    "Auckland":     {"low": 0.030, "typical": 0.035, "high": 0.040},
    "Wellington":   {"low": 0.030, "typical": 0.045, "high": 0.055},
    "Christchurch": {"low": 0.040, "typical": 0.048, "high": 0.055},
    "Hamilton":     {"low": 0.040, "typical": 0.050, "high": 0.060},
    "Tauranga":     {"low": 0.030, "typical": 0.040, "high": 0.048},
    "Dunedin":      {"low": 0.045, "typical": 0.055, "high": 0.065},
    "DEFAULT":      {"low": 0.040, "typical": 0.050, "high": 0.060},
}


def cv_uncertainty(months_since_valuation: int) -> float:
    """Returns ± uncertainty as decimal (e.g., 0.08 = ±8%).
    Ref: FAIR-PRICE-ENGINE.md §7"""
    if months_since_valuation <= 12:
        return 0.08
    if months_since_valuation <= 24:
        return 0.12
    if months_since_valuation <= 36:
        return 0.18
    return 0.25


REVALUATION_DATES = {
    # Effective dates of each TA's most recent revaluation. Only used as
    # fallback when council_valuations.valuation_date is NULL (which is true
    # for 41 of 44 councils; only Auckland, WCC, KCDC have DB dates).
    # Audited 2026-04-21 against council websites + QV press releases.
    "Auckland": "2024-05-01",              # DB has 2024-05-01; map is cosmetic
    "Wellington City": "2024-09-01",       # DB has 2024-09-01
    "Kapiti Coast District": "2023-08-01", # DB has 2023-08-01
    "Christchurch City": "2025-08-01",     # fixed from 2022 (stale)
    "Dunedin City": "2025-06-01",          # fixed from 2022 (stale)
    "Tasman District": "2023-09-01",       # fixed from 2024-09 (wrong year)
    "Hamilton City": "2024-09-01",
    "Palmerston North City": "2024-09-01",
    "Nelson City": "2024-09-01",
    "Queenstown-Lakes District": "2024-09-01",
    "New Plymouth District": "2025-08-01",
    "Taranaki": "2025-08-01",              # regional alias for NPDC
    "Horowhenua District": "2025-08-01",
    "Hutt City": "2025-08-01",             # aka Lower Hutt
    "Upper Hutt City": "2025-06-01",
    "Whangarei District": "2024-07-01",
    "Invercargill City": "2023-07-01",
    "Rotorua Lakes": "2023-07-01",
    "Marlborough District": "2023-07-01",
    "Tauranga City": "2023-05-01",
    "Gisborne District": "2023-08-01",
    "Timaru District": "2023-09-01",
    "Hastings District": "2022-08-01",     # 2025 reval in progress, not yet effective
    "Porirua City": "2022-10-01",          # STALE, 2025-09 reval pending — verify
    "Buller District": "2022-10-01",       # STALE, next reval not yet published
    "Whanganui District": "2022-10-01",    # STALE, next reval not yet published
    "Waimakariri District": "2023-09-01",  # Canterbury satellite; reval same cycle
    "Selwyn District": "2023-09-01",       # Canterbury satellite
    "Ashburton District": "2023-10-01",    # Canterbury satellite
}

# When a TA has no 5yr CGR in reinz_hpi_ta (i.e. it's in page 14 but not
# page 6 of the REINZ report), fall back to a geographic neighbour's CGR
# as a proxy. Update when adding a TA to REVALUATION_DATES if that TA
# also lacks page-6 movement data.
HPI_CGR_PROXY = {
    "Waimakariri District": "Christchurch City",
    "Selwyn District": "Christchurch City",
    "Ashburton District": "Christchurch City",
    "Timaru District": "Christchurch City",
    "Tasman District": "Nelson City",
    "Marlborough District": "Nelson City",
    "Buller District": "Nelson City",
    "Kapiti Coast District": "Wellington City",
    "Horowhenua District": "Palmerston North City",
    "Whanganui District": "Palmerston North City",
    "Gisborne District": "Napier City",
    "Central Otago District": "Queenstown-Lakes District",
    "Waitaki District": "Dunedin City",
}


def estimate_percentile(asking_rent: int, median: float, sigma: float | None) -> float | None:
    """Compute percentile of asking_rent in log-normal distribution.
    sigma = log_std_dev_weekly_rent from bonds_detailed.
    Returns 0.0-1.0 or None if sigma unavailable."""
    if not sigma or float(sigma) <= 0:
        return None
    mu = math.log(float(median))
    z = (math.log(float(asking_rent)) - mu) / float(sigma)
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def blend_sa2_tla(sa2_median: float, tla_median: float, sa2_bond_count: int) -> float:
    """Blend SA2 and TLA medians when SA2 has few bonds (5-20).
    At 5 bonds: 75% TLA, 25% SA2. At 20+ bonds: 100% SA2."""
    weight = min(sa2_bond_count / 20.0, 1.0)
    return weight * sa2_median + (1 - weight) * tla_median


def market_confidence_stars(
    bond_count: int, cv_age_months: int | None, methods_agree_pct: float | None
) -> int:
    """Returns 1-5 stars based on data quality.
    Ref: FAIR-PRICE-ENGINE.md §8"""
    agree = methods_agree_pct or 100
    cv_age = cv_age_months or 999
    if bond_count >= 30 and cv_age <= 12 and agree <= 10:
        return 5
    if bond_count >= 15 and cv_age <= 24 and agree <= 15:
        return 4
    if bond_count >= 5 and cv_age <= 36:
        return 3
    if bond_count >= 1:
        return 2
    return 1

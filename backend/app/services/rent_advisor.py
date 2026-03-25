# backend/app/services/rent_advisor.py
"""
Rent advisor engine: applies property-specific adjustments to SA2 median rent,
scales hazard adjustments by SA2 prevalence, and provides area context.
Outputs a fair-rent band (low–high) rather than a single point estimate.
"""
from __future__ import annotations

from .market import blend_sa2_tla, market_confidence_stars

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TYPICAL_FOOTPRINT = {"House": 140, "Flat": 90, "Apartment": 65, "Room": 40}
TYPICAL_IMP_RATIO = 0.45

# Finish tier: (low_adj, high_adj) — range for the band
FINISH_TIERS = {
    "basic": (-0.05, -0.10),
    "standard": (-0.01, -0.03),
    "modern": (0.0, 0.0),
    "premium": (0.04, 0.08),
    "luxury": (0.08, 0.15),
}

FINISH_DESCRIPTIONS = {
    "basic": "Dated kitchen/bathroom, older carpets, basic fittings.",
    "standard": "Clean and tidy, no frills. Standard fittings.",
    "modern": "Recently renovated or built. Good fixtures.",
    "premium": "High-end finishes, designer kitchen, quality materials.",
    "luxury": "Architect-designed, top-of-the-line appliances.",
}

# Bathroom adjustments: keyed by (bedrooms, bathrooms)
# Typical: 1-2 bed → 1 bath, 3 bed → 1-2 bath, 4+ bed → 2 bath
BATHROOM_ADJ: dict[tuple[str, str], tuple[float, float]] = {
    # 1-bedroom
    ("1", "1"): (0.0, 0.0),
    ("1", "2"): (0.02, 0.05),
    ("1", "3+"): (0.04, 0.08),
    # 2-bedroom
    ("2", "1"): (0.0, 0.0),
    ("2", "2"): (0.02, 0.05),
    ("2", "3+"): (0.04, 0.08),
    # 3-bedroom (1-2 bath is typical)
    ("3", "1"): (-0.02, -0.01),
    ("3", "2"): (0.0, 0.0),
    ("3", "3+"): (0.02, 0.05),
    # 4-bedroom (2 bath is typical)
    ("4", "1"): (-0.04, -0.02),
    ("4", "2"): (0.0, 0.0),
    ("4", "3+"): (0.02, 0.05),
    # 5+-bedroom (2 bath is typical)
    ("5+", "1"): (-0.05, -0.03),
    ("5+", "2"): (0.0, 0.0),
    ("5+", "3+"): (0.02, 0.05),
}

# Hazard adjustment ranges (low_adj, high_adj) — both negative
HAZARD_ADJ = {
    "flood": {"label": "Flood zone", "low": -0.03, "high": -0.06},
    "liquefaction": {"label": "High liquefaction", "low": -0.02, "high": -0.04},
    "tsunami": {"label": "Tsunami zone", "low": -0.01, "high": -0.03},
    "epb_self": {"label": "Earthquake-prone building (this property)", "low": -0.10, "high": -0.15},
    "epb_nearby": {"label": "Near earthquake-prone building", "low": -0.01, "high": -0.03},
    "contamination": {"label": "Near contaminated site", "low": -0.01, "high": -0.02},
    "overland_flow": {"label": "Overland flow path", "low": -0.005, "high": -0.02},
    "slope_failure": {"label": "Landslide risk", "low": -0.01, "high": -0.03},
    "noise_high": {"label": "High traffic noise", "low": -0.01, "high": -0.02},
    "aircraft_noise": {"label": "Aircraft noise", "low": -0.02, "high": -0.04},
    "wind_high": {"label": "High wind zone", "low": -0.005, "high": -0.015},
    "coastal_erosion": {"label": "Coastal erosion risk", "low": -0.03, "high": -0.05},
}

# SQL fragments for prevalence counting (safe — defined in code, not user input)
_PREVALENCE_SQL = {
    "flood": "EXISTS(SELECT 1 FROM flood_zones hz WHERE ST_Intersects(hz.geom, a.geom))",
    "liquefaction": "EXISTS(SELECT 1 FROM liquefaction_zones hz WHERE ST_Intersects(hz.geom, a.geom) AND hz.liquefaction IN ('High', 'Very High'))",
    "tsunami": "EXISTS(SELECT 1 FROM tsunami_zones hz WHERE ST_Intersects(hz.geom, a.geom))",
    "overland_flow": "EXISTS(SELECT 1 FROM overland_flow_paths hz WHERE ST_DWithin(hz.geom, a.geom, 0.0005))",
    "slope_failure": "EXISTS(SELECT 1 FROM slope_failure_zones hz WHERE ST_Intersects(hz.geom, a.geom) AND hz.severity LIKE '5%%')",
    "noise_high": "EXISTS(SELECT 1 FROM noise_contours hz WHERE ST_Intersects(hz.geom, a.geom) AND hz.laeq24h >= 65)",
    "aircraft_noise": "EXISTS(SELECT 1 FROM aircraft_noise_overlay hz WHERE ST_Intersects(hz.geom, a.geom) AND hz.noise_level_dba >= 60)",
    "wind_high": "EXISTS(SELECT 1 FROM wind_zones hz WHERE ST_Intersects(hz.geom, a.geom) AND (hz.zone_name LIKE 'VH%%' OR hz.zone_name LIKE 'EH%%' OR hz.zone_name LIKE 'SED%%' OR hz.zone_name = 'Very high wind zone' OR hz.zone_name = 'High Risk'))",
    "coastal_erosion": "EXISTS(SELECT 1 FROM coastal_erosion hz WHERE ST_DWithin(hz.geom::geography, a.geom::geography, 500))",
    # EPB and contamination are point-count based, not polygon prevalence
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def _prevalence_scale(prevalence: float) -> float:
    """Scale hazard adjustment by how common it is in the SA2.
    >70% = area-wide (skip), 40-70% = partially priced in, <40% = full."""
    if prevalence > 0.70:
        return 0.0
    if prevalence > 0.40:
        return 0.3
    return 1.0


async def get_sa2_rental_baseline(
    conn, sa2_code: str, ta_name: str, dwelling_type: str, bedrooms: str
) -> dict | None:
    """Shared helper: get SA2 median rent with TLA fallback."""
    bonds_query = """
        SELECT bd.median_rent, bd.lower_quartile_rent, bd.upper_quartile_rent,
               bd.active_bonds, bd.log_std_dev_weekly_rent, bd.time_frame
        FROM bonds_detailed bd
        WHERE bd.location_id = %s
    """
    params: list = [sa2_code]
    if dwelling_type != "ALL":
        bonds_query += " AND bd.dwelling_type = %s"
        params.append(dwelling_type)
    if bedrooms != "ALL":
        bonds_query += " AND bd.number_of_beds = %s"
        params.append(bedrooms)
    bonds_query += " ORDER BY bd.time_frame DESC LIMIT 1"

    cur = await conn.execute(bonds_query, params)
    bonds = cur.fetchone()

    sa2_median = float(bonds["median_rent"]) if bonds and bonds["median_rent"] else None
    sa2_bond_count = bonds["active_bonds"] if bonds else 0
    blended_median = sa2_median
    data_source = "sa2"

    if not bonds or sa2_bond_count < 5:
        cur = await conn.execute(
            "SELECT median_rent FROM bonds_tla WHERE location = %s ORDER BY time_frame DESC LIMIT 1",
            [ta_name],
        )
        tla = cur.fetchone()
        if tla:
            tla_median = float(tla["median_rent"]) if tla["median_rent"] else None
            if sa2_median and sa2_bond_count > 0 and tla_median:
                blended_median = blend_sa2_tla(sa2_median, tla_median, sa2_bond_count)
                data_source = "sa2_tla_blend"
            elif tla_median:
                blended_median = tla_median
                data_source = "tla_fallback"

    if blended_median is None:
        return None

    return {
        "median": blended_median,
        "bond_count": sa2_bond_count,
        "lower_quartile": float(bonds["lower_quartile_rent"]) if bonds and bonds.get("lower_quartile_rent") else None,
        "upper_quartile": float(bonds["upper_quartile_rent"]) if bonds and bonds.get("upper_quartile_rent") else None,
        "sigma": float(bonds["log_std_dev_weekly_rent"]) if bonds and bonds.get("log_std_dev_weekly_rent") else None,
        "data_source": data_source,
        "period": str(bonds["time_frame"]) if bonds and bonds.get("time_frame") else None,
    }


# ---------------------------------------------------------------------------
# Hazard detection — single query, all hazards
# ---------------------------------------------------------------------------

async def _detect_hazards(conn, address_id: int) -> dict:
    """Check which hazards affect this specific property. Single DB round-trip."""
    cur = await conn.execute(
        """
        SELECT
            (SELECT fz.label FROM flood_zones fz
             WHERE ST_Intersects(fz.geom, a.geom) LIMIT 1) AS flood_zone,
            (SELECT lz.liquefaction FROM liquefaction_zones lz
             WHERE ST_Intersects(lz.geom, a.geom) LIMIT 1) AS liquefaction,
            (SELECT tz.zone_class::text FROM tsunami_zones tz
             WHERE ST_Intersects(tz.geom, a.geom) LIMIT 1) AS tsunami_zone,
            (SELECT COUNT(*)::int FROM earthquake_prone_buildings epb
             WHERE ST_DWithin(a.geom::geography, epb.geom::geography, 5)) AS epb_self_count,
            (SELECT COUNT(*)::int FROM earthquake_prone_buildings epb
             WHERE ST_DWithin(a.geom::geography, epb.geom::geography, 50)) AS epb_nearby_count,
            (SELECT wz.zone_name FROM wind_zones wz
             WHERE ST_Intersects(wz.geom, a.geom) LIMIT 1) AS wind_zone,
            (SELECT nc.laeq24h::int FROM noise_contours nc
             WHERE ST_Intersects(nc.geom, a.geom) ORDER BY nc.laeq24h DESC LIMIT 1) AS noise_db,
            (SELECT an.noise_level_dba::int FROM aircraft_noise_overlay an
             WHERE ST_Intersects(an.geom, a.geom) LIMIT 1) AS aircraft_noise_dba,
            (SELECT COUNT(*)::int FROM contaminated_land cl
             WHERE ST_DWithin(a.geom::geography, cl.geom::geography, 100)) AS contam_count,
            (SELECT true FROM overland_flow_paths ofp
             WHERE ST_DWithin(ofp.geom, a.geom, 0.0005) LIMIT 1) AS on_overland_flow,
            (SELECT sfz.severity FROM slope_failure_zones sfz
             WHERE ST_Intersects(sfz.geom, a.geom) LIMIT 1) AS slope_failure,
            (SELECT true FROM coastal_erosion ce
             WHERE ST_DWithin(ce.geom::geography, a.geom::geography, 500) LIMIT 1) AS coastal_erosion_nearby
        FROM addresses a
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    row = cur.fetchone()
    return dict(row) if row else {}


# ---------------------------------------------------------------------------
# Prevalence — how common is each hazard in this SA2?
# ---------------------------------------------------------------------------

async def _compute_prevalence(conn, sa2_code: str, detected_keys: set[str]) -> dict[str, float]:
    """Compute prevalence ratios for detected hazards only. Single query."""
    keys_with_sql = {k for k in detected_keys if k in _PREVALENCE_SQL}
    if not keys_with_sql:
        return {}

    filters = []
    for key in sorted(keys_with_sql):
        filters.append(f"COUNT(*) FILTER (WHERE {_PREVALENCE_SQL[key]}) AS {key}_count")

    query = f"""
        SELECT COUNT(*) AS total, {', '.join(filters)}
        FROM addresses a, sa2_boundaries s
        WHERE ST_Within(a.geom, s.geom)
        AND s.sa2_code = %s AND a.address_lifecycle = 'Current'
    """
    cur = await conn.execute(query, [sa2_code])
    row = cur.fetchone()
    if not row or row["total"] == 0:
        return {}

    total = row["total"]
    return {key: row[f"{key}_count"] / total for key in keys_with_sql}


# ---------------------------------------------------------------------------
# Unit CV fallback — match LINZ unit to WCC rates cache
# ---------------------------------------------------------------------------

async def _get_unit_cv_from_rates(conn, prop: dict) -> dict | None:
    """Try to find unit-level CV from wcc_rates_cache when council_valuations has NULL.
    WCC uses prefixes: 'Unit', 'Apt', 'Flat' + unit_value + street address."""
    unit_value = prop.get("unit_value")
    if not unit_value:
        return None

    street = f"{prop.get('address_number', '')} {prop.get('road_name', '')}"
    if prop.get("road_type_name"):
        street += f" {prop['road_type_name']}"
    street = street.strip()
    if not street:
        return None

    # Try all WCC unit prefixes
    cur = await conn.execute(
        """
        SELECT capital_value, land_value, improvements_value
        FROM wcc_rates_cache
        WHERE capital_value > 0
          AND (address ILIKE %s OR address ILIKE %s OR address ILIKE %s)
        LIMIT 1
        """,
        [
            f"Unit {unit_value} {street}%",
            f"Apt {unit_value} {street}%",
            f"Flat {unit_value} {street}%",
        ],
    )
    row = cur.fetchone()
    if row:
        return {
            "capital_value": row["capital_value"],
            "land_value": row["land_value"] or 0,
            "improvements_value": row["improvements_value"] or 0,
        }
    return None


# ---------------------------------------------------------------------------
# Location metrics — property-specific vs SA2 average
# ---------------------------------------------------------------------------

# CBD coordinates for NZ cities (matches report function)
_CBD_COORDS = {
    # Major cities
    "auckland": (174.7685, -36.8442),
    "wellington": (174.7762, -41.2865),
    "christchurch": (172.6362, -43.5321),
    "hamilton": (175.2793, -37.7870),
    "tauranga": (176.1654, -37.6878),
    "dunedin": (170.5036, -45.8788),
    "napier": (176.9120, -39.4928),
    "hastings": (176.8422, -39.6381),
    "nelson": (173.2840, -41.2706),
    "invercargill": (168.3538, -46.4132),
    "queenstown": (168.6626, -45.0312),
    "rotorua": (176.2497, -38.1368),
    "new plymouth": (174.0752, -39.0556),
    "whangarei": (174.3239, -35.7275),
    "palmerston north": (175.6113, -40.3523),
    # Greater Wellington
    "lower hutt": (174.9076, -41.2092),
    "upper hutt": (175.0706, -41.1244),
    "porirua": (174.8410, -41.1337),
    "paraparaumu": (174.9507, -40.9147),  # Kapiti Coast
    "kapiti": (174.9507, -40.9147),
    # Horizons / Manawatu-Whanganui
    "whanganui": (175.0479, -39.9301),
    "levin": (175.2750, -40.6218),  # Horowhenua
    "feilding": (175.5662, -40.2240),  # Manawatu DC
    # Wairarapa
    "masterton": (175.6578, -40.9597),
    "carterton": (175.5280, -41.0249),
    "greytown": (175.4581, -41.0810),  # South Wairarapa
    # Waikato region
    "cambridge": (175.4710, -37.8847),  # Waipa
    "te awamutu": (175.3232, -38.0069),  # Waipa
    "tokoroa": (175.8651, -38.2232),  # South Waikato
    "matamata": (175.7723, -37.8100),  # Matamata-Piako
    "huntly": (175.3140, -37.5560),  # Waikato DC
    "thames": (175.5392, -37.1404),  # Thames-Coromandel
    "paeroa": (175.6717, -37.3711),  # Hauraki
    "taupo": (176.0702, -38.6857),
    "te kuiti": (175.1614, -38.3335),  # Waitomo
    "otorohanga": (175.2121, -38.1815),
    # Bay of Plenty
    "whakatane": (176.9910, -37.9553),
    "mount maunganui": (176.1703, -37.6341),
    # Canterbury region
    "timaru": (171.2540, -44.3931),
    "ashburton": (171.7476, -43.9007),
    "rangiora": (172.5969, -43.3068),  # Waimakariri
    "rolleston": (172.3792, -43.5914),  # Selwyn
    "kaikoura": (173.6814, -42.3998),
    "oamaru": (170.9745, -45.0966),  # Waitaki
    # Top of the South
    "blenheim": (173.9613, -41.5138),  # Marlborough
    "richmond": (173.1825, -41.3371),  # Tasman
    # West Coast
    "greymouth": (171.2108, -42.4500),
    "westport": (171.6006, -41.7540),  # Buller
    # Otago
    "alexandra": (169.3792, -45.2486),  # Central Otago
    "balclutha": (169.7320, -46.2348),  # Clutha
    "wanaka": (169.1320, -44.6996),
    "cromwell": (169.1981, -45.0382),
    # Southland
    "gore": (168.9446, -46.1011),
    # Gisborne
    "gisborne": (178.0176, -38.6623),
    # Northland
    "kerikeri": (176.1656, -35.2271),
    "whangarei": (174.3239, -35.7275),
}


def _get_cbd_point(ta_name: str) -> tuple[float, float] | None:
    """Get CBD coordinates for the nearest city."""
    ta_lower = (ta_name or "").lower()
    for city, coords in _CBD_COORDS.items():
        if city in ta_lower:
            return coords
    return _CBD_COORDS.get("wellington")  # default


async def _get_location_metrics(conn, address_id: int, ta_name: str) -> dict:
    """Get property-specific location metrics: transit, CBD, parks, schools, noise."""
    cbd = _get_cbd_point(ta_name)
    cbd_sql = f"ST_SetSRID(ST_MakePoint({cbd[0]}, {cbd[1]}), 4326)" if cbd else "NULL"

    cur = await conn.execute(
        f"""
        SELECT
            -- Transit stops within 400m
            (SELECT COUNT(*)::int FROM metlink_stops ms
             WHERE ms.geom && ST_Expand(a.geom, 0.005)
               AND ST_DWithin(ms.geom::geography, a.geom::geography, 400)
            ) + (SELECT COUNT(*)::int FROM at_stops ats
             WHERE ats.geom && ST_Expand(a.geom, 0.005)
               AND ST_DWithin(ats.geom::geography, a.geom::geography, 400)
            ) AS transit_stops_400m,
            -- Nearest rail station distance
            LEAST(
                (SELECT round(ST_Distance(ms.geom::geography, a.geom::geography)::numeric)
                 FROM metlink_stops ms
                 WHERE 2 = ANY(ms.route_types)
                   AND ms.geom && ST_Expand(a.geom, 0.05)
                 ORDER BY ms.geom <-> a.geom LIMIT 1),
                (SELECT round(ST_Distance(ats.geom::geography, a.geom::geography)::numeric)
                 FROM at_stops ats
                 WHERE 2 = ANY(ats.route_types)
                   AND ats.geom && ST_Expand(a.geom, 0.05)
                 ORDER BY ats.geom <-> a.geom LIMIT 1)
            ) AS nearest_rail_m,
            -- CBD distance
            {'round(ST_Distance(a.geom::geography, ' + cbd_sql + '::geography)::numeric)' if cbd else 'NULL'}
                AS cbd_distance_m,
            -- Schools within 1.5km
            (SELECT COUNT(*)::int FROM schools s
             WHERE s.geom && ST_Expand(a.geom, 0.015)
               AND ST_DWithin(s.geom::geography, a.geom::geography, 1500)
            ) AS schools_1500m,
            -- Nearest park distance
            (SELECT round(ST_Distance(pk.geom::geography, a.geom::geography)::numeric)
             FROM park_extents pk
             WHERE pk.geom && ST_Expand(a.geom, 0.01)
               AND ST_DWithin(pk.geom::geography, a.geom::geography, 1000)
             ORDER BY pk.geom <-> a.geom LIMIT 1
            ) AS nearest_park_m,
            -- Noise at this property
            (SELECT nc.laeq24h::int FROM noise_contours nc
             WHERE ST_Intersects(nc.geom, a.geom) ORDER BY nc.laeq24h DESC LIMIT 1
            ) AS noise_db
        FROM addresses a
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    row = cur.fetchone()
    return dict(row) if row else {}


def _location_adjustment(
    prop_value: float | None,
    sa2_value: float | None,
    factor: str,
    label: str,
    max_adj_low: float,
    max_adj_high: float,
    higher_is_better: bool = True,
) -> dict | None:
    """Compute adjustment based on property's deviation from SA2 average.
    Returns an adjustment dict or None if no significant deviation."""
    if prop_value is None or sa2_value is None or sa2_value == 0:
        return None

    # Ratio of property value to SA2 average
    ratio = prop_value / sa2_value

    if higher_is_better:
        # More = better (e.g. transit stops, schools)
        if ratio > 1.5:  # 50%+ better than SA2 avg
            lo, hi = max_adj_low * 0.5, max_adj_high
        elif ratio > 1.2:  # 20-50% better
            lo, hi = max_adj_low * 0.3, max_adj_high * 0.5
        elif ratio < 0.5:  # 50%+ worse
            lo, hi = -max_adj_high, -max_adj_low * 0.5
        elif ratio < 0.8:  # 20-50% worse
            lo, hi = -max_adj_high * 0.5, -max_adj_low * 0.3
        else:
            return None  # Within 20% of average — no adjustment
    else:
        # Less = better (e.g. CBD distance, noise dB)
        if ratio < 0.5:  # Much closer/quieter
            lo, hi = max_adj_low * 0.5, max_adj_high
        elif ratio < 0.8:  # Somewhat closer/quieter
            lo, hi = max_adj_low * 0.3, max_adj_high * 0.5
        elif ratio > 2.0:  # Much further/noisier
            lo, hi = -max_adj_high, -max_adj_low * 0.5
        elif ratio > 1.5:  # Somewhat further/noisier
            lo, hi = -max_adj_high * 0.5, -max_adj_low * 0.3
        else:
            return None

    return {
        "factor": factor,
        "label": label,
        "pct_low": round(lo * 100, 1),
        "pct_high": round(hi * 100, 1),
        "dollar_low": 0,  # filled in later with median
        "dollar_high": 0,
        "reason": "",
        "category": "location",
    }


# ---------------------------------------------------------------------------
# Area context — suburb characteristics that explain the median
# ---------------------------------------------------------------------------

async def _get_area_context(conn, sa2_code: str, ta_name: str) -> list[dict]:
    """Build area context items from mv_sa2_comparisons vs mv_ta_comparisons."""
    cur = await conn.execute(
        "SELECT * FROM mv_sa2_comparisons WHERE sa2_code = %s",
        [sa2_code],
    )
    sa2 = cur.fetchone()

    cur = await conn.execute(
        "SELECT * FROM mv_ta_comparisons WHERE ta_name = %s",
        [ta_name],
    )
    ta = cur.fetchone()

    if not sa2:
        return []

    context: list[dict] = []

    # NZDep (1=least deprived, 10=most deprived)
    if sa2.get("avg_nzdep") is not None:
        nzdep = round(float(sa2["avg_nzdep"]))
        city_nzdep = round(float(ta["avg_nzdep"])) if ta and ta.get("avg_nzdep") else 5
        if nzdep <= 3:
            direction = "up"
            desc = f"NZDep {nzdep} — less deprived than city avg ({city_nzdep})"
        elif nzdep >= 8:
            direction = "down"
            desc = f"NZDep {nzdep} — more deprived than city avg ({city_nzdep})"
        else:
            direction = "neutral"
            desc = f"NZDep {nzdep} — similar to city avg ({city_nzdep})"
        context.append({
            "factor": "deprivation",
            "label": "Deprivation",
            "value": nzdep,
            "city_avg": city_nzdep,
            "max_scale": 10,
            "direction": direction,
            "description": desc,
        })

    # Transit
    if sa2.get("transit_count_400m") is not None:
        tc = sa2["transit_count_400m"]
        city_tc = ta["transit_count_400m"] if ta and ta.get("transit_count_400m") else 0
        if tc >= 10:
            direction = "up"
            desc = f"{tc} stops within 400m — excellent access"
        elif tc >= 3:
            direction = "up"
            desc = f"{tc} stops within 400m — good access"
        elif tc >= 1:
            direction = "neutral"
            desc = f"{tc} stop{'s' if tc > 1 else ''} within 400m — limited access"
        else:
            direction = "down"
            desc = "No transit stops within 400m"
        context.append({
            "factor": "transit",
            "label": "Transit",
            "value": tc,
            "city_avg": city_tc,
            "max_scale": max(20, tc, city_tc or 1),
            "direction": direction,
            "description": desc,
        })

    # Schools
    if sa2.get("school_count_1500m") is not None:
        sc = sa2["school_count_1500m"]
        city_sc = ta["school_count_1500m"] if ta and ta.get("school_count_1500m") else 0
        if sc >= 5:
            direction = "up"
            desc = f"{sc} schools within 1.5km — above average"
        elif sc >= 2:
            direction = "neutral"
            desc = f"{sc} schools within 1.5km"
        else:
            direction = "down"
            desc = f"{sc} school{'s' if sc != 1 else ''} within 1.5km — below average"
        context.append({
            "factor": "schools",
            "label": "Schools",
            "value": sc,
            "city_avg": city_sc,
            "max_scale": max(10, sc, city_sc or 1),
            "direction": direction,
            "description": desc,
        })

    # Noise
    if sa2.get("max_noise_db") is not None:
        noise = sa2["max_noise_db"]
        if noise >= 65:
            direction = "down"
            desc = f"{noise} dB — noisy area"
        elif noise >= 55:
            direction = "neutral"
            desc = f"{noise} dB — moderate noise"
        else:
            direction = "up"
            desc = f"Below 55 dB — quiet area"
            noise = 50  # default for display
        context.append({
            "factor": "noise",
            "label": "Noise",
            "value": noise,
            "city_avg": None,
            "max_scale": 80,
            "direction": direction,
            "description": desc,
        })

    return context


# ---------------------------------------------------------------------------
# Main computation
# ---------------------------------------------------------------------------

async def compute_rent_advice(
    conn,
    address_id: int,
    weekly_rent: int | None,
    dwelling_type: str,
    bedrooms: str,
    finish_tier: str | None = None,
    bathrooms: str | None = None,
    has_parking: bool | None = None,
    has_insulation: bool | None = None,
    is_studio: bool = False,
    is_furnished: bool | None = None,
    is_partially_furnished: bool | None = None,
    has_outdoor_space: bool | None = None,
    is_character_property: bool | None = None,
    shared_kitchen: bool | None = None,
    utilities_included: bool | None = None,
) -> dict | None:
    """Compute personalised rent advice with band output."""

    # 1. SA2 lookup
    cur = await conn.execute(
        """
        SELECT sa2.sa2_code, sa2.sa2_name, sa2.ta_name
        FROM addresses a
        JOIN LATERAL (
            SELECT sa2_code, sa2_name, ta_name
            FROM sa2_boundaries WHERE ST_Within(a.geom, geom) LIMIT 1
        ) sa2 ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    sa2 = cur.fetchone()
    if not sa2:
        return None

    # 2. Baseline median
    baseline = await get_sa2_rental_baseline(
        conn, sa2["sa2_code"], sa2["ta_name"], dwelling_type, bedrooms
    )
    if not baseline:
        return None

    raw_median = baseline["median"]

    # Adjustments: each has (low_adj, high_adj) for the band
    adjustments: list[dict] = []
    factors_available = 27  # total possible factors
    factors_analysed = 0

    # 3. Property data (footprint + CV in one query)
    cur = await conn.execute(
        """
        SELECT
            a.unit_value, a.road_name, a.road_type_name, a.address_number,
            (SELECT round(ST_Area(b.geom::geography)::numeric, 1)
             FROM building_outlines b
             WHERE b.geom && ST_Expand(a.geom, 0.0005)
               AND ST_Contains(b.geom, a.geom) LIMIT 1) AS footprint_m2,
            (SELECT COUNT(*)::int FROM addresses a2
             WHERE a2.gd2000_xcoord = a.gd2000_xcoord
               AND a2.gd2000_ycoord = a.gd2000_ycoord
               AND a2.address_lifecycle = 'Current') AS unit_count,
            cv.capital_value, cv.land_value
        FROM addresses a
        LEFT JOIN LATERAL (
            SELECT capital_value, land_value FROM council_valuations cv
            WHERE ST_Contains(cv.geom, a.geom) LIMIT 1
        ) cv ON true
        WHERE a.address_id = %s
        """,
        [address_id],
    )
    prop = cur.fetchone()

    # For units, always try wcc_rates_cache — spatial match can return
    # a random unit's CV (e.g. parking space) instead of the actual unit
    if prop and prop.get("unit_value"):
        prop = dict(prop)  # make mutable
        rates_cv = await _get_unit_cv_from_rates(conn, prop)
        if rates_cv:
            prop["capital_value"] = rates_cv["capital_value"]
            prop["land_value"] = rates_cv["land_value"]

    # --- Property-specific adjustments (always full weight) ---

    # Studio vs 1-bed: bond data lumps both under "1 bed", so median is blended.
    # Studio = smaller (no separate bedroom) → discount.
    # True 1-bed = separate bedroom → slight premium over the blended median.
    if is_studio:
        factors_analysed += 1
        adjustments.append({
            "factor": "studio",
            "label": "Studio (no separate bedroom)",
            "pct_low": -8.0,
            "pct_high": -4.0,
            "dollar_low": round(raw_median * -0.08),
            "dollar_high": round(raw_median * -0.04),
            "reason": "Smaller than a 1-bed — compared to 1-bed bond data",
            "category": "property",
        })
    elif bedrooms == "1":
        factors_analysed += 1
        adjustments.append({
            "factor": "1bed_premium",
            "label": "Separate bedroom",
            "pct_low": 1.0,
            "pct_high": 3.0,
            "dollar_low": round(raw_median * 0.01),
            "dollar_high": round(raw_median * 0.03),
            "reason": "1-bed median includes studios — separate bedroom adds value",
            "category": "property",
        })

    # Townhouse / multi-unit discount — when user selects "House" but the
    # address is a unit (e.g. 1/45 Smith St, 9A Hollies Crescent), the bond
    # "House" median includes standalones which rent higher.
    is_multi_unit = (prop["unit_count"] or 1) > 1 if prop else False

    # Also detect A/B/C style subdivisions from the address itself
    if not is_multi_unit and prop:
        import re
        unit_val = prop.get("unit_value")
        addr_num = str(prop.get("address_number") or "")
        # Match "9A", "12B", "45C" style address numbers OR unit_value is set
        if unit_val or re.match(r"^\d+[A-Za-z]$", addr_num):
            is_multi_unit = True

    if is_multi_unit and dwelling_type == "House":
        factors_analysed += 1
        lo, hi = -0.06, -0.03
        adjustments.append({
            "factor": "townhouse",
            "label": "Townhouse / terraced (not standalone)",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": f"Unit {prop['unit_count'] or '?'}-unit building — 'House' median includes higher-value standalones",
            "category": "property",
        })

    # Size (skip for multi-unit — building footprint ≠ unit size, and we
    # don't have floor count or unit floor area data)
    if prop and prop["footprint_m2"] and not is_multi_unit:
        factors_analysed += 1
        footprint = float(prop["footprint_m2"])
        typical = TYPICAL_FOOTPRINT.get(dwelling_type, 140)
        if typical > 0:
            ratio = (footprint - typical) / typical
            adj_low = _clamp(ratio * 0.3, -0.03, 0.10)
            adj_high = _clamp(ratio * 0.5, -0.08, 0.20)
            if adj_low > adj_high:
                adj_low, adj_high = adj_high, adj_low
            if abs(adj_high) >= 0.01:
                adjustments.append({
                    "factor": "size",
                    "label": "Property size",
                    "pct_low": round(adj_low * 100, 1),
                    "pct_high": round(adj_high * 100, 1),
                    "dollar_low": round(raw_median * adj_low),
                    "dollar_high": round(raw_median * adj_high),
                    "reason": f"{round(footprint)}m² vs typical {typical}m²",
                    "category": "property",
                })

    # Quality: improvement value per room vs SA2 average.
    # Houses: (capital - land) / rooms. Apartments: capital / rooms (land=0 for units).
    if prop and prop["capital_value"]:
        cap = float(prop["capital_value"])
        land = float(prop["land_value"]) if prop["land_value"] else 0
        imp = cap - land  # improvements = CV minus land (works for both houses and units)
        beds_num = int(bedrooms.replace("+", "")) if bedrooms != "ALL" else 3
        baths_num = int(bathrooms.replace("+", "")) if bathrooms else 1
        rooms = beds_num + baths_num

        if imp > 0 and rooms > 0:
            imp_per_room = imp / rooms

            # SA2 median: for houses compare improvements, for units compare CV
            if is_multi_unit:
                # Compare unit CV/room to SA2 median unit CV/room
                # Filter to units (land_value = 0 or NULL) in the SA2
                sa2_query = """
                    SELECT percentile_cont(0.5) WITHIN GROUP (
                        ORDER BY cv.capital_value
                    ) AS median_val
                    FROM council_valuations cv, sa2_boundaries sa2
                    WHERE ST_Contains(sa2.geom, cv.geom)
                      AND sa2.sa2_code = %s
                      AND cv.capital_value > 0
                      AND (cv.land_value = 0 OR cv.land_value IS NULL)
                """
            else:
                # Compare house improvement/room to SA2 median improvement/room
                sa2_query = """
                    SELECT percentile_cont(0.5) WITHIN GROUP (
                        ORDER BY (cv.capital_value - cv.land_value)
                    ) AS median_val
                    FROM council_valuations cv, sa2_boundaries sa2
                    WHERE ST_Contains(sa2.geom, cv.geom)
                      AND sa2.sa2_code = %s
                      AND cv.capital_value > cv.land_value
                      AND cv.land_value > 0
                """

            cur = await conn.execute(sa2_query, [sa2["sa2_code"]])
            sa2_row = cur.fetchone()
            if sa2_row and sa2_row["median_val"]:
                # Typical rooms: 4 for houses (3-bed 1-bath), 3 for units (2-bed 1-bath)
                typical_rooms = 3 if is_multi_unit else 4
                sa2_per_room = float(sa2_row["median_val"]) / typical_rooms
                if sa2_per_room > 0:
                    factors_analysed += 1
                    ratio = imp_per_room / sa2_per_room
                    if ratio > 1.3:
                        adj_low = _clamp((ratio - 1) * 0.1, 0.01, 0.04)
                        adj_high = _clamp((ratio - 1) * 0.2, 0.02, 0.08)
                        adjustments.append({
                            "factor": "quality",
                            "label": "Above-average build",
                            "pct_low": round(adj_low * 100, 1),
                            "pct_high": round(adj_high * 100, 1),
                            "dollar_low": round(raw_median * adj_low),
                            "dollar_high": round(raw_median * adj_high),
                            "reason": f"${round(imp_per_room/1000)}K/room vs area ${round(sa2_per_room/1000)}K",
                            "category": "property",
                        })
                    elif ratio < 0.7:
                        adj_low = _clamp((ratio - 1) * 0.2, -0.08, -0.02)
                        adj_high = _clamp((ratio - 1) * 0.1, -0.04, -0.01)
                        adjustments.append({
                            "factor": "quality",
                            "label": "Below-average build",
                            "pct_low": round(adj_low * 100, 1),
                            "pct_high": round(adj_high * 100, 1),
                            "dollar_low": round(raw_median * adj_low),
                            "dollar_high": round(raw_median * adj_high),
                            "reason": f"${round(imp_per_room/1000)}K/room vs area ${round(sa2_per_room/1000)}K",
                            "category": "property",
                        })

    # Finish tier
    if finish_tier and finish_tier in FINISH_TIERS:
        factors_analysed += 1
        lo, hi = FINISH_TIERS[finish_tier]
        if abs(hi) >= 0.01 or abs(lo) >= 0.01:
            adjustments.append({
                "factor": "finish",
                "label": "Finish & condition",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": f"{finish_tier.capitalize()} tier",
                "category": "property",
            })

    # Bathrooms (bedroom-aware baseline)
    bath_key = (bedrooms, bathrooms) if bathrooms else None
    if bath_key and bath_key in BATHROOM_ADJ:
        factors_analysed += 1
        lo, hi = BATHROOM_ADJ[bath_key]
        if abs(lo) >= 0.005 or abs(hi) >= 0.005:
            typical = "1" if bedrooms in ("1", "2") else "2"
            if lo >= 0:
                reason = f"{bathrooms} bath — above typical ({typical}) for {bedrooms}-bed"
            else:
                reason = f"{bathrooms} bath — below typical ({typical}) for {bedrooms}-bed"
            adjustments.append({
                "factor": "bathrooms",
                "label": f"{bathrooms} bathroom{'s' if bathrooms != '1' else ''}",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": reason,
                "category": "property",
            })

    # Parking (flats/apartments only)
    # Note: bond data mixes tenancies with/without parking, so the median
    # already partially reflects parking. Adjustment captures the delta.
    if has_parking is not None and dwelling_type in ("Flat", "Apartment"):
        factors_analysed += 1
        if has_parking:
            lo, hi = 0.01, 0.03
        else:
            lo, hi = -0.03, -0.01
        adjustments.append({
            "factor": "parking",
            "label": "Parking included" if has_parking else "No parking",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": "Median includes a mix of with/without",
            "category": "property",
        })

    # Insulation — legally required since July 2025 (Healthy Homes Standards),
    # so insulated is the baseline (0%). Only adjust down if NOT insulated.
    if has_insulation is not None:
        factors_analysed += 1
        if not has_insulation:
            lo, hi = -0.04, -0.02
            adjustments.append({
                "factor": "insulation",
                "label": "Not insulated",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": "Below Healthy Homes standard",
                "category": "property",
            })

    # Furnished vs unfurnished — bond data mixes both, so median is blended.
    # Furnished = premium over blend, unfurnished = discount vs blend.
    # Partially furnished (appliances only) = small premium.
    if is_partially_furnished:
        factors_analysed += 1
        lo, hi = -0.01, 0.02
        adjustments.append({
            "factor": "furnished",
            "label": "Partially furnished (appliances)",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": "Includes whiteware/appliances but not full furnishing",
            "category": "property",
        })
    elif is_furnished is not None:
        factors_analysed += 1
        if is_furnished:
            lo, hi = 0.03, 0.08
        else:
            lo, hi = -0.05, -0.02
        adjustments.append({
            "factor": "furnished",
            "label": "Furnished" if is_furnished else "Unfurnished",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": "Median includes a mix of furnished/unfurnished",
            "category": "property",
        })

    # Private outdoor space — rare for apartments, adds premium
    if has_outdoor_space and dwelling_type in ("Flat", "Apartment"):
        factors_analysed += 1
        lo, hi = 0.02, 0.05
        adjustments.append({
            "factor": "outdoor_space",
            "label": "Private outdoor space",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": "Deck/balcony/courtyard — uncommon for apartments",
            "category": "property",
        })

    # Character property — unique architectural features command a premium
    if is_character_property:
        factors_analysed += 1
        lo, hi = 0.03, 0.07
        adjustments.append({
            "factor": "character",
            "label": "Character property",
            "pct_low": round(lo * 100, 1),
            "pct_high": round(hi * 100, 1),
            "dollar_low": round(raw_median * lo),
            "dollar_high": round(raw_median * hi),
            "reason": "Distinctive architectural features, heritage character, or unique design",
            "category": "property",
        })

    # Shared kitchen — most rentals have own kitchen, so shared is a discount
    if shared_kitchen is not None:
        factors_analysed += 1
        if shared_kitchen:
            lo, hi = -0.10, -0.05
            adjustments.append({
                "factor": "shared_kitchen",
                "label": "Shared kitchen",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": "Most rentals include own kitchen — shared reduces value",
                "category": "property",
            })

    # Utilities included — bond data is mostly rent-only, so utilities-included
    # rentals appear higher than the median. Rent-only is the baseline.
    if utilities_included is not None:
        factors_analysed += 1
        if utilities_included:
            lo, hi = 0.04, 0.10
            adjustments.append({
                "factor": "utilities_included",
                "label": "Utilities included",
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": "Rent includes power/water/internet — most bond data is rent-only",
                "category": "property",
            })

    # --- Hazard adjustments (scaled by prevalence) ---

    hazards = await _detect_hazards(conn, address_id)
    detected_keys: set[str] = set()

    # Map hazard detection results to keys
    if hazards.get("flood_zone"):
        detected_keys.add("flood")
    if hazards.get("liquefaction") and hazards["liquefaction"] in ("High", "Very High"):
        detected_keys.add("liquefaction")
    if hazards.get("tsunami_zone"):
        detected_keys.add("tsunami")
    if hazards.get("epb_self_count") and hazards["epb_self_count"] > 0:
        detected_keys.add("epb_self")
    elif hazards.get("epb_nearby_count") and hazards["epb_nearby_count"] > 0:
        detected_keys.add("epb_nearby")
    if hazards.get("contam_count") and hazards["contam_count"] > 0:
        detected_keys.add("contamination")
    if hazards.get("on_overland_flow"):
        detected_keys.add("overland_flow")
    if hazards.get("slope_failure") and str(hazards["slope_failure"]).startswith("5"):
        detected_keys.add("slope_failure")
    if hazards.get("noise_db") and hazards["noise_db"] >= 65:
        detected_keys.add("noise_high")
    if hazards.get("aircraft_noise_dba") and hazards["aircraft_noise_dba"] >= 60:
        detected_keys.add("aircraft_noise")
    wz = hazards.get("wind_zone") or ""
    if any(wz.startswith(p) for p in ("VH", "EH", "SED", "Very high", "High Risk")):
        detected_keys.add("wind_high")
    if hazards.get("coastal_erosion_nearby"):
        detected_keys.add("coastal_erosion")

    # Compute prevalence for detected hazards
    prevalence = await _compute_prevalence(conn, sa2["sa2_code"], detected_keys) if detected_keys else {}

    # Build area_wide list for context section
    area_wide_hazards: list[dict] = []

    for key in sorted(detected_keys):
        factors_analysed += 1
        cfg = HAZARD_ADJ.get(key)
        if not cfg:
            continue

        prev = prevalence.get(key, 0.0)
        scale = _prevalence_scale(prev)
        prev_pct = round(prev * 100)

        if scale == 0.0:
            # Area-wide: add to context section instead of adjustments
            area_wide_hazards.append({
                "factor": key,
                "label": cfg["label"],
                "prevalence_pct": prev_pct,
                "description": f"{cfg['label']} — area-wide ({prev_pct}% of properties), already reflected in local rents",
            })
        else:
            # Apply scaled adjustment
            lo = cfg["low"] * scale
            hi = cfg["high"] * scale
            reason = cfg["label"]
            if prev_pct > 0:
                reason += f" ({prev_pct}% of area)"
            adjustments.append({
                "factor": key,
                "label": cfg["label"],
                "pct_low": round(lo * 100, 1),
                "pct_high": round(hi * 100, 1),
                "dollar_low": round(raw_median * lo),
                "dollar_high": round(raw_median * hi),
                "reason": reason,
                "category": "hazard",
                "prevalence_pct": prev_pct,
            })

    # --- Location adjustments (property vs SA2 average) ---

    loc = await _get_location_metrics(conn, address_id, sa2["ta_name"])

    # Get SA2 comparison values
    cur = await conn.execute(
        "SELECT * FROM mv_sa2_comparisons WHERE sa2_code = %s", [sa2["sa2_code"]]
    )
    sa2_comp = cur.fetchone()

    if loc and sa2_comp:
        # Transit stops (more = better)
        prop_transit = loc.get("transit_stops_400m")
        sa2_transit = sa2_comp.get("transit_count_400m")
        if prop_transit is not None and sa2_transit is not None and sa2_transit > 0:
            factors_analysed += 1
            adj = _location_adjustment(
                prop_transit, sa2_transit, "transit",
                "Transit access", 0.01, 0.03, higher_is_better=True,
            )
            if adj:
                adj["dollar_low"] = round(raw_median * adj["pct_low"] / 100)
                adj["dollar_high"] = round(raw_median * adj["pct_high"] / 100)
                ratio = prop_transit / sa2_transit
                if ratio > 1.2:
                    adj["reason"] = f"{prop_transit} stops vs area avg {sa2_transit}"
                else:
                    adj["reason"] = f"{prop_transit} stops vs area avg {sa2_transit}"
                adjustments.append(adj)

        # CBD distance (less = better)
        prop_cbd = loc.get("cbd_distance_m")
        if prop_cbd is not None:
            factors_analysed += 1
            # SA2 centroid CBD distance — compute from SA2 centroid
            cur2 = await conn.execute(
                """
                SELECT round(ST_Distance(
                    ST_Centroid(s.geom)::geography,
                    ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
                )::numeric) AS sa2_cbd_m
                FROM sa2_boundaries s WHERE s.sa2_code = %s
                """,
                [*_get_cbd_point(sa2["ta_name"]), sa2["sa2_code"]],
            )
            sa2_cbd_row = cur2.fetchone()
            sa2_cbd = float(sa2_cbd_row["sa2_cbd_m"]) if sa2_cbd_row and sa2_cbd_row["sa2_cbd_m"] else None
            if sa2_cbd and sa2_cbd > 0:
                adj = _location_adjustment(
                    float(prop_cbd), sa2_cbd, "cbd_distance",
                    "CBD distance", 0.01, 0.03, higher_is_better=False,
                )
                if adj:
                    adj["dollar_low"] = round(raw_median * adj["pct_low"] / 100)
                    adj["dollar_high"] = round(raw_median * adj["pct_high"] / 100)
                    prop_km = round(float(prop_cbd) / 1000, 1)
                    sa2_km = round(sa2_cbd / 1000, 1)
                    adj["reason"] = f"{prop_km}km vs area avg {sa2_km}km"
                    adjustments.append(adj)

        # Schools (more = better)
        prop_schools = loc.get("schools_1500m")
        sa2_schools = sa2_comp.get("school_count_1500m")
        if prop_schools is not None and sa2_schools is not None and sa2_schools > 0:
            factors_analysed += 1
            adj = _location_adjustment(
                prop_schools, sa2_schools, "schools",
                "School proximity", 0.005, 0.015, higher_is_better=True,
            )
            if adj:
                adj["dollar_low"] = round(raw_median * adj["pct_low"] / 100)
                adj["dollar_high"] = round(raw_median * adj["pct_high"] / 100)
                adj["reason"] = f"{prop_schools} schools vs area avg {sa2_schools}"
                adjustments.append(adj)

        # Nearest park (less = better)
        prop_park = loc.get("nearest_park_m")
        if prop_park is not None:
            factors_analysed += 1
            # Positive adjustment for being very close to a park
            park_m = float(prop_park)
            if park_m < 200:
                adjustments.append({
                    "factor": "park",
                    "label": "Near park",
                    "pct_low": 0.5,
                    "pct_high": 1.5,
                    "dollar_low": round(raw_median * 0.005),
                    "dollar_high": round(raw_median * 0.015),
                    "reason": f"Park within {round(park_m)}m",
                    "category": "location",
                })
            elif park_m > 800:
                adjustments.append({
                    "factor": "park",
                    "label": "Far from parks",
                    "pct_low": -1.0,
                    "pct_high": -0.5,
                    "dollar_low": round(raw_median * -0.01),
                    "dollar_high": round(raw_median * -0.005),
                    "reason": f"Nearest park {round(park_m)}m away",
                    "category": "location",
                })

        # Nearest rail (big premium if very close)
        prop_rail = loc.get("nearest_rail_m")
        if prop_rail is not None:
            factors_analysed += 1
            rail_m = float(prop_rail)
            if rail_m < 500:
                adjustments.append({
                    "factor": "rail",
                    "label": "Near rail station",
                    "pct_low": 1.0,
                    "pct_high": 3.0,
                    "dollar_low": round(raw_median * 0.01),
                    "dollar_high": round(raw_median * 0.03),
                    "reason": f"Rail station {round(rail_m)}m away",
                    "category": "location",
                })

    # --- Compute band ---
    product_low = 1.0
    product_high = 1.0
    for adj in adjustments:
        product_low *= 1 + adj["pct_low"] / 100
        product_high *= 1 + adj["pct_high"] / 100

    # Widen the inner band by 1% each side for natural variance
    band_low = round(raw_median * min(product_low, product_high) * 0.99)
    band_high = round(raw_median * max(product_low, product_high) * 1.01)

    # --- Verdict (relative to band) ---
    if weekly_rent is None:
        verdict = None
        diff_pct = None
    elif weekly_rent < band_low:
        diff_below = band_low - weekly_rent
        diff_pct = -round(diff_below / band_low * 100, 1)
        verdict = "below-market"
    elif weekly_rent <= band_high:
        mid = (band_low + band_high) / 2
        diff_pct = round((weekly_rent - mid) / mid * 100, 1)
        verdict = "fair"
    else:
        diff_above_pct = (weekly_rent - band_high) / band_high * 100
        diff_pct = round(diff_above_pct, 1)
        if diff_above_pct <= 10:
            verdict = "slightly-high"
        elif diff_above_pct <= 20:
            verdict = "high"
        else:
            verdict = "very-high"

    # --- Area context ---
    area_context = await _get_area_context(conn, sa2["sa2_code"], sa2["ta_name"])

    # Add area-wide hazards to context
    for awh in area_wide_hazards:
        area_context.append({
            "factor": awh["factor"],
            "label": awh["label"],
            "value": awh["prevalence_pct"],
            "city_avg": None,
            "max_scale": 100,
            "direction": "down",
            "description": awh["description"],
            "is_area_wide_hazard": True,
        })

    # Outer band: ±3% deviation buffer beyond the inner band
    band_low_outer = round(band_low * 0.97)
    band_high_outer = round(band_high * 1.03)

    # --- Advice lines ---
    if verdict and weekly_rent is not None:
        advice_lines = _generate_advice(
            verdict, diff_pct, weekly_rent, band_low, band_high,
            band_low_outer, band_high_outer, raw_median, adjustments
        )
    else:
        advice_lines = [
            f"Fair rent range for this property: ${band_low}–${band_high}/wk "
            f"(possible range ${band_low_outer}–${band_high_outer}/wk)."
        ]

    # --- Confidence ---
    stars = market_confidence_stars(baseline["bond_count"], None, None)

    # Sort adjustments: hazards first, then location, then property features
    cat_order = {"hazard": 0, "location": 1, "property": 2}
    adjustments.sort(key=lambda a: (cat_order.get(a.get("category", ""), 3), -abs(a["pct_high"])))

    return {
        "verdict": verdict,
        "band_low": band_low,
        "band_high": band_high,
        "band_low_outer": band_low_outer,
        "band_high_outer": band_high_outer,
        "raw_median": round(raw_median),
        "your_rent": weekly_rent,
        "difference_pct": diff_pct,
        "adjustments": adjustments,
        "area_context": area_context,
        "factors_analysed": factors_analysed,
        "factors_available": factors_available,
        "advice_lines": advice_lines,
        "confidence": stars,
        "bond_count": baseline["bond_count"],
        "data_source": baseline["data_source"],
        "sa2_name": sa2["sa2_name"],
        "disclaimer": (
            "This estimate is based on MBIE bond records, council valuation data, "
            "and hazard overlays. It is not a registered valuation or market assessment. "
            "Actual market rents depend on specific property features, condition, "
            "and local demand."
        ),
    }


def _generate_advice(
    verdict: str,
    diff_pct: float,
    weekly_rent: int,
    band_low: int,
    band_high: int,
    band_low_outer: int,
    band_high_outer: int,
    raw_median: int,
    adjustments: list[dict],
) -> list[str]:
    """Generate template-based advice lines referencing the band."""
    lines: list[str] = []

    in_possible = band_low_outer <= weekly_rent <= band_high_outer

    if verdict == "below-market":
        line = (
            f"Your rent of ${weekly_rent}/wk is below our estimated fair range "
            f"of ${band_low}–${band_high}/wk"
        )
        if in_possible:
            line += f", but within the possible range (${band_low_outer}–${band_high_outer}/wk) — you're getting good value."
        else:
            line += " — you're getting good value."
        lines.append(line)
    elif verdict == "fair":
        lines.append(
            f"Your rent of ${weekly_rent}/wk is within our estimated fair range "
            f"of ${band_low}–${band_high}/wk — this looks reasonable."
        )
    elif verdict == "slightly-high":
        above = weekly_rent - band_high
        line = (
            f"Your rent of ${weekly_rent}/wk is ${above}/wk above our estimated "
            f"fair range of ${band_low}–${band_high}/wk"
        )
        if in_possible:
            line += f", but within the possible range (${band_low_outer}–${band_high_outer}/wk)."
        else:
            line += "."
        lines.append(line)
    elif verdict in ("high", "very-high"):
        above = weekly_rent - band_high
        lines.append(
            f"Your rent of ${weekly_rent}/wk is ${above}/wk above our estimated "
            f"fair range of ${band_low}–${band_high}/wk. This is significantly "
            f"above what we'd expect for this property."
        )

    # Top 2 adjustments by magnitude
    sorted_adj = sorted(adjustments, key=lambda a: abs(a["pct_high"]), reverse=True)[:2]
    if sorted_adj:
        parts = []
        for adj in sorted_adj:
            parts.append(f"{adj['label'].lower()} ({adj['pct_low']}% to {adj['pct_high']}%)")
        lines.append(f"Key factors: {', '.join(parts)}.")

    if verdict in ("high", "very-high"):
        lines.append(
            "You may want to check Tenancy Services (tenancy.govt.nz) for guidance "
            "on market rent reviews and your rights as a tenant."
        )

    return lines

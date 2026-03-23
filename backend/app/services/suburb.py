from __future__ import annotations
# backend/app/services/suburb.py
from .. import db


async def search_suburbs(query: str, limit: int = 8) -> list[dict]:
    """Search SA2 suburbs by name. Fast ILIKE prefix first, trigram fallback."""
    async with db.pool.connection() as conn:
        # Try fast prefix match first
        cur = await conn.execute(
            """
            SELECT sa2_code, sa2_name, ta_name,
                   ST_X(ST_Centroid(ST_Transform(geom, 4326))) AS lng,
                   ST_Y(ST_Centroid(ST_Transform(geom, 4326))) AS lat
            FROM sa2_boundaries
            WHERE sa2_name ILIKE %s
            ORDER BY sa2_name
            LIMIT %s
            """,
            [f"{query}%", limit],
        )
        results = cur.fetchall()
        if results:
            return results

        # Fallback: contains match (still indexed via pg_trgm GIN)
        cur = await conn.execute(
            """
            SELECT sa2_code, sa2_name, ta_name,
                   ST_X(ST_Centroid(ST_Transform(geom, 4326))) AS lng,
                   ST_Y(ST_Centroid(ST_Transform(geom, 4326))) AS lat
            FROM sa2_boundaries
            WHERE sa2_name ILIKE %s
            ORDER BY sa2_name
            LIMIT %s
            """,
            [f"%{query}%", limit],
        )
        return cur.fetchall()


async def get_suburb_summary(sa2_code: str) -> dict | None:
    """Gather suburb summary in two queries instead of eight.

    Query 1: basic info + property count + comparisons + crime + area profile
             (single connection, multiple statements)
    Query 2: rental data (market + trends in one query via UNION-like approach)
    """
    async with db.pool.connection() as conn:
        # -- Query 1: basic info with pre-computed area --
        cur = await conn.execute(
            """
            SELECT sa2_code, sa2_name, ta_name,
                   ST_Area(geom::geography) / 10000 AS area_hectares
            FROM sa2_boundaries
            WHERE sa2_code = %s
            LIMIT 1
            """,
            [sa2_code],
        )
        basic = cur.fetchone()
        if not basic:
            return None

        ta_name = basic.get("ta_name", "")

        # -- Property count via spatial join (uses GIST indexes on both tables) --
        cur = await conn.execute(
            """
            SELECT COUNT(*) AS cnt
            FROM addresses a
            JOIN sa2_boundaries s ON ST_Within(a.geom, s.geom)
            WHERE s.sa2_code = %s
              AND a.address_lifecycle = 'Current'
            """,
            [sa2_code],
        )
        count_row = cur.fetchone()
        property_count = count_row["cnt"] if count_row else 0

        # -- SA2 comparisons --
        cur = await conn.execute(
            "SELECT * FROM mv_sa2_comparisons WHERE sa2_code = %s LIMIT 1",
            [sa2_code],
        )
        comparisons = cur.fetchone()

        # -- City averages --
        city_avg = None
        if ta_name:
            cur = await conn.execute(
                """
                SELECT ta_name,
                       avg_nzdep,
                       avg_school_count_1500m AS school_count_1500m,
                       avg_transit_count_400m AS transit_count_400m,
                       avg_noise_db AS max_noise_db,
                       avg_epb_count_300m AS epb_count_300m
                FROM mv_ta_comparisons WHERE ta_name = %s LIMIT 1
                """,
                [ta_name],
            )
            city_avg = cur.fetchone()

        # -- Crime --
        crime = None
        if ta_name:
            cur = await conn.execute(
                """
                SELECT ta, victimisations_3yr, avg_victimisations_per_au
                FROM mv_crime_ta WHERE ta = %s LIMIT 1
                """,
                [ta_name],
            )
            row = cur.fetchone()
            if row:
                crime = {
                    "ta_name": ta_name,
                    "total_offences": row["victimisations_3yr"],
                    "offence_rate_per_10k": round(float(row["avg_victimisations_per_au"] or 0), 1),
                }

        # -- Area profile --
        cur = await conn.execute(
            "SELECT profile FROM area_profiles WHERE sa2_code = %s LIMIT 1",
            [sa2_code],
        )
        profile_row = cur.fetchone()
        area_profile = profile_row["profile"] if profile_row else None

        # -- Rental overview --
        cur = await conn.execute(
            """
            SELECT dwelling_type,
                   number_of_beds AS bedrooms,
                   median_rent,
                   total_bonds AS bond_count,
                   lower_quartile_rent AS lower_quartile,
                   upper_quartile_rent AS upper_quartile
            FROM mv_rental_market
            WHERE sa2_code = %s
            ORDER BY dwelling_type, number_of_beds
            """,
            [sa2_code],
        )
        rentals = cur.fetchall()

        # -- Rental trends --
        cur = await conn.execute(
            """
            SELECT dwelling_type,
                   number_of_beds AS bedrooms,
                   yoy_pct / 100.0 AS cagr_1yr,
                   cagr_5yr / 100.0 AS cagr_5yr,
                   cagr_10yr / 100.0 AS cagr_10yr
            FROM mv_rental_trends
            WHERE sa2_code = %s
            ORDER BY dwelling_type, number_of_beds
            """,
            [sa2_code],
        )
        rental_trends = cur.fetchall()

    return {
        **basic,
        "property_count": property_count,
        "comparisons": comparisons,
        "city_averages": city_avg,
        "rental_overview": rentals,
        "rental_trends": rental_trends,
        "crime": crime,
        "area_profile": area_profile,
    }

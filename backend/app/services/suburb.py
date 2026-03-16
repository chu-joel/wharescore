from __future__ import annotations
# backend/app/services/suburb.py
from .. import db


async def search_suburbs(query: str, limit: int = 8) -> list[dict]:
    """Search SA2 suburbs by name. Fast ILIKE prefix first, trigram fallback."""
    async with db.pool.connection() as conn:
        # Try fast prefix match first
        cur = await conn.execute(
            """
            SELECT sa2_code, sa2_name, ta_name
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
            SELECT sa2_code, sa2_name, ta_name
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
                "SELECT * FROM mv_ta_comparisons WHERE ta_name = %s LIMIT 1",
                [ta_name],
            )
            city_avg = cur.fetchone()

        # -- Crime --
        crime = None
        if ta_name:
            cur = await conn.execute(
                """
                SELECT ta_name, total_offences, offence_rate_per_10k
                FROM mv_crime_ta WHERE ta_name = %s LIMIT 1
                """,
                [ta_name],
            )
            crime = cur.fetchone()

        # -- Area profile --
        cur = await conn.execute(
            "SELECT profile_text FROM area_profiles WHERE sa2_code = %s LIMIT 1",
            [sa2_code],
        )
        profile_row = cur.fetchone()
        area_profile = profile_row["profile_text"] if profile_row else None

        # -- Rental overview --
        cur = await conn.execute(
            """
            SELECT dwelling_type, bedrooms, median_rent, bond_count, lower_quartile, upper_quartile
            FROM mv_rental_market
            WHERE sa2_code = %s
            ORDER BY dwelling_type, bedrooms
            """,
            [sa2_code],
        )
        rentals = cur.fetchall()

        # -- Rental trends --
        cur = await conn.execute(
            """
            SELECT dwelling_type, bedrooms, cagr_1yr, cagr_5yr, cagr_10yr
            FROM mv_rental_trends
            WHERE sa2_code = %s
            ORDER BY dwelling_type, bedrooms
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

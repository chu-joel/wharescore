# backend/app/routers/rates.py
"""Live council rates endpoint. supports all 25 councils.

Returns current_valuation (CV/LV/IV) and rates breakdown for a property.
Used by the frontend to lazily enrich the DB-sourced CV after page load.
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, HTTPException, Request

from .. import db
from ..deps import limiter

router = APIRouter()
logger = logging.getLogger(__name__)


async def _fetch_rates_for_address(full_address: str, city: str, address_id: int, conn) -> dict | None:
    """Route to the correct council rates API based on city. Returns rates dict or None."""
    city_lower = city.lower()

    try:
        if "wellington" in city_lower:
            # Wellington: check unit_value for per-unit CV lookup
            cur = await conn.execute(
                "SELECT unit_value, address_number, road_name, road_type_name FROM addresses WHERE address_id = %s",
                [address_id],
            )
            addr_row = cur.fetchone()
            if addr_row and addr_row.get("unit_value"):
                uv = addr_row["unit_value"]
                street = f"{addr_row.get('address_number', '')} {addr_row.get('road_name', '')}"
                if addr_row.get("road_type_name"):
                    street += f" {addr_row['road_type_name']}"
                street = street.strip()
                if street:
                    cur2 = await conn.execute(
                        "SELECT capital_value, land_value, improvements_value FROM wcc_rates_cache "
                        "WHERE capital_value > 0 AND (address ILIKE %s OR address ILIKE %s OR address ILIKE %s) LIMIT 1",
                        [f"Unit {uv} {street}%", f"Apt {uv} {street}%", f"Flat {uv} {street}%"],
                    )
                    row = cur2.fetchone()
                    if row:
                        return {
                            "current_valuation": {
                                "capital_value": row["capital_value"],
                                "land_value": row["land_value"] or 0,
                                "improvements_value": row["improvements_value"] or 0,
                            }
                        }
            # Fall through to WCC live API for non-unit Wellington properties
            from ..services.rates import fetch_wcc_rates
            return await fetch_wcc_rates(full_address, conn)

        elif "auckland" in city_lower:
            from ..services.auckland_rates import fetch_auckland_rates
            return await fetch_auckland_rates(full_address, conn)

        elif city_lower == "lower hutt":
            from ..services.hcc_rates import fetch_hcc_rates
            return await fetch_hcc_rates(full_address)

        elif "upper hutt" in city_lower:
            from ..services.uhcc_rates import fetch_uhcc_rates
            return await fetch_uhcc_rates(full_address)

        elif city_lower == "porirua":
            from ..services.pcc_rates import fetch_pcc_rates
            return await fetch_pcc_rates(full_address)

        elif "kapiti" in city_lower or city_lower in ("paraparaumu", "waikanae", "otaki"):
            from ..services.kcdc_rates import fetch_kcdc_rates
            return await fetch_kcdc_rates(full_address)

        elif "hamilton" in city_lower:
            from ..services.hamilton_rates import fetch_hamilton_rates
            return await fetch_hamilton_rates(full_address)

        elif "dunedin" in city_lower:
            from ..services.dcc_rates import fetch_dcc_rates
            return await fetch_dcc_rates(full_address)

        elif "christchurch" in city_lower:
            from ..services.ccc_rates import fetch_ccc_rates
            return await fetch_ccc_rates(full_address, conn)

        elif city_lower == "new plymouth":
            from ..services.taranaki_rates import fetch_taranaki_rates
            return await fetch_taranaki_rates(full_address)

        elif city_lower in ("richmond", "motueka", "takaka", "mapua"):
            from ..services.tasman_rates import fetch_tasman_rates
            return await fetch_tasman_rates(full_address)

        elif "tauranga" in city_lower or city_lower == "mount maunganui":
            from ..services.tcc_rates import fetch_tcc_rates
            return await fetch_tcc_rates(full_address)

        elif city_lower in ("katikati", "te puke", "waihi beach", "ōmokoroa", "omoroa", "paengaroa") or "western bay" in city_lower:
            from ..services.wbop_rates import fetch_wbop_rates
            return await fetch_wbop_rates(full_address)

        elif "palmerston" in city_lower:
            from ..services.pncc_rates import fetch_pncc_rates
            return await fetch_pncc_rates(full_address)

        elif "whangarei" in city_lower or "whangārei" in city_lower:
            from ..services.wdc_rates import fetch_wdc_rates
            return await fetch_wdc_rates(full_address)

        elif "queenstown" in city_lower or city_lower in ("wanaka", "arrowtown", "frankton"):
            from ..services.qldc_rates import fetch_qldc_rates
            return await fetch_qldc_rates(full_address)

        elif "invercargill" in city_lower:
            from ..services.icc_rates import fetch_icc_rates
            return await fetch_icc_rates(full_address)

        elif "hastings" in city_lower or city_lower in ("havelock north", "flaxmere"):
            from ..services.hastings_rates import fetch_hastings_rates
            return await fetch_hastings_rates(full_address)

        elif "gisborne" in city_lower:
            from ..services.gdc_rates import fetch_gdc_rates
            return await fetch_gdc_rates(full_address)

        elif "nelson" in city_lower:
            from ..services.ncc_rates import fetch_ncc_rates
            return await fetch_ncc_rates(full_address)

        elif "rotorua" in city_lower:
            from ..services.rlc_rates import fetch_rlc_rates
            return await fetch_rlc_rates(full_address)

        elif "timaru" in city_lower or city_lower in ("temuka", "geraldine"):
            from ..services.timaru_rates import fetch_timaru_rates
            return await fetch_timaru_rates(full_address)

        elif "blenheim" in city_lower or "marlborough" in city_lower or city_lower in ("picton", "renwick"):
            from ..services.mdc_rates import fetch_mdc_rates
            return await fetch_mdc_rates(full_address)

        elif "whanganui" in city_lower or "wanganui" in city_lower:
            from ..services.wdc_whanganui_rates import fetch_whanganui_rates
            return await fetch_whanganui_rates(full_address)

        elif "horowhenua" in city_lower or city_lower in ("levin", "foxton"):
            from ..services.hdc_rates import fetch_hdc_rates
            return await fetch_hdc_rates(full_address)

    except Exception as e:
        logger.warning(f"Rates lookup failed for {city}/{full_address[:30]}: {e}")

    return None


@router.get("/property/{address_id}/rates")
@limiter.limit("10/minute")
async def get_rates(request: Request, address_id: int):
    """Fetch live council rates/valuation for a property.
    Supports all 25 councils. Returns 404 if city has no rates integration."""
    async with db.pool.connection() as conn:
        cur = await conn.execute(
            "SELECT full_address, town_city AS city FROM addresses WHERE address_id = %s",
            [address_id],
        )
        addr = cur.fetchone()
        if not addr:
            raise HTTPException(404, "Address not found")

        rates = await _fetch_rates_for_address(
            addr["full_address"], addr["city"] or "", address_id, conn
        )

    if not rates:
        raise HTTPException(404, "No rates data available for this address")

    return rates

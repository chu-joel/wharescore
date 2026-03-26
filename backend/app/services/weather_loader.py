# backend/app/services/weather_loader.py
"""
Fetches historical extreme weather events from Open-Meteo archive API.
Populates weather_events table with significant days (heavy rain, high wind, etc.)
for a grid of NZ locations covering all major population centres.

Open-Meteo: free, no API key, CC BY 4.0 license.
Archive API: https://archive-api.open-meteo.com/v1/archive
"""
from __future__ import annotations

import logging
import time
from datetime import date

import psycopg
import requests

logger = logging.getLogger(__name__)

# Grid of NZ locations (major cities + regional centres)
# Each tuple: (name, lat, lng)
NZ_WEATHER_GRID = [
    ("Auckland", -36.85, 174.76),
    ("Wellington", -41.29, 174.78),
    ("Christchurch", -43.53, 172.64),
    ("Hamilton", -37.79, 175.28),
    ("Tauranga", -37.69, 176.17),
    ("Dunedin", -45.87, 170.50),
    ("Napier", -39.49, 176.91),
    ("Palmerston North", -40.35, 175.61),
    ("Nelson", -41.27, 173.28),
    ("Rotorua", -38.14, 176.25),
    ("New Plymouth", -39.06, 174.08),
    ("Whangarei", -35.73, 174.32),
    ("Invercargill", -46.41, 168.35),
    ("Queenstown", -45.03, 168.66),
    ("Gisborne", -38.66, 178.02),
    ("Blenheim", -41.51, 173.95),
    ("Timaru", -44.40, 171.25),
    ("Whanganui", -39.93, 175.05),
    ("Greymouth", -42.45, 171.21),
    ("Masterton", -40.95, 175.66),
    ("Taupo", -38.69, 176.07),
    ("Whakatane", -37.95, 177.00),
    ("Kaikoura", -42.40, 173.68),
    ("Hokitika", -42.72, 170.97),
    ("Thames", -37.14, 175.54),
]

# Thresholds for "extreme" weather
HEAVY_RAIN_MM = 40       # 40mm+ in a day
EXTREME_RAIN_MM = 80     # 80mm+ in a day
HIGH_WIND_KMH = 90       # 90km/h gusts
EXTREME_WIND_KMH = 120   # 120km/h gusts
HEATWAVE_C = 33           # 33°C+ max
COLD_SNAP_C = -5           # -5°C or below

# WMO weather codes for storms/thunderstorms
STORM_CODES = {95, 96, 99}  # Thunderstorm, thunderstorm with hail


def _classify_event(precip, wind_gust, temp_max, temp_min, weather_code):
    """Classify a weather day. Returns (event_type, severity, title, description) or None."""
    events = []

    if precip is not None and precip >= EXTREME_RAIN_MM:
        events.append(("heavy_rain", "critical",
                        f"Extreme rainfall: {precip:.0f}mm",
                        f"Extreme rainfall of {precip:.0f}mm in 24 hours. Likely flooding, slips, and road closures."))
    elif precip is not None and precip >= HEAVY_RAIN_MM:
        events.append(("heavy_rain", "warning",
                        f"Heavy rainfall: {precip:.0f}mm",
                        f"Heavy rainfall of {precip:.0f}mm in 24 hours. Surface flooding and slips possible."))

    if wind_gust is not None and wind_gust >= EXTREME_WIND_KMH:
        events.append(("extreme_wind", "critical",
                        f"Destructive wind gusts: {wind_gust:.0f}km/h",
                        f"Wind gusts of {wind_gust:.0f}km/h. Significant property damage, power outages, and fallen trees likely."))
    elif wind_gust is not None and wind_gust >= HIGH_WIND_KMH:
        events.append(("extreme_wind", "warning",
                        f"Severe wind gusts: {wind_gust:.0f}km/h",
                        f"Wind gusts of {wind_gust:.0f}km/h. Minor property damage and power outages possible."))

    if temp_max is not None and temp_max >= HEATWAVE_C:
        events.append(("heatwave", "warning",
                        f"Extreme heat: {temp_max:.1f}°C",
                        f"Maximum temperature of {temp_max:.1f}°C. Heat stress risk — stay hydrated, check on vulnerable neighbours."))

    if temp_min is not None and temp_min <= COLD_SNAP_C:
        events.append(("cold_snap", "info",
                        f"Severe cold: {temp_min:.1f}°C",
                        f"Minimum temperature of {temp_min:.1f}°C. Risk of frozen pipes, icy roads, and hypothermia."))

    if weather_code is not None and weather_code in STORM_CODES:
        events.append(("storm", "warning",
                        "Thunderstorm activity",
                        "Thunderstorm recorded. Lightning, hail, and localised heavy rain possible."))

    # Return the most severe event (or None)
    if not events:
        return None
    # Sort by severity priority
    sev_order = {"critical": 0, "warning": 1, "info": 2}
    events.sort(key=lambda e: sev_order.get(e[1], 9))
    return events[0]


def load_weather_history(
    conn: psycopg.Connection,
    log=None,
    start_date: str = "2020-01-01",
    end_date: str | None = None,
) -> int:
    """Fetch extreme weather from Open-Meteo archive for all NZ grid points.

    Args:
        conn: psycopg sync connection
        log: optional logging callback
        start_date: ISO date string for start of range
        end_date: ISO date string for end (default: yesterday)

    Returns: total extreme event rows inserted
    """
    if end_date is None:
        end_date = str(date.today())

    def _log(msg):
        if log:
            log(msg)
        logger.info(msg)

    cur = conn.cursor()

    # Clear existing data in range to make idempotent
    cur.execute("DELETE FROM weather_events WHERE event_date >= %s AND event_date <= %s",
                (start_date, end_date))
    conn.commit()

    total_inserted = 0
    api_base = "https://archive-api.open-meteo.com/v1/archive"

    for name, lat, lng in NZ_WEATHER_GRID:
        _log(f"  Fetching weather for {name} ({lat}, {lng})...")
        data = None
        for attempt in range(3):
            try:
                resp = requests.get(api_base, params={
                    "latitude": lat,
                    "longitude": lng,
                    "start_date": start_date,
                    "end_date": end_date,
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max",
                    "timezone": "Pacific/Auckland",
                }, timeout=30)
                if resp.status_code == 429:
                    wait = 10 * (attempt + 1)
                    _log(f"    Rate limited, waiting {wait}s (attempt {attempt + 1}/3)...")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as e:
                if attempt == 2:
                    _log(f"    FAIL after 3 attempts: {e}")
                else:
                    time.sleep(5)
        if not data:
            continue

        daily = data.get("daily", {})
        dates = daily.get("time", [])
        precips = daily.get("precipitation_sum", [])
        winds = daily.get("wind_gusts_10m_max", [])
        temp_maxs = daily.get("temperature_2m_max", [])
        temp_mins = daily.get("temperature_2m_min", [])
        codes = daily.get("weather_code", [])

        location_count = 0
        for i, dt in enumerate(dates):
            p = precips[i] if i < len(precips) else None
            w = winds[i] if i < len(winds) else None
            tmax = temp_maxs[i] if i < len(temp_maxs) else None
            tmin = temp_mins[i] if i < len(temp_mins) else None
            code = codes[i] if i < len(codes) else None

            result = _classify_event(p, w, tmax, tmin, code)
            if not result:
                continue

            event_type, severity, title, description = result
            try:
                cur.execute(
                    """
                    INSERT INTO weather_events
                        (event_date, event_type, severity, title, description,
                         precipitation_mm, wind_gust_kmh, temp_max_c, temp_min_c,
                         weather_code, lat, lng, geom)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                    """,
                    (dt, event_type, severity, title, description,
                     p, w, tmax, tmin, code, lat, lng, lng, lat),
                )
                location_count += 1
            except Exception:
                conn.rollback()
                continue

        conn.commit()
        total_inserted += location_count
        _log(f"    {name}: {location_count} extreme days ({len(dates)} days checked)")

        # Be polite to Open-Meteo (free tier rate limit)
        time.sleep(2)

    _log(f"Weather history complete: {total_inserted} extreme events across {len(NZ_WEATHER_GRID)} locations")
    return total_inserted

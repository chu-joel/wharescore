"""
Map renderer using Esri satellite tiles + PIL overlay.
Fetches real aerial imagery, draws zone overlays (semi-transparent polygons),
then draws colored POI markers on top.
"""
from __future__ import annotations

import io
import base64
import math
import logging
from urllib.request import urlopen, Request
from PIL import Image, ImageDraw
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)

# --- Constants ---
MAP_WIDTH = 700
MAP_HEIGHT = 500
TILE_SIZE = 256
TILE_ZOOM = 16
TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
USER_AGENT = "WhareScore-POC/1.0 (static map renderer)"

# --- Marker colors (RGBA) ---
COLOR_PROPERTY = (13, 115, 119, 255)       # Teal
COLOR_SCHOOL_INZONE = (46, 125, 50, 255)   # Green
COLOR_SCHOOL_OTHER = (21, 101, 192, 255)   # Blue
COLOR_SUPERMARKET = (233, 30, 99, 255)     # Pink
COLOR_GP = (244, 67, 54, 255)              # Red
COLOR_PHARMACY = (156, 39, 176, 255)       # Purple
COLOR_TRANSIT = (255, 152, 0, 255)         # Orange
COLOR_PARK = (76, 175, 80, 255)            # Green
COLOR_CAFE = (121, 85, 72, 255)            # Brown
COLOR_RESTAURANT = (255, 87, 34, 255)      # Deep orange
COLOR_GYM = (0, 150, 136, 255)             # Teal-green
COLOR_PLAYGROUND = (139, 195, 74, 255)     # Light green

# --- Zone overlay colors (RGBA with transparency) ---
ZONE_COLORS = {
    "residential":  (76, 175, 80, 45),     # Green tint
    "commercial":   (255, 193, 7, 50),      # Amber tint
    "industrial":   (156, 39, 176, 40),     # Purple tint
    "open_space":   (46, 125, 50, 55),      # Dark green tint
    "mixed_use":    (255, 152, 0, 40),      # Orange tint
    "centre":       (233, 30, 99, 35),      # Pink tint
    "rural":        (139, 195, 74, 30),     # Light green tint
}

# Zone outline colors (RGBA)
ZONE_OUTLINE_COLORS = {
    "residential":  (76, 175, 80, 120),
    "commercial":   (255, 193, 7, 140),
    "industrial":   (156, 39, 176, 120),
    "open_space":   (46, 125, 50, 140),
    "mixed_use":    (255, 152, 0, 120),
    "centre":       (233, 30, 99, 100),
    "rural":        (139, 195, 74, 100),
}

# Legend — only types that appear on the map are shown
LEGEND_ORDER = [
    ("property",       (13, 115, 119),  "Property"),
    ("school_inzone",  (46, 125, 50),   "In-zone School"),
    ("school_other",   (21, 101, 192),  "School"),
    ("supermarket",    (233, 30, 99),   "Supermarket"),
    ("gp",             (244, 67, 54),   "GP"),
    ("pharmacy",       (156, 39, 176),  "Pharmacy"),
    ("park",           (76, 175, 80),   "Park"),
    ("cafe",           (121, 85, 72),   "Cafe"),
    ("restaurant",     (255, 87, 34),   "Restaurant"),
    ("playground",     (139, 195, 74),  "Playground"),
    ("transit",        (255, 152, 0),   "Transit"),
    # Zone legend entries
    ("zone_residential", (76, 175, 80),  "Residential zone"),
    ("zone_commercial",  (255, 193, 7),  "Commercial zone"),
    ("zone_industrial",  (156, 39, 176), "Industrial zone"),
    ("zone_open_space",  (46, 125, 50),  "Open space"),
]


# --- Slippy map math ---

def _lng_to_tile_x(lng: float, zoom: int) -> float:
    return (lng + 180.0) / 360.0 * (2 ** zoom)


def _lat_to_tile_y(lat: float, zoom: int) -> float:
    lat_rad = math.radians(lat)
    return (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * (2 ** zoom)


def _latlon_to_pixel(lat: float, lng: float, zoom: int,
                     origin_tile_x: int, origin_tile_y: int) -> Tuple[int, int]:
    fx = _lng_to_tile_x(lng, zoom)
    fy = _lat_to_tile_y(lat, zoom)
    px = int((fx - origin_tile_x) * TILE_SIZE)
    py = int((fy - origin_tile_y) * TILE_SIZE)
    return (px, py)


def _fetch_tile(z: int, x: int, y: int) -> Optional[Image.Image]:
    url = TILE_URL.format(z=z, x=x, y=y)
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=5) as resp:
            data = resp.read()
        return Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        logger.warning(f"Tile fetch failed ({z}/{x}/{y}): {e}")
        return None


def _fetch_tile_grid(center_lat: float, center_lng: float, zoom: int,
                     width: int, height: int) -> Tuple[Image.Image, int, int, int, int]:
    center_fx = _lng_to_tile_x(center_lng, zoom)
    center_fy = _lat_to_tile_y(center_lat, zoom)
    center_tx = int(center_fx)
    center_ty = int(center_fy)

    center_px_in_tile = (center_fx - center_tx) * TILE_SIZE
    center_py_in_tile = (center_fy - center_ty) * TILE_SIZE

    tiles_left = math.ceil((width / 2.0 - center_px_in_tile) / TILE_SIZE) + 1
    tiles_right = math.ceil((width / 2.0 - (TILE_SIZE - center_px_in_tile)) / TILE_SIZE) + 1
    tiles_up = math.ceil((height / 2.0 - center_py_in_tile) / TILE_SIZE) + 1
    tiles_down = math.ceil((height / 2.0 - (TILE_SIZE - center_py_in_tile)) / TILE_SIZE) + 1

    min_tx = center_tx - tiles_left
    max_tx = center_tx + tiles_right
    min_ty = center_ty - tiles_up
    max_ty = center_ty + tiles_down

    grid_w = (max_tx - min_tx + 1) * TILE_SIZE
    grid_h = (max_ty - min_ty + 1) * TILE_SIZE
    grid_img = Image.new("RGB", (grid_w, grid_h), (30, 30, 30))

    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tile = _fetch_tile(zoom, tx, ty)
            if tile:
                gx = (tx - min_tx) * TILE_SIZE
                gy = (ty - min_ty) * TILE_SIZE
                grid_img.paste(tile, (gx, gy))

    offset_x = int((center_fx - min_tx) * TILE_SIZE - width / 2.0)
    offset_y = int((center_fy - min_ty) * TILE_SIZE - height / 2.0)
    cropped = grid_img.crop((offset_x, offset_y, offset_x + width, offset_y + height))

    return cropped, min_tx, min_ty, offset_x, offset_y


# --- Zone overlay drawing ---

def _classify_zone(zone_name: str) -> str:
    """Classify a zone_name string into a broad category for coloring."""
    z = zone_name.lower()
    if "open space" in z or "recreation" in z or "conservation" in z or "reserve" in z:
        return "open_space"
    if "commercial" in z or "business" in z or "retail" in z:
        return "commercial"
    if "industrial" in z or "general industrial" in z:
        return "industrial"
    if "centre" in z or "city centre" in z or "town centre" in z or "metropolitan" in z:
        return "centre"
    if "mixed" in z or "mixed use" in z:
        return "mixed_use"
    if "rural" in z or "countryside" in z:
        return "rural"
    if "residential" in z or "housing" in z or "medium density" in z or "high density" in z:
        return "residential"
    return "residential"  # default


def _draw_zone_polygon(img: Image.Image, coords: list, color: tuple, outline_color: tuple,
                       to_px_fn, in_bounds_fn):
    """Draw a semi-transparent polygon overlay for a zone."""
    if not coords or len(coords) < 3:
        return

    # Convert coordinates to pixel positions
    pixel_coords = []
    for coord in coords:
        if len(coord) >= 2:
            px, py = to_px_fn(coord[1], coord[0])  # lat, lng
            pixel_coords.append((px, py))

    if len(pixel_coords) < 3:
        return

    # Check if any point is in bounds
    any_visible = any(in_bounds_fn(px, py) for px, py in pixel_coords)
    if not any_visible:
        return

    # Draw on a transparent overlay and composite
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.polygon(pixel_coords, fill=color, outline=outline_color)
    img.alpha_composite(overlay)


# --- Marker drawing ---

def _draw_pin(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple,
              size: int = 12, label: str = ""):
    r = size // 2
    draw.ellipse([x - r - 2, y - r - 2, x + r + 2, y + r + 2],
                 fill=(255, 255, 255), outline=(255, 255, 255))
    draw.ellipse([x - r, y - r, x + r, y + r],
                 fill=color[:3], outline=(50, 50, 50), width=1)
    if label and size >= 10:
        draw.text((x - 3, y - 5), label, fill=(255, 255, 255))


def _draw_diamond(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple, size: int = 10):
    r = size // 2
    points = [(x, y - r - 1), (x + r + 1, y), (x, y + r + 1), (x - r - 1, y)]
    draw.polygon(points, fill=(255, 255, 255), outline=(255, 255, 255))
    inner = [(x, y - r), (x + r, y), (x, y + r), (x - r, y)]
    draw.polygon(inner, fill=color[:3], outline=(50, 50, 50))


def _draw_square(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple, size: int = 10):
    r = size // 2
    draw.rectangle([x - r - 1, y - r - 1, x + r + 1, y + r + 1],
                   fill=(255, 255, 255), outline=(255, 255, 255))
    draw.rectangle([x - r, y - r, x + r, y + r],
                   fill=color[:3], outline=(50, 50, 50), width=1)


def _draw_triangle(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple, size: int = 10):
    r = size // 2
    points = [(x, y - r - 1), (x + r + 1, y + r + 1), (x - r - 1, y + r + 1)]
    draw.polygon(points, fill=(255, 255, 255), outline=(255, 255, 255))
    inner = [(x, y - r), (x + r, y + r), (x - r, y + r)]
    draw.polygon(inner, fill=color[:3], outline=(50, 50, 50))


def _draw_property_pin(draw: ImageDraw.ImageDraw, x: int, y: int):
    draw.ellipse([x - 9, y - 7, x + 11, y + 13], fill=(0, 0, 0, 80))
    draw.ellipse([x - 12, y - 12, x + 12, y + 12],
                 fill=(255, 255, 255), outline=(255, 255, 255))
    draw.ellipse([x - 9, y - 9, x + 9, y + 9],
                 fill=COLOR_PROPERTY[:3], outline=(20, 20, 20), width=2)
    draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255))


def _draw_legend(draw: ImageDraw.ImageDraw, width: int, height: int,
                 active_types: set):
    entries = [(c, l) for key, c, l in LEGEND_ORDER if key in active_types]
    if not entries:
        return

    # Two-row legend if many entries
    rows = [entries]
    if len(entries) > 7:
        mid = (len(entries) + 1) // 2
        rows = [entries[:mid], entries[mid:]]

    legend_h = 24 * len(rows)
    legend_y = height - legend_h

    draw.rectangle([0, legend_y, width, height], fill=(0, 0, 0, 190))
    draw.line([(0, legend_y), (width, legend_y)], fill=(60, 60, 60), width=1)

    for row_idx, row in enumerate(rows):
        y = legend_y + 6 + row_idx * 24
        x = 10
        for color, label in row:
            draw.ellipse([x, y + 2, x + 10, y + 12], fill=color, outline=(200, 200, 200))
            draw.text((x + 14, y), label, fill=(230, 230, 230))
            x += 14 + len(label) * 6 + 12
            if x > width - 60:
                break


# --- Main entry point ---

def generate_map_image(
    lat: float,
    lng: float,
    schools_inzone: Optional[List] = None,
    schools_other: Optional[List] = None,
    supermarket: Optional[dict] = None,
    supermarkets: Optional[List] = None,
    gp: Optional[dict] = None,
    pharmacy: Optional[dict] = None,
    transit_stops: Optional[List] = None,
    parks: Optional[List] = None,
    cafes: Optional[List] = None,
    restaurants: Optional[List] = None,
    playgrounds: Optional[List] = None,
    zones: Optional[List] = None,
) -> str:
    """
    Generate a satellite map image with zone overlays and POI markers.
    Returns base64 data URI for embedding in HTML.
    """
    schools_inzone = schools_inzone or []
    schools_other = schools_other or []
    transit_stops = transit_stops or []
    parks = parks or []
    cafes = cafes or []
    restaurants = restaurants or []
    playgrounds = playgrounds or []
    zones = zones or []

    sm_list: list = []
    if supermarkets:
        sm_list = supermarkets[:5]
    elif supermarket:
        sm_list = [supermarket]

    active_types: set = {"property"}

    # Collect all landmark coordinates to decide zoom level
    all_coords = [(lat, lng)]
    for items in [schools_inzone, schools_other, parks, cafes, restaurants, playgrounds]:
        for s in items:
            if s.get("latitude") and s.get("longitude"):
                all_coords.append((float(s["latitude"]), float(s["longitude"])))
    for item in sm_list:
        if item:
            lt = item.get("latitude") or item.get("lat")
            ln = item.get("longitude") or item.get("lng")
            if lt and ln:
                all_coords.append((float(lt), float(ln)))
    for item in [gp, pharmacy]:
        if item and item.get("latitude") and item.get("longitude"):
            all_coords.append((float(item["latitude"]), float(item["longitude"])))
    for stop in transit_stops[:8]:
        if stop.get("latitude") and stop.get("longitude"):
            all_coords.append((float(stop["latitude"]), float(stop["longitude"])))

    # Pick zoom level
    zoom = TILE_ZOOM
    if len(all_coords) > 1:
        lats = [c[0] for c in all_coords]
        lngs = [c[1] for c in all_coords]
        spread = max(max(lats) - min(lats), max(lngs) - min(lngs))
        if spread > 0.03:
            zoom = 14
        elif spread > 0.015:
            zoom = 15
        else:
            zoom = 16

    # Fetch satellite tiles
    try:
        base_img, origin_tx, origin_ty, off_x, off_y = _fetch_tile_grid(
            lat, lng, zoom, MAP_WIDTH, MAP_HEIGHT
        )
    except Exception as e:
        logger.warning(f"Tile grid fetch failed: {e}")
        base_img = Image.new("RGB", (MAP_WIDTH, MAP_HEIGHT), (30, 30, 30))
        origin_tx = int(_lng_to_tile_x(lng, zoom))
        origin_ty = int(_lat_to_tile_y(lat, zoom))
        off_x = 0
        off_y = 0

    img = base_img.convert("RGBA")

    def to_px(pt_lat: float, pt_lng: float) -> Tuple[int, int]:
        abs_x, abs_y = _latlon_to_pixel(pt_lat, pt_lng, zoom, origin_tx, origin_ty)
        return (abs_x - off_x, abs_y - off_y)

    def in_bounds(px: int, py: int) -> bool:
        return 0 <= px < MAP_WIDTH and 0 <= py < MAP_HEIGHT

    # === Layer 1: Zone overlays (drawn first, underneath markers) ===
    for zone in zones:
        zone_name = zone.get("zone_name", "")
        coords = zone.get("coordinates")
        if not zone_name or not coords:
            continue

        category = _classify_zone(zone_name)
        fill = ZONE_COLORS.get(category, (128, 128, 128, 30))
        outline = ZONE_OUTLINE_COLORS.get(category, (128, 128, 128, 80))

        # Handle MultiPolygon and Polygon
        if isinstance(coords, list) and len(coords) > 0:
            # Check if it's a list of rings (Polygon) or list of polygons (MultiPolygon)
            if isinstance(coords[0], list) and len(coords[0]) > 0:
                if isinstance(coords[0][0], list) and len(coords[0][0]) > 0:
                    if isinstance(coords[0][0][0], list):
                        # MultiPolygon: [[[[lng, lat], ...], ...], ...]
                        for polygon in coords:
                            if polygon and polygon[0]:
                                _draw_zone_polygon(img, polygon[0], fill, outline, to_px, in_bounds)
                    else:
                        # Polygon: [[[lng, lat], ...], ...]
                        _draw_zone_polygon(img, coords[0], fill, outline, to_px, in_bounds)
                else:
                    # Simple ring: [[lng, lat], ...]
                    _draw_zone_polygon(img, coords, fill, outline, to_px, in_bounds)

        legend_key = f"zone_{category}"
        active_types.add(legend_key)

    # === Layer 2: POI markers (back to front, property last) ===
    draw = ImageDraw.Draw(img)

    # Parks (triangle markers, drawn first/underneath)
    for park in parks[:6]:
        if park.get("latitude") and park.get("longitude"):
            px, py = to_px(float(park["latitude"]), float(park["longitude"]))
            if in_bounds(px, py):
                _draw_triangle(draw, px, py, COLOR_PARK, size=9)
                active_types.add("park")

    # Playgrounds (small triangle)
    for pg in playgrounds[:4]:
        if pg.get("latitude") and pg.get("longitude"):
            px, py = to_px(float(pg["latitude"]), float(pg["longitude"]))
            if in_bounds(px, py):
                _draw_triangle(draw, px, py, COLOR_PLAYGROUND, size=7)
                active_types.add("playground")

    # Cafes (small diamond)
    for cafe in cafes[:5]:
        if cafe.get("latitude") and cafe.get("longitude"):
            px, py = to_px(float(cafe["latitude"]), float(cafe["longitude"]))
            if in_bounds(px, py):
                _draw_diamond(draw, px, py, COLOR_CAFE, size=7)
                active_types.add("cafe")

    # Restaurants (small diamond)
    for rest in restaurants[:5]:
        if rest.get("latitude") and rest.get("longitude"):
            px, py = to_px(float(rest["latitude"]), float(rest["longitude"]))
            if in_bounds(px, py):
                _draw_diamond(draw, px, py, COLOR_RESTAURANT, size=7)
                active_types.add("restaurant")

    # Transit stops (diamond)
    for stop in transit_stops[:8]:
        if stop.get("latitude") and stop.get("longitude"):
            px, py = to_px(float(stop["latitude"]), float(stop["longitude"]))
            if in_bounds(px, py):
                _draw_diamond(draw, px, py, COLOR_TRANSIT, size=7)
                active_types.add("transit")

    # Other schools (square)
    for school in schools_other[:3]:
        if school.get("latitude") and school.get("longitude"):
            px, py = to_px(float(school["latitude"]), float(school["longitude"]))
            if in_bounds(px, py):
                _draw_square(draw, px, py, COLOR_SCHOOL_OTHER, size=10)
                active_types.add("school_other")

    # In-zone schools (circle with "S")
    for school in schools_inzone[:5]:
        if school.get("latitude") and school.get("longitude"):
            px, py = to_px(float(school["latitude"]), float(school["longitude"]))
            if in_bounds(px, py):
                _draw_pin(draw, px, py, COLOR_SCHOOL_INZONE, size=13, label="S")
                active_types.add("school_inzone")

    # Pharmacy
    if pharmacy and pharmacy.get("latitude") and pharmacy.get("longitude"):
        px, py = to_px(float(pharmacy["latitude"]), float(pharmacy["longitude"]))
        if in_bounds(px, py):
            _draw_diamond(draw, px, py, COLOR_PHARMACY, size=10)
            active_types.add("pharmacy")

    # GP
    if gp and gp.get("latitude") and gp.get("longitude"):
        px, py = to_px(float(gp["latitude"]), float(gp["longitude"]))
        if in_bounds(px, py):
            _draw_pin(draw, px, py, COLOR_GP, size=12, label="+")
            active_types.add("gp")

    # Supermarkets (numbered)
    for idx, sm in enumerate(reversed(sm_list)):
        sm_lat = sm.get("latitude") or sm.get("lat")
        sm_lng = sm.get("longitude") or sm.get("lng")
        if sm_lat and sm_lng:
            px, py = to_px(float(sm_lat), float(sm_lng))
            if in_bounds(px, py):
                num = len(sm_list) - idx
                _draw_pin(draw, px, py, COLOR_SUPERMARKET, size=12,
                          label=str(num) if len(sm_list) > 1 else "")
                active_types.add("supermarket")

    # Property (always on top)
    prop_px, prop_py = to_px(lat, lng)
    if in_bounds(prop_px, prop_py):
        _draw_property_pin(draw, prop_px, prop_py)

    # Legend
    _draw_legend(draw, MAP_WIDTH, MAP_HEIGHT, active_types)

    # Attribution
    attr_text = "\u00a9 Esri, Maxar, Earthstar Geographics"
    draw.rectangle([MAP_WIDTH - 230, 0, MAP_WIDTH, 14], fill=(0, 0, 0, 140))
    draw.text((MAP_WIDTH - 228, 1), attr_text, fill=(220, 220, 220))

    # Export
    final = img.convert("RGB")
    buffer = io.BytesIO()
    final.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_base64}"

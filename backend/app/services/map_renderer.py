"""
Map renderer using OSM raster tiles + PIL marker overlay.
Fetches real street map tiles from OpenStreetMap, stitches them,
then draws colored landmark markers on top.
"""
from __future__ import annotations

import io
import base64
import math
import logging
from urllib.request import urlopen, Request
from PIL import Image, ImageDraw, ImageFont
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)

# --- Constants ---
MAP_WIDTH = 700
MAP_HEIGHT = 400
TILE_SIZE = 256
TILE_ZOOM = 16  # Zoomed in for better street-level detail
TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
USER_AGENT = "WhareScore-POC/1.0 (static map renderer)"

# Colors (RGBA for compositing)
COLOR_PROPERTY = (13, 115, 119, 255)      # Teal
COLOR_SCHOOL_INZONE = (46, 125, 50, 255)  # Green
COLOR_SCHOOL_OTHER = (21, 101, 192, 255)  # Blue
COLOR_SUPERMARKET = (233, 30, 99, 255)    # Pink
COLOR_GP = (244, 67, 54, 255)             # Red
COLOR_PHARMACY = (156, 39, 176, 255)      # Purple
COLOR_TRANSIT = (255, 152, 0, 255)        # Orange
COLOR_OUTLINE = (255, 255, 255, 255)      # White outline for contrast
COLOR_TEXT = (26, 26, 26, 255)

# Legend colors (RGB for drawing)
LEGEND_ITEMS = [
    ((13, 115, 119), "Property"),
    ((46, 125, 50), "In-zone School"),
    ((21, 101, 192), "School"),
    ((233, 30, 99), "Supermarket"),
    ((244, 67, 54), "GP"),
    ((156, 39, 176), "Pharmacy"),
    ((255, 152, 0), "Transit"),
]


# --- Slippy map math ---

def _lng_to_tile_x(lng: float, zoom: int) -> float:
    """Convert longitude to fractional tile X coordinate."""
    return (lng + 180.0) / 360.0 * (2 ** zoom)


def _lat_to_tile_y(lat: float, zoom: int) -> float:
    """Convert latitude to fractional tile Y coordinate."""
    lat_rad = math.radians(lat)
    return (1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * (2 ** zoom)


def _latlon_to_pixel(lat: float, lng: float, zoom: int,
                     origin_tile_x: int, origin_tile_y: int) -> Tuple[int, int]:
    """Convert lat/lng to pixel position relative to tile grid origin."""
    fx = _lng_to_tile_x(lng, zoom)
    fy = _lat_to_tile_y(lat, zoom)
    px = int((fx - origin_tile_x) * TILE_SIZE)
    py = int((fy - origin_tile_y) * TILE_SIZE)
    return (px, py)


def _fetch_tile(z: int, x: int, y: int) -> Optional[Image.Image]:
    """Fetch a single OSM raster tile. Returns None on failure."""
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
    """
    Fetch and stitch OSM tiles to cover the requested pixel dimensions.
    Returns (stitched_image, origin_tile_x, origin_tile_y, offset_x, offset_y).
    offset_x/y is how many pixels to crop from top-left to center the map.
    """
    # Center tile
    center_fx = _lng_to_tile_x(center_lng, zoom)
    center_fy = _lat_to_tile_y(center_lat, zoom)
    center_tx = int(center_fx)
    center_ty = int(center_fy)

    # How many pixels from tile origin to center point
    center_px_in_tile = (center_fx - center_tx) * TILE_SIZE
    center_py_in_tile = (center_fy - center_ty) * TILE_SIZE

    # How many tiles we need in each direction from center tile
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
    grid_img = Image.new("RGB", (grid_w, grid_h), (230, 230, 230))

    for ty in range(min_ty, max_ty + 1):
        for tx in range(min_tx, max_tx + 1):
            tile = _fetch_tile(zoom, tx, ty)
            if tile:
                gx = (tx - min_tx) * TILE_SIZE
                gy = (ty - min_ty) * TILE_SIZE
                grid_img.paste(tile, (gx, gy))

    # Calculate offset to crop so center_lat/lng is at center of output
    offset_x = int((center_fx - min_tx) * TILE_SIZE - width / 2.0)
    offset_y = int((center_fy - min_ty) * TILE_SIZE - height / 2.0)

    # Crop to desired dimensions
    cropped = grid_img.crop((offset_x, offset_y, offset_x + width, offset_y + height))

    return cropped, min_tx, min_ty, offset_x, offset_y


# --- Marker drawing ---

def _draw_pin(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple,
              size: int = 12, label: str = ""):
    """Draw a map pin marker with white outline and optional label character."""
    r = size // 2
    # White outline circle (slightly larger)
    draw.ellipse([x - r - 2, y - r - 2, x + r + 2, y + r + 2],
                 fill=(255, 255, 255), outline=(255, 255, 255))
    # Colored fill
    draw.ellipse([x - r, y - r, x + r, y + r],
                 fill=color[:3], outline=(50, 50, 50), width=1)
    # Label character (centered in pin)
    if label and size >= 10:
        # Approximate centering for the default bitmap font
        draw.text((x - 3, y - 5), label, fill=(255, 255, 255))


def _draw_diamond(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple, size: int = 10):
    """Draw a diamond-shaped marker."""
    r = size // 2
    points = [(x, y - r - 1), (x + r + 1, y), (x, y + r + 1), (x - r - 1, y)]
    draw.polygon(points, fill=(255, 255, 255), outline=(255, 255, 255))
    inner = [(x, y - r), (x + r, y), (x, y + r), (x - r, y)]
    draw.polygon(inner, fill=color[:3], outline=(50, 50, 50))


def _draw_square(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple, size: int = 10):
    """Draw a square marker with rounded feel."""
    r = size // 2
    draw.rectangle([x - r - 1, y - r - 1, x + r + 1, y + r + 1],
                   fill=(255, 255, 255), outline=(255, 255, 255))
    draw.rectangle([x - r, y - r, x + r, y + r],
                   fill=color[:3], outline=(50, 50, 50), width=1)


def _draw_property_pin(draw: ImageDraw.ImageDraw, x: int, y: int):
    """Draw larger property pin with drop shadow effect."""
    # Shadow
    draw.ellipse([x - 9, y - 7, x + 11, y + 13], fill=(0, 0, 0, 80))
    # White ring
    draw.ellipse([x - 12, y - 12, x + 12, y + 12],
                 fill=(255, 255, 255), outline=(255, 255, 255))
    # Teal fill
    draw.ellipse([x - 9, y - 9, x + 9, y + 9],
                 fill=COLOR_PROPERTY[:3], outline=(20, 20, 20), width=2)
    # Inner dot
    draw.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255))


def _draw_legend(draw: ImageDraw.ImageDraw, width: int, height: int,
                 active_types: set):
    """Draw a semi-transparent legend bar at the bottom, only showing active marker types."""
    # Build legend entries for types that actually appear on the map
    entries = []
    type_to_legend = {
        "property": ((13, 115, 119), "Property"),
        "school_inzone": ((46, 125, 50), "In-zone School"),
        "school_other": ((21, 101, 192), "School"),
        "supermarket": ((233, 30, 99), "Supermarket"),
        "gp": ((244, 67, 54), "GP"),
        "pharmacy": ((156, 39, 176), "Pharmacy"),
        "transit": ((255, 152, 0), "Transit"),
    }
    for t in ["property", "school_inzone", "school_other", "supermarket", "gp", "pharmacy", "transit"]:
        if t in active_types:
            entries.append(type_to_legend[t])

    if not entries:
        return

    legend_h = 24
    legend_y = height - legend_h
    # Semi-transparent white background
    overlay_box = [0, legend_y, width, height]
    draw.rectangle(overlay_box, fill=(255, 255, 255, 220))
    draw.line([(0, legend_y), (width, legend_y)], fill=(200, 200, 200), width=1)

    # Draw legend items
    x = 10
    for color, label in entries:
        draw.ellipse([x, legend_y + 8, x + 10, legend_y + 18], fill=color, outline=(80, 80, 80))
        draw.text((x + 14, legend_y + 6), label, fill=(40, 40, 40))
        # Estimate text width (approx 6px per char with default font)
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
) -> str:
    """
    Generate a map image with OSM tile background and landmark markers.

    Returns base64 data URI for embedding in HTML.
    supermarkets (list) takes priority over supermarket (single dict) if provided.
    """
    schools_inzone = schools_inzone or []
    schools_other = schools_other or []
    transit_stops = transit_stops or []

    # Normalise supermarkets to a list
    sm_list: list = []
    if supermarkets:
        sm_list = supermarkets[:5]
    elif supermarket:
        sm_list = [supermarket]

    # Track which marker types are drawn (for legend)
    active_types: set = {"property"}

    # Collect all landmark coordinates to decide zoom level
    all_coords = [(lat, lng)]
    for s in schools_inzone + schools_other:
        if s.get("latitude") and s.get("longitude"):
            all_coords.append((float(s["latitude"]), float(s["longitude"])))
    for item in sm_list:
        if item and item.get("latitude") and item.get("longitude"):
            all_coords.append((float(item["latitude"]), float(item["longitude"])))
        elif item and item.get("lat") and item.get("lng"):
            all_coords.append((float(item["lat"]), float(item["lng"])))
    for item in [gp, pharmacy]:
        if item and item.get("latitude") and item.get("longitude"):
            all_coords.append((float(item["latitude"]), float(item["longitude"])))
    for stop in transit_stops[:8]:
        if stop.get("latitude") and stop.get("longitude"):
            all_coords.append((float(stop["latitude"]), float(stop["longitude"])))

    # Pick zoom level based on spread of points
    zoom = TILE_ZOOM
    if len(all_coords) > 1:
        lats = [c[0] for c in all_coords]
        lngs = [c[1] for c in all_coords]
        lat_range = max(lats) - min(lats)
        lng_range = max(lngs) - min(lngs)
        spread = max(lat_range, lng_range)
        # Adjust zoom: more spread = lower zoom
        if spread > 0.03:
            zoom = 14
        elif spread > 0.015:
            zoom = 15
        else:
            zoom = 16

    # Fetch OSM tiles and stitch
    try:
        base_img, origin_tx, origin_ty, off_x, off_y = _fetch_tile_grid(
            lat, lng, zoom, MAP_WIDTH, MAP_HEIGHT
        )
    except Exception as e:
        logger.warning(f"Tile grid fetch failed, falling back to plain background: {e}")
        base_img = Image.new("RGB", (MAP_WIDTH, MAP_HEIGHT), (230, 230, 230))
        origin_tx = int(_lng_to_tile_x(lng, zoom))
        origin_ty = int(_lat_to_tile_y(lat, zoom))
        off_x = 0
        off_y = 0

    # Convert to RGBA for marker compositing
    img = base_img.convert("RGBA")
    draw = ImageDraw.Draw(img)

    def to_px(pt_lat: float, pt_lng: float) -> Tuple[int, int]:
        """Convert lat/lng to pixel on the cropped image."""
        abs_x, abs_y = _latlon_to_pixel(pt_lat, pt_lng, zoom, origin_tx, origin_ty)
        return (abs_x - off_x, abs_y - off_y)

    def in_bounds(px: int, py: int) -> bool:
        return 0 <= px < MAP_WIDTH and 0 <= py < MAP_HEIGHT

    # --- Draw markers (back to front, property last) ---

    # Transit stops (smallest, diamond shape, drawn first)
    for stop in transit_stops[:8]:
        if stop.get("latitude") and stop.get("longitude"):
            px, py = to_px(float(stop["latitude"]), float(stop["longitude"]))
            if in_bounds(px, py):
                _draw_diamond(draw, px, py, COLOR_TRANSIT, size=7)
                active_types.add("transit")

    # Other schools (square markers)
    for school in schools_other[:3]:
        if school.get("latitude") and school.get("longitude"):
            px, py = to_px(float(school["latitude"]), float(school["longitude"]))
            if in_bounds(px, py):
                _draw_square(draw, px, py, COLOR_SCHOOL_OTHER, size=10)
                active_types.add("school_other")

    # In-zone schools (circle with "S" label)
    for school in schools_inzone[:5]:
        if school.get("latitude") and school.get("longitude"):
            px, py = to_px(float(school["latitude"]), float(school["longitude"]))
            if in_bounds(px, py):
                _draw_pin(draw, px, py, COLOR_SCHOOL_INZONE, size=13, label="S")
                active_types.add("school_inzone")

    # Pharmacy (diamond)
    if pharmacy and pharmacy.get("latitude") and pharmacy.get("longitude"):
        px, py = to_px(float(pharmacy["latitude"]), float(pharmacy["longitude"]))
        if in_bounds(px, py):
            _draw_diamond(draw, px, py, COLOR_PHARMACY, size=10)
            active_types.add("pharmacy")

    # GP (circle with "+" label)
    if gp and gp.get("latitude") and gp.get("longitude"):
        px, py = to_px(float(gp["latitude"]), float(gp["longitude"]))
        if in_bounds(px, py):
            _draw_pin(draw, px, py, COLOR_GP, size=12, label="+")
            active_types.add("gp")

    # Supermarkets (numbered circles)
    for idx, sm in enumerate(reversed(sm_list)):  # Draw farthest first
        sm_lat = sm.get("latitude") or sm.get("lat")
        sm_lng = sm.get("longitude") or sm.get("lng")
        if sm_lat and sm_lng:
            px, py = to_px(float(sm_lat), float(sm_lng))
            if in_bounds(px, py):
                num = len(sm_list) - idx  # 1-based numbering
                _draw_pin(draw, px, py, COLOR_SUPERMARKET, size=12,
                          label=str(num) if len(sm_list) > 1 else "")
                active_types.add("supermarket")

    # Property (always on top, largest)
    prop_px, prop_py = to_px(lat, lng)
    if in_bounds(prop_px, prop_py):
        _draw_property_pin(draw, prop_px, prop_py)

    # Legend (only shows types that are actually on the map)
    _draw_legend(draw, MAP_WIDTH, MAP_HEIGHT, active_types)

    # --- OSM attribution (required by license) ---
    attr_text = "\u00a9 OpenStreetMap contributors"
    draw.rectangle([MAP_WIDTH - 190, 0, MAP_WIDTH, 14], fill=(255, 255, 255, 180))
    draw.text((MAP_WIDTH - 188, 1), attr_text, fill=(100, 100, 100))

    # Convert to PNG base64 data URI
    final = img.convert("RGB")
    buffer = io.BytesIO()
    final.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return f"data:image/png;base64,{img_base64}"

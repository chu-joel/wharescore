# backend/app/services/geo_utils.py
from __future__ import annotations
import json


def to_geojson_feature(row: dict) -> dict:
    """Convert a DB row with lng/lat into a GeoJSON Point Feature.
    Moves lng/lat into geometry, everything else into properties."""
    props = {k: v for k, v in row.items() if k not in ("lat", "lng", "geom")}
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [row["lng"], row["lat"]]},
        "properties": props,
    }


def to_geojson_polygon_feature(row: dict) -> dict:
    """Convert a DB row with geom_geojson string into a GeoJSON Polygon Feature.
    Used for building outlines."""
    props = {k: v for k, v in row.items() if k != "geom_geojson"}
    return {
        "type": "Feature",
        "geometry": json.loads(row["geom_geojson"]),
        "properties": props,
    }

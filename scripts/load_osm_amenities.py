"""
Load OpenStreetMap amenities from Geofabrik NZ PBF extract into PostGIS.
Requires: osmium (pip install osmium) and psycopg (pip install psycopg[binary])

Usage: py -3.14 scripts/load_osm_amenities.py
"""

import json
import time
import sys

try:
    import osmium
except ImportError:
    print("ERROR: osmium not installed. Run: pip install osmium")
    sys.exit(1)

import psycopg

DB = "postgresql://postgres:postgres@localhost:5432/wharescore"
PBF_FILE = r"D:\Projects\Experiments\propertyiq-poc\data\osm\new-zealand-latest.osm.pbf"

# Categories we care about
AMENITY_TAGS = {
    "restaurant", "cafe", "fast_food", "bar", "pub", "food_court",
    "pharmacy", "doctors", "dentist", "hospital", "clinic", "veterinary",
    "bank", "atm", "post_office", "library", "cinema", "theatre",
    "fuel", "parking", "school", "kindergarten", "university", "college",
    "community_centre", "fire_station", "police", "courthouse",
    "place_of_worship", "toilets", "recycling", "childcare",
    "marketplace", "social_facility",
}

SHOP_TAGS = {
    "supermarket", "convenience", "bakery", "butcher", "greengrocer",
    "clothes", "hairdresser", "hardware", "electronics", "books",
    "florist", "optician", "pet", "sports", "toys", "department_store",
    "mall", "alcohol", "bicycle", "car", "chemist", "deli",
    "gift", "jewelry", "laundry", "mobile_phone", "music",
    "newsagent", "outdoor", "shoes", "stationery", "variety_store",
}

LEISURE_TAGS = {
    "park", "playground", "sports_centre", "swimming_pool",
    "fitness_centre", "garden", "pitch", "track", "dog_park",
    "nature_reserve", "golf_course", "stadium", "ice_rink",
    "recreation_ground", "water_park",
}

TOURISM_TAGS = {
    "museum", "gallery", "information", "viewpoint",
    "hotel", "motel", "camp_site", "caravan_site", "hostel",
    "attraction", "artwork", "zoo", "theme_park",
}

HEALTHCARE_TAGS = {
    "hospital", "clinic", "doctors", "dentist", "pharmacy",
    "physiotherapist", "optometrist", "laboratory",
}


class AmenityHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.amenities = []
        self.count = 0

    def _extract(self, tags, lon, lat):
        category = None
        subcategory = None

        if "amenity" in tags and tags["amenity"] in AMENITY_TAGS:
            category = "amenity"
            subcategory = tags["amenity"]
        elif "shop" in tags and tags["shop"] in SHOP_TAGS:
            category = "shop"
            subcategory = tags["shop"]
        elif "leisure" in tags and tags["leisure"] in LEISURE_TAGS:
            category = "leisure"
            subcategory = tags["leisure"]
        elif "tourism" in tags and tags["tourism"] in TOURISM_TAGS:
            category = "tourism"
            subcategory = tags["tourism"]
        elif "healthcare" in tags and tags["healthcare"] in HEALTHCARE_TAGS:
            category = "healthcare"
            subcategory = tags["healthcare"]
        # Fallback: any amenity/shop/leisure tag we didn't list
        elif "amenity" in tags:
            category = "amenity"
            subcategory = tags["amenity"]
        elif "shop" in tags:
            category = "shop"
            subcategory = tags["shop"]
        elif "leisure" in tags:
            category = "leisure"
            subcategory = tags["leisure"]

        if category is None:
            return

        self.amenities.append((
            None,  # osm_id set below
            tags.get("name"),
            category,
            subcategory,
            tags.get("brand"),
            tags.get("opening_hours"),
            tags.get("phone") or tags.get("contact:phone"),
            tags.get("website") or tags.get("contact:website"),
            tags.get("addr:street"),
            tags.get("addr:housenumber"),
            lon,
            lat,
        ))
        self.count += 1
        if self.count % 10000 == 0:
            print(f"  Extracted {self.count} amenities...", flush=True)

    def node(self, n):
        if n.location.valid():
            self._extract(n.tags, n.location.lon, n.location.lat)

    def area(self, a):
        # For ways/relations, use centroid
        try:
            centroid = a.outer_rings()[0]
            # Calculate simple centroid from first outer ring
            lons = [n.lon for n in centroid]
            lats = [n.lat for n in centroid]
            if lons and lats:
                lon = sum(lons) / len(lons)
                lat = sum(lats) / len(lats)
                self._extract(a.tags, lon, lat)
        except Exception:
            pass


def main():
    print("=" * 60)
    print("LOADING OSM AMENITIES INTO POSTGIS")
    print("=" * 60)

    # Phase 1: Extract amenities from PBF
    print(f"\nReading {PBF_FILE}...")
    t0 = time.time()
    handler = AmenityHandler()
    handler.apply_file(PBF_FILE, locations=True)
    t1 = time.time()
    print(f"  Extracted {handler.count} amenities in {t1 - t0:.1f}s")

    if not handler.amenities:
        print("ERROR: No amenities found!")
        return

    # Phase 2: Load into PostGIS
    print(f"\nConnecting to database...")
    with psycopg.connect(DB, autocommit=False) as conn:
        print("  Dropping old table if exists...")
        conn.execute("DROP TABLE IF EXISTS osm_amenities CASCADE;")

        print("  Creating table...")
        conn.execute("""
            CREATE TABLE osm_amenities (
                id SERIAL PRIMARY KEY,
                osm_id BIGINT,
                name TEXT,
                category TEXT,
                subcategory TEXT,
                brand TEXT,
                opening_hours TEXT,
                phone TEXT,
                website TEXT,
                addr_street TEXT,
                addr_housenumber TEXT,
                geom GEOMETRY(Point, 4326)
            );
        """)

        print(f"  Inserting {len(handler.amenities)} rows...")
        t2 = time.time()
        with conn.cursor().copy(
            "COPY osm_amenities (osm_id, name, category, subcategory, brand, "
            "opening_hours, phone, website, addr_street, addr_housenumber, geom) "
            "FROM STDIN"
        ) as copy:
            for row in handler.amenities:
                osm_id, name, cat, subcat, brand, hours, phone, web, street, num, lon, lat = row
                geom_wkt = f"SRID=4326;POINT({lon} {lat})"
                copy.write_row((osm_id, name, cat, subcat, brand, hours, phone, web, street, num, geom_wkt))

        t3 = time.time()
        print(f"  Inserted in {t3 - t2:.1f}s")

        print("  Creating indexes...")
        conn.execute("CREATE INDEX idx_osm_amenities_geom ON osm_amenities USING GIST (geom);")
        conn.execute("CREATE INDEX idx_osm_amenities_category ON osm_amenities (category);")
        conn.execute("CREATE INDEX idx_osm_amenities_subcategory ON osm_amenities (subcategory);")
        conn.execute("ANALYZE osm_amenities;")

        conn.commit()

        # Stats
        result = conn.execute("SELECT category, COUNT(*) FROM osm_amenities GROUP BY category ORDER BY count DESC").fetchall()
        print(f"\n  Category breakdown:")
        total = 0
        for cat, cnt in result:
            print(f"    {cat}: {cnt:,}")
            total += cnt
        print(f"    TOTAL: {total:,}")

        # Test query
        result = conn.execute("""
            SELECT subcategory, COUNT(*) FROM osm_amenities
            WHERE ST_DWithin(geom::geography,
                  ST_SetSRID(ST_MakePoint(174.776, -41.290), 4326)::geography, 500)
            GROUP BY subcategory ORDER BY count DESC LIMIT 10
        """).fetchall()
        print(f"\n  Test: Amenities within 500m of 162 Cuba St:")
        for subcat, cnt in result:
            print(f"    {subcat}: {cnt}")

    print(f"\nDone! Total time: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()

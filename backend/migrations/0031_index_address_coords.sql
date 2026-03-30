-- 0031: Add index on address coordinates for unit count lookup
--
-- detect_property_type() counts addresses at the same coordinates to
-- identify multi-unit buildings. Without an index, this query does a
-- full table scan on 2.8M+ addresses — taking ~6 seconds.
-- With the index: <10ms.

CREATE INDEX IF NOT EXISTS idx_addresses_coords
    ON addresses (gd2000_xcoord, gd2000_ycoord)
    WHERE address_lifecycle = 'Current';

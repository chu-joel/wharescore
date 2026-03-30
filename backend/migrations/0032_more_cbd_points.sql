-- 0032: Add missing small/medium cities to cbd_points
-- Previously only 20 cities — Timaru, Blenheim, Whakatane etc. showed
-- 100km+ CBD distance pointing to the wrong city.

INSERT INTO cbd_points (city, geom) VALUES
  ('Timaru', ST_SetSRID(ST_Point(171.2540, -44.3960), 4326)),
  ('Blenheim', ST_SetSRID(ST_Point(173.9530, -41.5138), 4326)),
  ('Whakatane', ST_SetSRID(ST_Point(176.9930, -37.9530), 4326)),
  ('Levin', ST_SetSRID(ST_Point(175.2750, -40.6220), 4326)),
  ('Masterton', ST_SetSRID(ST_Point(175.6580, -40.9520), 4326)),
  ('Kapiti Coast', ST_SetSRID(ST_Point(175.0060, -40.9140), 4326)),
  ('Ashburton', ST_SetSRID(ST_Point(171.7470, -43.8990), 4326)),
  ('Pukekohe', ST_SetSRID(ST_Point(174.9010, -37.2000), 4326)),
  ('Cambridge', ST_SetSRID(ST_Point(175.4710, -37.8840), 4326)),
  ('Te Awamutu', ST_SetSRID(ST_Point(175.3230, -38.0070), 4326)),
  ('Oamaru', ST_SetSRID(ST_Point(170.9720, -45.0970), 4326)),
  ('Greymouth', ST_SetSRID(ST_Point(171.2100, -42.4500), 4326)),
  ('Hokitika', ST_SetSRID(ST_Point(170.9670, -42.7160), 4326)),
  ('Westport', ST_SetSRID(ST_Point(171.6030, -41.7530), 4326)),
  ('Kaikoura', ST_SetSRID(ST_Point(173.6810, -42.4000), 4326)),
  ('Rangiora', ST_SetSRID(ST_Point(172.5970, -43.3050), 4326)),
  ('Rolleston', ST_SetSRID(ST_Point(172.3790, -43.5910), 4326)),
  ('Motueka', ST_SetSRID(ST_Point(173.0120, -41.1120), 4326)),
  ('Richmond', ST_SetSRID(ST_Point(173.1830, -41.3380), 4326)),
  ('Gore', ST_SetSRID(ST_Point(168.9430, -46.0990), 4326)),
  ('Wanaka', ST_SetSRID(ST_Point(169.1320, -44.7000), 4326)),
  ('Alexandra', ST_SetSRID(ST_Point(169.3790, -45.2490), 4326)),
  ('Thames', ST_SetSRID(ST_Point(175.5380, -37.1390), 4326)),
  ('Taupo', ST_SetSRID(ST_Point(176.0700, -38.6860), 4326)),
  ('Tokoroa', ST_SetSRID(ST_Point(175.8650, -38.2270), 4326)),
  ('Feilding', ST_SetSRID(ST_Point(175.5650, -40.2240), 4326)),
  ('Waiuku', ST_SetSRID(ST_Point(174.7310, -37.2510), 4326)),
  ('Waimate', ST_SetSRID(ST_Point(171.0460, -44.7340), 4326))
ON CONFLICT DO NOTHING;

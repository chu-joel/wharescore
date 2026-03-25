-- Migration 0016: Expand CBD distance calculation to cover all NZ cities/towns
-- Previously only 14 cities had CBD coordinates; now covers 40+ towns

CREATE OR REPLACE FUNCTION get_nearest_cbd_point(p_town TEXT, p_ta TEXT)
RETURNS geometry AS $$
DECLARE
  t TEXT := lower(coalesce(p_town, ''));
  ta TEXT := lower(coalesce(p_ta, ''));
BEGIN
  RETURN CASE
    -- Major cities
    WHEN t LIKE '%auckland%' OR ta LIKE '%auckland%'
      THEN ST_SetSRID(ST_MakePoint(174.7685, -36.8442), 4326)
    WHEN t LIKE '%christchurch%' OR ta LIKE '%christchurch%'
      THEN ST_SetSRID(ST_MakePoint(172.6362, -43.5321), 4326)
    WHEN t LIKE '%hamilton%'
      THEN ST_SetSRID(ST_MakePoint(175.2793, -37.7870), 4326)
    WHEN t LIKE '%tauranga%' OR t LIKE '%mount maunganui%'
      THEN ST_SetSRID(ST_MakePoint(176.1654, -37.6878), 4326)
    WHEN t LIKE '%dunedin%'
      THEN ST_SetSRID(ST_MakePoint(170.5036, -45.8788), 4326)
    WHEN t LIKE '%napier%'
      THEN ST_SetSRID(ST_MakePoint(176.9120, -39.4928), 4326)
    WHEN t LIKE '%hastings%'
      THEN ST_SetSRID(ST_MakePoint(176.8418, -39.6381), 4326)
    WHEN t LIKE '%nelson%'
      THEN ST_SetSRID(ST_MakePoint(173.2840, -41.2706), 4326)
    WHEN t LIKE '%invercargill%'
      THEN ST_SetSRID(ST_MakePoint(168.3538, -46.4132), 4326)
    WHEN t LIKE '%queenstown%'
      THEN ST_SetSRID(ST_MakePoint(168.6626, -45.0312), 4326)
    WHEN t LIKE '%rotorua%'
      THEN ST_SetSRID(ST_MakePoint(176.2497, -38.1368), 4326)
    WHEN t LIKE '%new plymouth%'
      THEN ST_SetSRID(ST_MakePoint(174.0752, -39.0556), 4326)
    WHEN t LIKE '%whangarei%' OR t LIKE '%whang_rei%'
      THEN ST_SetSRID(ST_MakePoint(174.3239, -35.7275), 4326)
    WHEN t LIKE '%palmerston north%' OR t LIKE '%palmerston n%'
      THEN ST_SetSRID(ST_MakePoint(175.6113, -40.3523), 4326)
    -- Greater Wellington
    WHEN t LIKE '%lower hutt%' OR t LIKE '%hutt city%'
      THEN ST_SetSRID(ST_MakePoint(174.9076, -41.2092), 4326)
    WHEN t LIKE '%upper hutt%'
      THEN ST_SetSRID(ST_MakePoint(175.0706, -41.1244), 4326)
    WHEN t LIKE '%porirua%'
      THEN ST_SetSRID(ST_MakePoint(174.8410, -41.1337), 4326)
    WHEN t LIKE '%paraparaumu%' OR t LIKE '%kapiti%' OR t LIKE '%waikanae%'
      THEN ST_SetSRID(ST_MakePoint(174.9507, -40.9147), 4326)
    -- Manawatu-Whanganui
    WHEN t LIKE '%whanganui%' OR t LIKE '%wanganui%'
      THEN ST_SetSRID(ST_MakePoint(175.0479, -39.9301), 4326)
    WHEN t LIKE '%levin%' OR ta LIKE '%horowhenua%'
      THEN ST_SetSRID(ST_MakePoint(175.2750, -40.6218), 4326)
    WHEN t LIKE '%feilding%' OR ta LIKE '%manawatu%'
      THEN ST_SetSRID(ST_MakePoint(175.5662, -40.2240), 4326)
    -- Wairarapa
    WHEN t LIKE '%masterton%'
      THEN ST_SetSRID(ST_MakePoint(175.6578, -40.9597), 4326)
    WHEN t LIKE '%carterton%'
      THEN ST_SetSRID(ST_MakePoint(175.5280, -41.0249), 4326)
    WHEN t LIKE '%greytown%' OR t LIKE '%martinborough%' OR ta LIKE '%south wairarapa%'
      THEN ST_SetSRID(ST_MakePoint(175.4581, -41.0810), 4326)
    -- Waikato region
    WHEN t LIKE '%cambridge%'
      THEN ST_SetSRID(ST_MakePoint(175.4710, -37.8847), 4326)
    WHEN t LIKE '%te awamutu%'
      THEN ST_SetSRID(ST_MakePoint(175.3232, -38.0069), 4326)
    WHEN t LIKE '%tokoroa%' OR ta LIKE '%south waikato%'
      THEN ST_SetSRID(ST_MakePoint(175.8651, -38.2232), 4326)
    WHEN t LIKE '%matamata%'
      THEN ST_SetSRID(ST_MakePoint(175.7723, -37.8100), 4326)
    WHEN t LIKE '%huntly%' OR t LIKE '%ngaruawahia%' OR t LIKE '%tuakau%' OR t LIKE '%raglan%'
      THEN ST_SetSRID(ST_MakePoint(175.3140, -37.5560), 4326)
    WHEN t LIKE '%thames%'
      THEN ST_SetSRID(ST_MakePoint(175.5392, -37.1404), 4326)
    WHEN t LIKE '%paeroa%' OR t LIKE '%waihi%' OR ta LIKE '%hauraki%'
      THEN ST_SetSRID(ST_MakePoint(175.6717, -37.3711), 4326)
    WHEN t LIKE '%taupo%'
      THEN ST_SetSRID(ST_MakePoint(176.0702, -38.6857), 4326)
    WHEN t LIKE '%te kuiti%' OR ta LIKE '%waitomo%'
      THEN ST_SetSRID(ST_MakePoint(175.1614, -38.3335), 4326)
    WHEN t LIKE '%otorohanga%'
      THEN ST_SetSRID(ST_MakePoint(175.2121, -38.1815), 4326)
    -- Bay of Plenty
    WHEN t LIKE '%whakatane%' OR t LIKE '%ohope%'
      THEN ST_SetSRID(ST_MakePoint(176.9910, -37.9553), 4326)
    -- Canterbury region
    WHEN t LIKE '%timaru%'
      THEN ST_SetSRID(ST_MakePoint(171.2540, -44.3931), 4326)
    WHEN t LIKE '%ashburton%'
      THEN ST_SetSRID(ST_MakePoint(171.7476, -43.9007), 4326)
    WHEN t LIKE '%rangiora%' OR t LIKE '%kaiapoi%' OR ta LIKE '%waimakariri%'
      THEN ST_SetSRID(ST_MakePoint(172.5969, -43.3068), 4326)
    WHEN t LIKE '%rolleston%' OR t LIKE '%lincoln%' OR ta LIKE '%selwyn%'
      THEN ST_SetSRID(ST_MakePoint(172.3792, -43.5914), 4326)
    WHEN t LIKE '%kaikoura%'
      THEN ST_SetSRID(ST_MakePoint(173.6814, -42.3998), 4326)
    WHEN t LIKE '%oamaru%' OR ta LIKE '%waitaki%'
      THEN ST_SetSRID(ST_MakePoint(170.9745, -45.0966), 4326)
    -- Top of the South
    WHEN t LIKE '%blenheim%' OR ta LIKE '%marlborough%'
      THEN ST_SetSRID(ST_MakePoint(173.9613, -41.5138), 4326)
    WHEN t LIKE '%richmond%' OR ta LIKE '%tasman%'
      THEN ST_SetSRID(ST_MakePoint(173.1825, -41.3371), 4326)
    -- West Coast
    WHEN t LIKE '%greymouth%' OR ta LIKE '%grey%'
      THEN ST_SetSRID(ST_MakePoint(171.2108, -42.4500), 4326)
    WHEN t LIKE '%westport%' OR ta LIKE '%buller%'
      THEN ST_SetSRID(ST_MakePoint(171.6006, -41.7540), 4326)
    -- Otago
    WHEN t LIKE '%alexandra%' OR t LIKE '%cromwell%' OR ta LIKE '%central otago%'
      THEN ST_SetSRID(ST_MakePoint(169.3792, -45.2486), 4326)
    WHEN t LIKE '%balclutha%' OR ta LIKE '%clutha%'
      THEN ST_SetSRID(ST_MakePoint(169.7320, -46.2348), 4326)
    WHEN t LIKE '%wanaka%'
      THEN ST_SetSRID(ST_MakePoint(169.1320, -44.6996), 4326)
    -- Southland
    WHEN t LIKE '%gore%'
      THEN ST_SetSRID(ST_MakePoint(168.9446, -46.1011), 4326)
    -- Gisborne
    WHEN t LIKE '%gisborne%'
      THEN ST_SetSRID(ST_MakePoint(178.0176, -38.6623), 4326)
    -- Northland
    WHEN t LIKE '%kerikeri%' OR t LIKE '%kaikohe%' OR ta LIKE '%far north%'
      THEN ST_SetSRID(ST_MakePoint(176.1656, -35.2271), 4326)
    WHEN t LIKE '%dargaville%' OR ta LIKE '%kaipara%'
      THEN ST_SetSRID(ST_MakePoint(174.1131, -35.9340), 4326)
    -- Fallback: Wellington
    ELSE ST_SetSRID(ST_MakePoint(174.7762, -41.2865), 4326)
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Now update get_property_report to use the helper function
-- We replace the v_cbd_point assignment block
-- This requires recreating the function — done via the next deploy
-- For now the helper is available and rent_advisor.py has been updated

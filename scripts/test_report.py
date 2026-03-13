import psycopg, time, json

conn = psycopg.connect('dbname=wharescore user=postgres password=postgres')

# Pick one address from diverse suburbs
suburbs = ['Te Aro', 'Karori', 'Miramar', 'Johnsonville', 'Island Bay', 'Tawa', 'Newtown', 'Hataitai']
addrs = []
for s in suburbs:
    row = conn.execute(
        "SELECT address_id, full_address, suburb_locality FROM addresses WHERE suburb_locality = %s LIMIT 1", [s]
    ).fetchone()
    if row:
        addrs.append(row)

for aid, full, suburb in addrs:
    t0 = time.perf_counter()
    result = conn.execute('SELECT get_property_report(%s)', [aid]).fetchone()[0]
    elapsed = (time.perf_counter() - t0) * 1000

    prop = result.get('property', {})
    haz = result.get('hazards', {})
    liv = result.get('liveability', {})
    mkt = result.get('market', {})

    cv = prop.get('capital_value', '?')
    flood = haz.get('flood')
    nzdep = liv.get('nzdep_decile')
    schools = len(liv.get('schools_1500m') or [])
    rentals = len(mkt.get('rental_overview') or [])
    epb = haz.get('epb_count_300m', 0)

    print(f"{suburb:15s} ({aid}) {elapsed:5.0f}ms | CV={cv} nzdep={nzdep} flood={flood} epb={epb} schools={schools} rentals={rentals}")

conn.close()

import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'About | WhareScore',
  description: 'About WhareScore — free property intelligence for New Zealand.',
};

const DATA_SOURCES = [
  { name: 'LINZ Data Service', desc: 'Addresses, parcels, building outlines, property titles', url: 'https://data.linz.govt.nz/' },
  { name: 'GeoNet', desc: 'Earthquake events (M3+, 2015-present)', url: 'https://www.geonet.org.nz/' },
  { name: 'GWRC Open Data', desc: 'Flood zones, tsunami zones, liquefaction, contaminated land, wind zones', url: 'https://mapping.gw.govt.nz/' },
  { name: 'Stats NZ', desc: 'NZ Deprivation Index 2023, meshblock boundaries, SA2 boundaries', url: 'https://www.stats.govt.nz/' },
  { name: 'MBIE Tenancy Services', desc: 'Rental bond data (SA2-level, 1993-present), Market Rent API', url: 'https://www.tenancy.govt.nz/' },
  { name: 'Waka Kotahi NZTA', desc: 'Crash Analysis System, road noise contours', url: 'https://www.nzta.govt.nz/' },
  { name: 'Wellington City Council', desc: 'Property valuations, rates, district plan zones, height controls', url: 'https://wellington.govt.nz/' },
  { name: 'Ministry of Education', desc: 'School directory, enrolment zones', url: 'https://www.educationcounts.govt.nz/' },
  { name: 'RBNZ', desc: 'House Price Index (national quarterly)', url: 'https://www.rbnz.govt.nz/' },
  { name: 'OpenStreetMap', desc: 'Amenities, shops, cafes, parks', url: 'https://www.openstreetmap.org/' },
  { name: 'DOC', desc: 'Conservation land and reserves', url: 'https://doc.govt.nz/' },
  { name: 'Heritage NZ', desc: 'Heritage-listed places', url: 'https://www.heritage.org.nz/' },
  { name: 'LAWA', desc: 'Air quality and river water quality sites', url: 'https://www.lawa.org.nz/' },
  { name: 'Te Waihanga', desc: 'National infrastructure pipeline', url: 'https://www.tewaihanga.govt.nz/' },
];

export default function AboutPage() {
  return (
    <StaticPageLayout title="About WhareScore">
      <section className="space-y-4">
        <p>
          WhareScore is a proof-of-concept property intelligence platform for New Zealand.
          Our mission: <strong>&ldquo;Everything the listing doesn&rsquo;t tell you.&rdquo;</strong>
        </p>
        <p>
          Enter any NZ address and get a comprehensive report covering natural hazards,
          neighbourhood quality, crime, school proximity, transport access, fair rent analysis,
          council valuations, and planning context — all sourced from free government open data.
        </p>
        <p>
          WhareScore exists because property information in New Zealand is fragmented across
          dozens of government websites, council portals, and commercial platforms. We bring it
          all together in one place so renters, buyers, and researchers can make informed decisions.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Data Sources</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          All data is sourced from official government and open data providers under their
          respective Creative Commons licences.
        </p>
        <div className="space-y-2">
          {DATA_SOURCES.map((s) => (
            <div key={s.name} className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Visit
              </a>
            </div>
          ))}
        </div>
      </section>
    </StaticPageLayout>
  );
}

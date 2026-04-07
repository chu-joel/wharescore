import { StaticPageLayout } from '@/components/layout/StaticPageLayout';
import { Shield, FileSearch, TrendingUp, MapPin, Mountain } from 'lucide-react';

export const metadata = {
  title: 'About WhareScore — Free NZ Property Intelligence',
  description: 'WhareScore gives you everything the listing doesn\'t tell you about a New Zealand property. Risk scores, actionable recommendations, and fair rent & price analysis powered by 40+ official government data sources.',
  alternates: { canonical: 'https://wharescore.co.nz/about' },
};

const FEATURES = [
  {
    icon: Shield,
    title: 'Risk score (0-100)',
    desc: 'Covering flood zones, earthquake exposure, tsunami zones, landslide susceptibility, contaminated land, coastal erosion, and more.',
  },
  {
    icon: FileSearch,
    title: 'Actionable recommendations',
    desc: "Not just \u201Cthere\u2019s a risk\u201D \u2014 each finding comes with specific next steps sourced from NZ Civil Defence, GNS Science, NEMA, BRANZ, and council guidelines.",
  },
  {
    icon: TrendingUp,
    title: 'Fair rent & price analysis',
    desc: 'Using MBIE tenancy bond data and RBNZ house price indices to tell you if the asking rent or price is fair.',
  },
  {
    icon: MapPin,
    title: 'Neighbourhood reality check',
    desc: 'School zones, transit access, crime stats, noise levels, nearby amenities — the stuff you only find out after you move in.',
  },
  {
    icon: Mountain,
    title: 'Terrain & environment',
    desc: 'Elevation, slope, wind exposure, waterway proximity, and how these affect your property — inferred from SRTM elevation data and LINZ waterways.',
  },
];

const DATA_SOURCES = [
  { name: 'GNS Science', desc: 'Active faults, landslide database, seismic hazard models', url: 'https://www.gns.cri.nz/' },
  { name: 'LINZ Data Service', desc: 'Addresses, parcels, building outlines, river centrelines (Topo50)', url: 'https://data.linz.govt.nz/' },
  { name: 'GeoNet', desc: 'Earthquake events (M3+), volcanic alerts', url: 'https://www.geonet.org.nz/' },
  { name: 'NEMA / Civil Defence', desc: 'Emergency alerts, tsunami evacuation zones, preparedness guidelines', url: 'https://www.civildefence.govt.nz/' },
  { name: 'Regional Councils (25+)', desc: 'Flood zones, tsunami zones, liquefaction, slope failure, coastal erosion, wind zones', url: '#' },
  { name: 'Stats NZ', desc: 'NZ Deprivation Index 2023, SA2 boundaries, census data', url: 'https://www.stats.govt.nz/' },
  { name: 'MBIE Tenancy Services', desc: 'Rental bond data (SA2-level, 1993-present)', url: 'https://www.tenancy.govt.nz/' },
  { name: 'RBNZ', desc: 'House Price Index (national quarterly, 1990-present)', url: 'https://www.rbnz.govt.nz/' },
  { name: 'Waka Kotahi NZTA', desc: 'Crash Analysis System, road noise contours', url: 'https://www.nzta.govt.nz/' },
  { name: 'Ministry of Education', desc: 'School directory, enrolment zones, EQI ratings', url: 'https://www.educationcounts.govt.nz/' },
  { name: 'NIWA', desc: 'Climate projections, coastal hazard data', url: 'https://niwa.co.nz/' },
  { name: 'BRANZ', desc: 'Building standards, wind zone guidelines, exposed site detailing', url: 'https://www.branz.co.nz/' },
  { name: 'Open-Meteo', desc: 'Historical weather events (5 years)', url: 'https://open-meteo.com/' },
  { name: 'OpenStreetMap', desc: 'Amenities, shops, cafes, parks', url: 'https://www.openstreetmap.org/' },
  { name: 'DOC', desc: 'Conservation land and reserves', url: 'https://doc.govt.nz/' },
  { name: 'Heritage NZ', desc: 'Heritage-listed places', url: 'https://www.heritage.org.nz/' },
  { name: 'LAWA', desc: 'Air quality and river water quality monitoring', url: 'https://www.lawa.org.nz/' },
];

export default function AboutPage() {
  return (
    <StaticPageLayout title="About WhareScore">
      <section className="space-y-4">
        <p className="text-lg">
          <strong>WhareScore</strong> gives you everything the listing doesn&rsquo;t tell you about a New Zealand property.
        </p>
        <p>
          Enter any NZ address and get an instant property intelligence report powered by <strong>40+ official government data sources</strong> — including
          GNS Science, LINZ, regional councils, NZTA, Ministry of Education, Stats NZ, and NIWA.
        </p>
        <p>
          Every recommendation tells you exactly what to check, who to ask, and what it might cost — based on <strong>official NZ standards and post-disaster research</strong>, not opinions.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-4">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <f.icon className="h-5 w-5 text-piq-primary shrink-0" />
                <h3 className="font-semibold text-sm">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-1">Pricing</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Free on-screen reports show your risk score and top findings. Full reports include complete hazard breakdowns, AI-written summaries, personalised advice, and a permanent shareable report link.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">Free</p>
            <p className="text-sm text-muted-foreground mt-1">Score + top findings</p>
          </div>
          <div className="rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">Free</p>
            <p className="text-sm text-muted-foreground mt-1">Quick Report (sign in)</p>
          </div>
          <div className="rounded-xl border border-piq-primary p-4 text-center ring-1 ring-piq-primary">
            <p className="text-2xl font-bold">$9.99</p>
            <p className="text-sm text-muted-foreground mt-1">Full Report</p>
          </div>
          <div className="rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">$140<span className="text-sm font-normal">/mo</span></p>
            <p className="text-sm text-muted-foreground mt-1">Pro — 30 reports/mo</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-1">Who it&rsquo;s for</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Built for <strong>renters</strong> checking if a place is safe and fairly priced, and <strong>buyers</strong> doing due diligence before making the biggest purchase of their life.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Data sources</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          All data is sourced from official government and open data providers under their respective Creative Commons licences. No proprietary or paid data — everything we use is publicly available.
        </p>
        <div className="space-y-2">
          {DATA_SOURCES.map((s) => (
            <div key={s.name} className="flex items-start gap-3 rounded-md border p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              {s.url !== '#' && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  Visit
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </StaticPageLayout>
  );
}

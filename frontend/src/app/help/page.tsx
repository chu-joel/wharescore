import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'Help & FAQ — How WhareScore Property Reports Work',
  description: 'Common questions about WhareScore: how risk scores are calculated, where data comes from, rent estimate accuracy, pricing, and data coverage across New Zealand.',
  alternates: { canonical: 'https://wharescore.co.nz/help' },
};

const FAQ = [
  {
    q: 'What is WhareScore?',
    a: 'WhareScore is a property intelligence tool for New Zealand. We aggregate 100+ government open data sources to show you risk scores, hazard exposure, neighbourhood quality, and fair rent analysis for any NZ address.',
  },
  {
    q: 'How are risk scores calculated?',
    a: 'Each property gets a composite score from 0-100 across five categories: Risk & Hazards, Neighbourhood, Market, Transport, and Planning. Individual indicators are normalised to a 0-100 scale using expert-defined ranges, then combined using weighted averages. Lower scores mean lower risk. See the methodology badge on each indicator for details.',
  },
  {
    q: 'Where does the data come from?',
    a: 'All data comes from official New Zealand government sources: LINZ (addresses, parcels, titles), GeoNet (earthquakes), GNS Science (active faults, landslides), MBIE (rental bonds), Waka Kotahi (crashes, road noise), Stats NZ (deprivation, census), Heritage NZ, NIWA (coastal erosion), MfE (climate projections), plus council data from Auckland, Wellington, Christchurch, Hamilton, Tauranga, Dunedin, Napier/Hastings, and Nelson. Over 100 datasets in total.',
  },
  {
    q: 'How accurate is the fair rent estimate?',
    a: 'Fair rent estimates use MBIE Tenancy Services bond data at the SA2 (suburb) level, filtered by dwelling type and bedrooms. The estimate shows where your rent sits relative to the lower quartile, median, and upper quartile for similar properties in your area. This is statistical data, not a formal valuation.',
  },
  {
    q: 'Why is some data missing for my property?',
    a: 'We cover Auckland, Wellington, Christchurch, Hamilton, Tauranga, Dunedin, Napier/Hastings, and Nelson with council-specific data. National datasets (earthquakes, schools, crime, heritage) cover all of NZ. Some councils publish more data than others — the coverage badge on each report shows how many risk checks are available for your address.',
  },
  {
    q: 'How much does WhareScore cost?',
    a: 'Every address gets a free on-screen report with risk scores, hazard flags, and neighbourhood overview. Sign in to get a free Quick Report — a shareable hosted link with key findings and hazard summary. Full Reports ($9.99, or $4.99 for Pro subscribers) add AI-written summary, rent/price advice, terrain analysis, and 25+ sections of detailed analysis. Professionals can get 30 Full Reports per month for $140, plus extras at $4.99 each.',
  },
  {
    q: 'Can I use this data for legal or financial decisions?',
    a: 'No. WhareScore reports are for informational purposes only and should not be relied upon for legal, financial, or property purchase decisions. Always consult qualified professionals. See our Terms of Use for full disclaimers.',
  },
];

export default function HelpPage() {
  return (
    <StaticPageLayout title="Help & FAQ">
      <p className="text-muted-foreground">
        Common questions about using WhareScore and understanding your property reports.
      </p>
      <div className="mt-6 space-y-6">
        {FAQ.map((item, i) => (
          <details key={i} className="group rounded-lg border p-4">
            <summary className="cursor-pointer list-none font-semibold">
              <span className="flex items-center justify-between">
                {item.q}
                <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true">
                  ▾
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </StaticPageLayout>
  );
}

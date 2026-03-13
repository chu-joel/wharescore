import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: 'Help & FAQ | WhareScore',
  description: 'Frequently asked questions about WhareScore property reports.',
};

const FAQ = [
  {
    q: 'What is WhareScore?',
    a: 'WhareScore is a free property intelligence tool for New Zealand. We aggregate government open data to show you risk scores, hazard exposure, neighbourhood quality, and fair rent analysis for any NZ address.',
  },
  {
    q: 'How are risk scores calculated?',
    a: 'Each property gets a composite score from 0-100 across five categories: Risk & Hazards, Neighbourhood, Market, Transport, and Planning. Individual indicators are normalised to a 0-100 scale using expert-defined ranges, then combined using weighted averages. Lower scores mean lower risk. See the methodology badge on each indicator for details.',
  },
  {
    q: 'Where does the data come from?',
    a: 'All data comes from official New Zealand government sources: LINZ (addresses, parcels, building outlines), GeoNet (earthquakes), GWRC (flood zones, contaminated land), Stats NZ (deprivation, census), MBIE (rental bonds), Waka Kotahi (crashes, road noise), Wellington City Council (valuations, rates, zoning), and more. Each data point shows its source and last update date.',
  },
  {
    q: 'How accurate is the fair rent estimate?',
    a: 'Fair rent estimates use MBIE Tenancy Services bond data at the SA2 (suburb) level, filtered by dwelling type and bedrooms. The estimate shows where your rent sits relative to the lower quartile, median, and upper quartile for similar properties in your area. This is statistical data, not a formal valuation.',
  },
  {
    q: 'Why is some data missing for my property?',
    a: 'Data coverage varies by region. Some datasets (flood zones, council rates, zoning) are Wellington-specific in this POC. The coverage badge on each report shows how many data layers are available for your address.',
  },
  {
    q: 'Is WhareScore free?',
    a: 'Yes. During beta, all reports are completely free with no account required. We plan to keep a comprehensive free tier and may offer premium deep-analysis reports in the future.',
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

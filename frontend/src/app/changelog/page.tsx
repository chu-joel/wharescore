import { StaticPageLayout } from '@/components/layout/StaticPageLayout';

export const metadata = {
  title: "What's New in WhareScore. Changelog",
  description: "Recent updates, new features, and data refreshes for WhareScore property reports. Track what's changed in risk scores, data coverage, and report features.",
  alternates: { canonical: 'https://wharescore.co.nz/changelog' },
};

const ENTRIES = [
  {
    date: 'March 2026',
    version: '0.1.0-beta',
    title: 'Initial Beta Launch',
    items: [
      'Property reports with composite risk scores across 5 categories',
      '44 data tables with 18M+ records from NZ government open data',
      'Fair rent estimation using MBIE bond data at SA2 level',
      'Interactive map with 24 vector tile layers (hazards, zones, amenities)',
      'Council valuation display for Wellington properties',
      'WCC rates lookup with full levy breakdown',
      'AI-generated area profile summaries',
      'Multi-unit building detection with unit comparison tables',
      'Mobile-first responsive design with bottom sheet navigation',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <StaticPageLayout title="What&rsquo;s New">
      <p className="text-muted-foreground">
        Recent updates, new features, and data refresh dates.
      </p>

      <div className="mt-6 space-y-8">
        {ENTRIES.map((entry) => (
          <div key={entry.version} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {entry.version}
              </span>
              <span className="text-sm text-muted-foreground">{entry.date}</span>
            </div>
            <h3 className="mb-2 font-semibold">{entry.title}</h3>
            <ul className="list-disc space-y-1.5 pl-6 text-sm text-muted-foreground">
              {entry.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </StaticPageLayout>
  );
}

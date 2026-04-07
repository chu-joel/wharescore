import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/layout/AppHeader';

const API_BASE = process.env.INTERNAL_API_URL || 'http://api:8000';
const SITE = 'https://wharescore.co.nz';

type GuideListItem = {
  slug: string;
  suburb_name: string;
  ta_name: string | null;
  region_name: string | null;
};

export const metadata: Metadata = {
  title: 'New Zealand Suburb Guides | WhareScore',
  description:
    'Independent, data-driven guides to New Zealand suburbs. Rent, schools, safety, and demographics at the SA2 level.',
  alternates: { canonical: `${SITE}/suburbs` },
  robots: { index: true, follow: true },
};

async function fetchGuides(): Promise<GuideListItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/suburbs/guides?limit=5000`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

export default async function SuburbsIndexPage() {
  const guides = await fetchGuides();
  const byTa = new Map<string, GuideListItem[]>();
  for (const g of guides) {
    const key = g.ta_name ?? 'Other';
    if (!byTa.has(key)) byTa.set(key, []);
    byTa.get(key)!.push(g);
  }
  const taNames = Array.from(byTa.keys()).sort();

  return (
    <>
      <AppHeader />
      <main className="pt-14">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">New Zealand Suburb Guides</h1>
            <p className="mt-2 text-muted-foreground">
              {guides.length.toLocaleString()} suburbs · Independent data on rent, schools, safety, and demographics.
            </p>
          </header>

          {taNames.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No published guides yet. Check back soon.
            </p>
          )}

          {taNames.map((ta) => (
            <section key={ta} className="mt-6">
              <h2 className="mb-2 text-lg font-semibold">{ta}</h2>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                {byTa.get(ta)!.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/suburbs/${g.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {g.suburb_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}

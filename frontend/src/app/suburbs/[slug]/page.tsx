import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/layout/AppHeader';

// Server-side: reach API via Docker internal network or localhost
const API_BASE = process.env.INTERNAL_API_URL || 'http://api:8000';
const SITE = 'https://wharescore.co.nz';

type GuideSection = { key: string; heading: string; body: string };
type GuideFaq = { question: string; answer: string };
type GuideLink = { slug: string; name: string };
type GuideKeyStats = Record<string, number | null | string>;

type Guide = {
  sa2_code: string;
  slug: string;
  suburb_name: string;
  ta_name: string | null;
  region_name: string | null;
  title: string;
  meta_description: string;
  h1: string;
  intro: string;
  sections: GuideSection[];
  faqs: GuideFaq[];
  key_stats: GuideKeyStats;
  internal_links: GuideLink[];
  word_count: number;
  generated_at: string;
  updated_at: string;
  published_at: string | null;
};

async function fetchGuide(slug: string): Promise<Guide | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/suburbs/guide/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`status ${res.status}`);
    return (await res.json()) as Guide;
  } catch (e) {
    console.error('fetchGuide failed', e);
    return null;
  }
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await fetchGuide(slug);
  if (!guide) {
    return { title: 'Suburb guide not found | WhareScore', robots: { index: false } };
  }
  const canonical = `${SITE}/suburbs/${guide.slug}`;
  return {
    title: guide.title,
    description: guide.meta_description,
    alternates: { canonical },
    openGraph: {
      title: guide.title,
      description: guide.meta_description,
      url: canonical,
      type: 'article',
      siteName: 'WhareScore',
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.meta_description,
    },
    robots: { index: true, follow: true },
  };
}

function formatStat(key: string, value: number | string | null | undefined): string | null {
  if (value == null) return null;
  if (key === 'median_rent_primary') return `$${Number(value).toLocaleString()}/wk`;
  if (key === 'area_km2') return `${Number(value).toFixed(2)} km²`;
  if (key === 'property_count') return Number(value).toLocaleString();
  if (key === 'nzdep') return `${Number(value).toFixed(1)}/10`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

const STAT_LABELS: Record<string, string> = {
  area_km2: 'Area',
  property_count: 'Properties',
  nzdep: 'NZDep',
  'schools_within_1.5km': 'Schools within 1.5 km',
  transit_stops_within_400m: 'Transit stops within 400 m',
  crime_per_10k: 'Crime per 10k (TA)',
  median_rent_primary: 'Median rent (primary)',
};

export default async function SuburbGuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await fetchGuide(slug);
  if (!guide) notFound();

  const canonical = `${SITE}/suburbs/${guide.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.h1,
        description: guide.meta_description,
        mainEntityOfPage: canonical,
        datePublished: guide.published_at ?? guide.generated_at,
        dateModified: guide.updated_at,
        author: { '@type': 'Organization', name: 'WhareScore' },
        publisher: {
          '@type': 'Organization',
          name: 'WhareScore',
          url: SITE,
        },
        about: {
          '@type': 'Place',
          name: guide.suburb_name,
          containedInPlace: guide.ta_name
            ? { '@type': 'AdministrativeArea', name: guide.ta_name }
            : undefined,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Suburbs', item: `${SITE}/suburbs` },
          { '@type': 'ListItem', position: 3, name: guide.suburb_name, item: canonical },
        ],
      },
      guide.faqs.length > 0
        ? {
            '@type': 'FAQPage',
            mainEntity: guide.faqs.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }
        : null,
    ].filter(Boolean),
  };

  return (
    <>
      <AppHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="pt-14">
        <article className="mx-auto max-w-3xl px-4 py-8">
          {/* Breadcrumb */}
          <nav className="mb-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span className="mx-1.5">/</span>
            <Link href="/suburbs" className="hover:text-foreground">Suburbs</Link>
            {guide.ta_name && (
              <>
                <span className="mx-1.5">/</span>
                <span className="text-foreground">{guide.ta_name}</span>
              </>
            )}
            <span className="mx-1.5">/</span>
            <span className="text-foreground">{guide.suburb_name}</span>
          </nav>

          {/* H1 + intro */}
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">{guide.h1}</h1>
            {guide.ta_name && (
              <p className="mt-1 text-sm text-muted-foreground">
                {guide.ta_name}
                {guide.region_name ? `, ${guide.region_name}` : ''}
              </p>
            )}
          </header>

          <p className="text-base leading-relaxed">{guide.intro}</p>

          {/* Key stats strip */}
          {guide.key_stats && Object.keys(guide.key_stats).length > 0 && (
            <section className="my-6 grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
              {Object.entries(guide.key_stats).map(([k, v]) => {
                const formatted = formatStat(k, v);
                if (formatted == null) return null;
                return (
                  <div key={k} className="text-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {STAT_LABELS[k] ?? k}
                    </div>
                    <div className="mt-0.5 font-semibold">{formatted}</div>
                  </div>
                );
              })}
            </section>
          )}

          {/* Primary CTA */}
          <div className="my-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Looking at a specific property in {guide.suburb_name}?</div>
                <div className="text-sm text-muted-foreground">
                  Get an address-level WhareScore report with 40+ data layers.
                </div>
              </div>
              <Link
                href="/"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Search an address
              </Link>
            </div>
          </div>

          {/* Sections */}
          {guide.sections.map((s) => (
            <section key={s.key} className="mt-8">
              <h2 className="mb-2 text-xl font-semibold">{s.heading}</h2>
              <div className="space-y-3 text-base leading-relaxed">
                {s.body.split(/\n\s*\n/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}

          {/* FAQs */}
          {guide.faqs.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-xl font-semibold">Frequently asked questions</h2>
              <div className="space-y-4">
                {guide.faqs.map((f, i) => (
                  <div key={i}>
                    <h3 className="font-medium">{f.question}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Internal links */}
          {guide.internal_links.length > 0 && (
            <section className="mt-10 border-t pt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Nearby suburbs
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {guide.internal_links.map((link) => (
                  <li key={link.slug}>
                    <Link
                      href={`/suburbs/${link.slug}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer meta */}
          <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
            <p>
              Data sourced from StatsNZ, LINZ, MBIE, NZ Police, and council open data.
              Last updated {new Date(guide.updated_at).toLocaleDateString('en-NZ')}.
            </p>
            <p className="mt-1">
              This guide is informational and does not replace professional advice.
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}

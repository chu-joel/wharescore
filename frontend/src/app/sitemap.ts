import type { MetadataRoute } from 'next';

const baseUrl = 'https://wharescore.co.nz';
const API_BASE = process.env.INTERNAL_API_URL || 'http://api:8000';

type GuideListItem = {
  slug: string;
  updated_at?: string;
  published_at?: string | null;
};

async function fetchGuideSlugs(): Promise<GuideListItem[]> {
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/suburbs`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/signin`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/account`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/changelog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.4 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const guides = await fetchGuideSlugs();
  const guideEntries: MetadataRoute.Sitemap = guides.map((g) => ({
    url: `${baseUrl}/suburbs/${g.slug}`,
    lastModified: g.updated_at ? new Date(g.updated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...guideEntries];
}

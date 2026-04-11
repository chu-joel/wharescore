import './print.css';
import type { Metadata } from 'next';

// Server-side: reach API via Docker internal network or localhost
const API_BASE = process.env.INTERNAL_API_URL || 'http://api:8000';

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    // Revalidate every 60s so a Quick → Full upgrade reflects in the page title promptly.
    // Reports are noindex so crawl latency is not a concern; this mainly affects link previews.
    const res = await fetch(`${API_BASE}/api/v1/report/${encodeURIComponent(token)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('not found');
    const snapshot = await res.json();

    const address = snapshot?.meta?.full_address || 'Property Report';
    const suburb = snapshot?.meta?.sa2_name || '';
    const city = snapshot?.meta?.ta_name || '';
    const score = snapshot?.report?.scores?.composite;
    const isQuick = snapshot?.report_tier === 'quick';
    // Full reports say "Report" (the default); only Quick is branded separately.
    const tierPrefix = isQuick ? 'Quick Report' : 'Report';

    const locationParts = [suburb, city].filter(Boolean).join(', ');
    const scoreStr = score != null ? ` Score: ${Math.round(score)}/100.` : '';
    const title = `${tierPrefix} — ${address}`;
    const description = `WhareScore ${tierPrefix.toLowerCase()} for ${address}${locationParts ? ` in ${locationParts}` : ''}.${scoreStr} Hazards, schools, transit, market data and more.`;

    return {
      title,
      description,
      openGraph: {
        title: `${address} — WhareScore Report`,
        description,
        type: 'article',
      },
      twitter: {
        card: 'summary',
        title: `${address} — WhareScore`,
        description,
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch {
    return {
      title: 'Property Report',
      description: 'WhareScore property intelligence report for a New Zealand address.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

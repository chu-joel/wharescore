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
    const res = await fetch(`${API_BASE}/api/v1/report/${encodeURIComponent(token)}`, {
      next: { revalidate: 86400 }, // Cache 24h — snapshots are immutable
    });
    if (!res.ok) throw new Error('not found');
    const snapshot = await res.json();

    const address = snapshot?.meta?.full_address || 'Property Report';
    const suburb = snapshot?.meta?.sa2_name || '';
    const city = snapshot?.meta?.ta_name || '';
    const score = snapshot?.report?.scores?.composite;
    const tier = snapshot?.report_tier === 'quick' ? 'Quick' : 'Full';

    const locationParts = [suburb, city].filter(Boolean).join(', ');
    const scoreStr = score != null ? ` Score: ${Math.round(score)}/100.` : '';
    const title = `${tier} Report — ${address}`;
    const description = `WhareScore ${tier} Report for ${address}${locationParts ? ` in ${locationParts}` : ''}.${scoreStr} Hazards, schools, transit, market data and more.`;

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

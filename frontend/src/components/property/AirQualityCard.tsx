'use client';

import { Wind } from 'lucide-react';

interface AirQualityCardProps {
  trend: string | null;
  site: string | null;
  distanceM: number | null;
}

function getTrendInfo(trend: string) {
  const t = trend.toLowerCase();
  if (t === 'improving') return { label: 'Improving', color: 'text-piq-success', icon: '↓' };
  if (t === 'degrading') return { label: 'Degrading', color: 'text-red-500', icon: '↑' };
  return { label: trend, color: 'text-muted-foreground', icon: '→' };
}

function getRelevance(distanceM: number) {
  if (distanceM < 2000) return { label: 'High', color: 'text-piq-success' };
  if (distanceM < 5000) return { label: 'Medium', color: 'text-amber-500' };
  return { label: 'Low', color: 'text-orange-500' };
}

export function AirQualityCard({ trend, site, distanceM }: AirQualityCardProps) {
  if (!trend) return null;

  const info = getTrendInfo(trend);
  const distKm = distanceM ? (distanceM / 1000).toFixed(1) : null;
  const relevance = distanceM ? getRelevance(distanceM) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-3">
        <Wind className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Air Quality</span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Regional</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-xl font-bold ${info.color}`}>{info.icon}</span>
        <span className={`text-lg font-semibold ${info.color}`}>{info.label}</span>
      </div>

      {site && (
        <p className="text-xs text-muted-foreground">
          Nearest LAWA station: {site}
          {distKm && <> &middot; {distKm} km away</>}
        </p>
      )}

      {relevance && (
        <p className="text-xs mt-1">
          <span className={`font-medium ${relevance.color}`}>{relevance.label} relevance</span>
          <span className="text-muted-foreground">
            {relevance.label === 'High' && '. station is nearby'}
            {relevance.label === 'Medium' && '. station is moderately distant'}
            {relevance.label === 'Low' && '. treat as regional indicator only'}
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-2 italic">
        Only 72 LAWA monitoring sites exist nationwide. This is a regional trend, not a property-specific reading.
      </p>
    </div>
  );
}

'use client';

import { ThumbsUp, AlertTriangle, Info } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

interface AmenityItem {
  name: string;
  label: string;
  distance_m: number;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

export function HostedNearbyHighlights({ snapshot }: Props) {
  const highlights = snapshot.nearby_highlights;
  if (!highlights) return null;

  const good = ((highlights.good ?? []) as unknown as AmenityItem[]).slice(0, 10);
  const caution = ((highlights.caution ?? []) as unknown as AmenityItem[]).slice(0, 8);
  const info = ((highlights.info ?? []) as unknown as AmenityItem[]).slice(0, 6);

  if (good.length === 0 && caution.length === 0 && info.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-lg font-bold">What's Nearby</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Within 1.5km of this property</p>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {good.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ThumbsUp className="h-3.5 w-3.5 text-piq-success" />
              <h4 className="text-sm font-semibold text-piq-success">Good to have nearby</h4>
            </div>
            <div className="space-y-1">
              {good.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{item.name || item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDistance(item.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {caution.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-piq-accent-warm" />
              <h4 className="text-sm font-semibold text-piq-accent-warm">Be aware of</h4>
            </div>
            <div className="space-y-1">
              {caution.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{item.name || item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDistance(item.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {info.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              <h4 className="text-sm font-semibold text-blue-600">Also nearby</h4>
            </div>
            <div className="space-y-1">
              {info.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span>{item.name || item.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDistance(item.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

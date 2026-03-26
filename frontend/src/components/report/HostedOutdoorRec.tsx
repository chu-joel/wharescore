'use client';

import { Mountain, TreePine, Tent } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface DocItem {
  name: string;
  status: string;
  category: string;
  distance_m: number;
}

interface Props {
  snapshot: ReportSnapshot;
}

export function HostedOutdoorRec({ snapshot }: Props) {
  const doc = (snapshot as Record<string, unknown>).nearby_doc as
    { huts: DocItem[]; tracks: DocItem[]; campsites: DocItem[] } | undefined;

  if (!doc) return null;

  const huts = doc.huts ?? [];
  const tracks = doc.tracks ?? [];
  const campsites = doc.campsites ?? [];

  const total = huts.length + tracks.length + campsites.length;
  if (total === 0) return null;

  const formatDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Mountain className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Outdoor & Recreation</h3>
        <span className="text-xs text-muted-foreground ml-auto">within 5km</span>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {/* DOC Tracks */}
        {tracks.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <TreePine className="h-3.5 w-3.5 text-green-600" />
              Walking & Tramping Tracks ({tracks.length})
            </h4>
            <div className="divide-y divide-border/50">
              {tracks.slice(0, 5).map((t, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name || 'DOC Track'}</p>
                    <p className="text-[10px] text-muted-foreground">{t.category || t.status}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDist(t.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOC Huts */}
        {huts.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Mountain className="h-3.5 w-3.5 text-amber-600" />
              DOC Huts ({huts.length})
            </h4>
            <div className="divide-y divide-border/50">
              {huts.slice(0, 5).map((h, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{h.name || 'DOC Hut'}</p>
                    <p className="text-[10px] text-muted-foreground">{h.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDist(h.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOC Campsites */}
        {campsites.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Tent className="h-3.5 w-3.5 text-blue-600" />
              DOC Campsites ({campsites.length})
            </h4>
            <div className="divide-y divide-border/50">
              {campsites.slice(0, 5).map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || 'DOC Campsite'}</p>
                    <p className="text-[10px] text-muted-foreground">{c.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">{formatDist(c.distance_m)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Source: Department of Conservation. Distances are straight-line.
        </p>
      </div>
    </div>
  );
}

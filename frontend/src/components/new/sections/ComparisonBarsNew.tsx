'use client';

import type { PropertyReport } from '@/lib/types';
import { Card, CardHead, BarRow } from '@/components/new/ui/primitives';

/**
 * 5-row comparison vs SA2 median. Reads from the transformed shape:
 * comparisons.suburb (ComparisonAverages), liveability, hazards.
 */
export function ComparisonBarsNew({ report }: { report: PropertyReport }) {
  const sub = report.comparisons?.suburb;
  if (!sub) return null;

  const live = report.liveability;
  const haz = report.hazards;

  const schoolCount = live.school_count ?? 0;
  const transitCount = live.transit_count ?? 0;
  const epbCount = haz.epb_count ?? 0;
  const noiseDb = report.environment?.noise_db ?? null;
  const nzDep = live.nzdep_score;

  return (
    <Card>
      <CardHead title="How this site compares" meta={`vs ${sub.label} median`} />
      <div className="ws-card-body">
        <BarRow
          label="Schools 1.5 km"
          value={String(schoolCount)}
          fillPct={pct(schoolCount, 16)}
          refPct={pct(sub.school_count_1500m, 16)}
        />
        <BarRow
          label="Transit 400 m"
          value={String(transitCount)}
          fillPct={pct(transitCount, 30)}
          refPct={pct(sub.transit_count_400m, 30)}
        />
        <BarRow
          label="EPBs 300 m"
          value={String(epbCount)}
          fillPct={pct(epbCount, 40)}
          refPct={pct(sub.epb_count_300m, 40)}
          fillColor="var(--ws-r-vhigh)"
        />
        {noiseDb != null && (
          <BarRow
            label="Road noise"
            hint="(dB)"
            value={`≤${Math.round(noiseDb)}`}
            fillPct={pct(noiseDb, 90)}
            refPct={pct(sub.max_noise_db, 90)}
          />
        )}
        {nzDep != null && (
          <BarRow
            label="NZDep"
            hint="(lower = less deprived)"
            value={`decile ${nzDep}`}
            fillPct={100 - pct(nzDep, 10)}
            refPct={100 - pct(sub.avg_nzdep, 10)}
            fillColor="var(--ws-success)"
            lowerIsBetter
          />
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 3, background: 'var(--ws-piq)', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }}/> This site</span>
          <span><span style={{ display: 'inline-block', width: 2, height: 12, background: 'var(--ws-ink)', marginRight: 6, verticalAlign: 'middle' }}/> Suburb median</span>
        </div>
      </div>
    </Card>
  );
}

function pct(value: number | null | undefined, max: number): number {
  if (value == null || max <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(value) / max) * 100));
}

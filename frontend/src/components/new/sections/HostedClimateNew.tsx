'use client';

import { useState } from 'react';
import { Sun, CloudRain, Wind, Thermometer } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASONS = { Summer: [12, 1, 2], Autumn: [3, 4, 5], Winter: [6, 7, 8], Spring: [9, 10, 11] };

function avg(vs: (number | null)[]): number | null {
  const v = vs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
}
function sumN(vs: (number | null)[]): number | null {
  const v = vs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0)) : null;
}
function nowSeasonIdx(): number {
  const m = new Date().getMonth() + 1;
  if ([12, 1, 2].includes(m)) return 0;
  if ([3, 4, 5].includes(m)) return 1;
  if ([6, 7, 8].includes(m)) return 2;
  return 3;
}

export function HostedClimateNew({ snapshot }: { snapshot: ReportSnapshot }) {
  const data = snapshot.climate_normals;
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHead title="Climate" />
        <div className="ws-card-body" style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '24px 16px' }}>
          <Sun size={28} style={{ color: 'var(--ws-ink-mute)', opacity: 0.4, marginBottom: 6 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ws-ink-soft)' }}>Climate data not available for this location.</p>
        </div>
      </Card>
    );
  }

  const locationName = data[0]?.location_name || 'this area';
  const byMonth = new Map<number, typeof data[0]>();
  for (const d of data) byMonth.set(d.month, d);
  const allMonths = Array.from(byMonth.values());

  const seasons = Object.entries(SEASONS).map(([name, months]) => {
    const md = months.map((m) => byMonth.get(m)).filter(Boolean) as typeof data;
    return {
      name,
      tempMax: avg(md.map((d) => d.temp_max)),
      tempMin: avg(md.map((d) => d.temp_min)),
      rainfall: sumN(md.map((d) => d.precipitation_mm)),
      rainDays: avg(md.map((d) => d.rain_days)),
      wind: avg(md.map((d) => d.wind_speed_mean)),
    };
  });

  const annualRain = sumN(allMonths.map((d) => d.precipitation_mm));
  const hottest = allMonths.reduce((a, b) => ((a?.temp_max ?? 0) > (b?.temp_max ?? 0) ? a : b), allMonths[0]);
  const coldest = allMonths.reduce((a, b) => ((a?.temp_min ?? 99) < (b?.temp_min ?? 99) ? a : b), allMonths[0]);
  const avgWind = avg(allMonths.map((d) => d.wind_speed_mean));

  const tempMax = Math.max(...allMonths.map((d) => d.temp_max ?? 0));
  const tempMin = Math.min(...allMonths.map((d) => d.temp_min ?? 99));

  return (
    <Card>
      <CardHead title="Climate" meta={`Typical weather near ${locationName} (10-yr avg)`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        {/* Highlight cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <Stat Icon={Thermometer} fg="var(--ws-r-vhigh)" bg="rgba(196,45,45,.06)" value={`${hottest?.temp_max ?? '–'}°`} label={`Warmest (${MONTHS[(hottest?.month ?? 1) - 1]})`} />
          <Stat Icon={Thermometer} fg="var(--ws-r-low)"  bg="rgba(86,180,233,.10)"  value={`${coldest?.temp_min ?? '–'}°`} label={`Coldest (${MONTHS[(coldest?.month ?? 1) - 1]})`} />
          <Stat Icon={CloudRain}   fg="var(--ws-piq)"    bg="rgba(13,115,119,.06)"  value={`${annualRain ?? '–'}`}        label="mm rain / year" />
          <Stat Icon={Wind}        fg="var(--ws-ink-mute)" bg="var(--ws-bg-2)"      value={`${avgWind ?? '–'}`}            label="km/h avg wind" />
        </div>

        {/* Monthly temp range */}
        <div>
          <h4 style={subHeading}>Monthly temperature range</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = byMonth.get(i + 1);
              if (!m) return null;
              const tMax = m.temp_max ?? 0;
              const tMin = m.temp_min ?? 0;
              const range = tempMax - tempMin || 1;
              const bottom = ((tMin - tempMin) / range) * 100;
              const height = ((tMax - tMin) / range) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', position: 'relative', height: 80 }}>
                    <div style={{
                      position: 'absolute', width: '100%',
                      bottom: `${bottom}%`, height: `${Math.max(height, 4)}%`,
                      background: 'linear-gradient(to top, #56B4E9 0%, #E69F00 100%)',
                      opacity: 0.7,
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--ws-ink-mute)', marginTop: 2 }}>{MONTHS[i]}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ws-ink-mute)', marginTop: 4 }}>
            <span>{Math.round(tempMin)}°C</span>
            <span>{Math.round(tempMax)}°C</span>
          </div>
        </div>

        <SeasonalSummary seasons={seasons} />

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: Open-Meteo Climate API (EC-Earth3P-HR model, 10-year average 2010-2019).
        </p>
      </div>
    </Card>
  );
}

function Stat({ Icon, fg, bg, value, label }: { Icon: typeof Sun; fg: string; bg: string; value: string; label: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 'var(--ws-radius-sm)',
      padding: '10px 12px', textAlign: 'center',
    }}>
      <Icon size={14} style={{ color: fg, margin: '0 auto 4px', display: 'block' }} />
      <div style={{ fontSize: 18, fontWeight: 700, color: fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: fg, opacity: 0.85 }}>{label}</div>
    </div>
  );
}

interface SeasonData { name: string; tempMax: number | null; tempMin: number | null; rainfall: number | null; rainDays: number | null; wind: number | null }

function SeasonalSummary({ seasons }: { seasons: SeasonData[] }) {
  const [showAll, setShowAll] = useState(false);
  const cur = nowSeasonIdx();
  const nxt = (cur + 1) % 4;
  const visible = showAll ? seasons : [seasons[cur], seasons[nxt]];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h4 style={subHeading}>Seasonal summary</h4>
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          style={{
            background: 'transparent', border: 0, padding: '4px 0', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ws-piq-dark)',
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >
          {showAll ? 'Show less' : 'Show all seasons'}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Season</th>
              <th style={{ ...th, textAlign: 'right' }}>High</th>
              <th style={{ ...th, textAlign: 'right' }}>Low</th>
              <th style={{ ...th, textAlign: 'right' }}>Rain</th>
              <th style={{ ...th, textAlign: 'right' }}>Rain days</th>
              <th style={{ ...th, textAlign: 'right' }}>Wind</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.name} style={{ borderTop: '1px solid var(--ws-rule)' }}>
                <td style={{ ...td, fontWeight: 500, color: 'var(--ws-ink)' }}>
                  {s.name}{s.name === seasons[cur].name ? ' (now)' : ''}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>{s.tempMax ?? '–'}°</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.tempMin ?? '–'}°</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.rainfall ?? '–'}mm</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.rainDays ?? '–'}/mo</td>
                <td style={{ ...td, textAlign: 'right' }}>{s.wind ?? '–'}km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const subHeading: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
};
const th: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left',
  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--ws-piq-dark)',
};
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: 'var(--ws-ink-soft)' };

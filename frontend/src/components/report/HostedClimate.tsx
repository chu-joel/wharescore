'use client';

import { useState } from 'react';
import { Sun, CloudRain, Wind, Thermometer } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASON_MONTHS = { Summer: [12, 1, 2], Autumn: [3, 4, 5], Winter: [6, 7, 8], Spring: [9, 10, 11] };

function avg(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v != null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10 : null;
}

function sum(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v != null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0)) : null;
}

export function HostedClimate({ snapshot }: Props) {
  const data = snapshot.climate_normals;
  if (!data || data.length === 0) return (
    <section className="bg-card rounded-xl border border-border p-6 text-center">
      <Sun className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Climate data not available for this location</p>
    </section>
  );

  const locationName = data[0]?.location_name || 'this area';

  // Build month lookup
  const byMonth = new Map<number, typeof data[0]>();
  for (const d of data) byMonth.set(d.month, d);

  // Seasonal summaries
  const seasons = Object.entries(SEASON_MONTHS).map(([name, months]) => {
    const monthData = months.map(m => byMonth.get(m)).filter(Boolean) as typeof data;
    return {
      name,
      tempMean: avg(monthData.map(d => d.temp_mean)),
      tempMax: avg(monthData.map(d => d.temp_max)),
      tempMin: avg(monthData.map(d => d.temp_min)),
      rainfall: sum(monthData.map(d => d.precipitation_mm)),
      rainDays: avg(monthData.map(d => d.rain_days)),
      wind: avg(monthData.map(d => d.wind_speed_mean)),
    };
  });

  // Annual stats
  const allMonths = Array.from(byMonth.values());
  const annualRain = sum(allMonths.map(d => d.precipitation_mm));
  const annualRainDays = sum(allMonths.map(d => d.rain_days));
  const hottestMonth = allMonths.reduce((a, b) => ((a?.temp_max ?? 0) > (b?.temp_max ?? 0) ? a : b), allMonths[0]);
  const coldestMonth = allMonths.reduce((a, b) => ((a?.temp_min ?? 99) < (b?.temp_min ?? 99) ? a : b), allMonths[0]);

  // Temperature bar chart (monthly max/min range)
  const tempMax = Math.max(...allMonths.map(d => d.temp_max ?? 0));
  const tempMinAll = Math.min(...allMonths.map(d => d.temp_min ?? 99));

  return (
    <section id="climate" className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          Climate
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Typical weather near {locationName} (10-year average)</p>
      </div>

      <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
        {/* Highlight cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-red-50 rounded-lg p-2.5 text-center">
            <Thermometer className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-red-600">{hottestMonth?.temp_max ?? '\u2013'}&deg;</div>
            <div className="text-xs text-red-500">Warmest ({MONTH_NAMES[(hottestMonth?.month ?? 1) - 1]})</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2.5 text-center">
            <Thermometer className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-blue-600">{coldestMonth?.temp_min ?? '\u2013'}&deg;</div>
            <div className="text-xs text-blue-500">Coldest ({MONTH_NAMES[(coldestMonth?.month ?? 1) - 1]})</div>
          </div>
          <div className="bg-cyan-50 rounded-lg p-2.5 text-center">
            <CloudRain className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <div className="text-lg font-bold text-cyan-600">{annualRain ?? '\u2013'}</div>
            <div className="text-xs text-cyan-500">mm rain/year</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <Wind className="w-4 h-4 text-muted-foreground/70 mx-auto mb-1" />
            <div className="text-lg font-bold text-muted-foreground">{avg(allMonths.map(d => d.wind_speed_mean)) ?? '\u2013'}</div>
            <div className="text-xs text-muted-foreground">km/h avg wind</div>
          </div>
        </div>

        {/* Monthly temperature range chart */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Monthly Temperature Range</h3>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 12 }, (_, i) => {
              const m = byMonth.get(i + 1);
              if (!m) return null;
              const tMax = m.temp_max ?? 0;
              const tMin = m.temp_min ?? 0;
              const range = tempMax - tempMinAll || 1;
              const bottom = ((tMin - tempMinAll) / range) * 100;
              const height = ((tMax - tMin) / range) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className="absolute w-full rounded-sm bg-gradient-to-t from-blue-300 to-orange-300 opacity-70"
                      style={{ bottom: `${bottom}%`, height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground/70 mt-1">{MONTH_NAMES[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
            <span>{Math.round(tempMinAll)}&deg;C</span>
            <span>{Math.round(tempMax)}&deg;C</span>
          </div>
        </div>

        {/* Seasonal summary — card stack on mobile, table on desktop */}
        <SeasonalSummary seasons={seasons} />
      </div>

      <div className="px-5 py-2 bg-muted/50 border-t border-border">
        <p className="text-xs text-muted-foreground/70">Source: Open-Meteo Climate API (EC-Earth3P-HR model, 10-year average 2010-2019).</p>
      </div>
    </section>
  );
}

type SeasonData = { name: string; tempMean: number | null; tempMax: number | null; tempMin: number | null; rainfall: number | null; rainDays: number | null; wind: number | null };

function getCurrentSeasonIndex(): number {
  const month = new Date().getMonth() + 1; // 1-12
  if ([12, 1, 2].includes(month)) return 0; // Summer
  if ([3, 4, 5].includes(month)) return 1;  // Autumn
  if ([6, 7, 8].includes(month)) return 2;  // Winter
  return 3; // Spring
}

function SeasonalSummary({ seasons }: { seasons: SeasonData[] }) {
  const [showAll, setShowAll] = useState(false);
  const currentIdx = getCurrentSeasonIndex();
  const nextIdx = (currentIdx + 1) % 4;

  const visibleSeasons = showAll ? seasons : [seasons[currentIdx], seasons[nextIdx]];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">Seasonal Summary</h3>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-piq-primary font-medium hover:underline"
        >
          {showAll ? 'Show less' : 'Show all seasons'}
        </button>
      </div>
      {/* Mobile: compact cards */}
      <div className="sm:hidden space-y-2">
        {visibleSeasons.map(s => (
          <div key={s.name} className="rounded-lg bg-muted/30 p-2.5 text-xs">
            <div className="font-medium text-foreground mb-1">{s.name}{s.name === seasons[currentIdx].name ? ' (now)' : ''}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <span>High: <span className="font-medium text-foreground">{s.tempMax ?? '\u2013'}&deg;</span></span>
              <span>Low: <span className="font-medium text-foreground">{s.tempMin ?? '\u2013'}&deg;</span></span>
              <span>Rain: <span className="font-medium text-foreground">{s.rainfall ?? '\u2013'}mm</span></span>
              <span>Wind: <span className="font-medium text-foreground">{s.wind ?? '\u2013'}km/h</span></span>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-1.5 font-medium">Season</th>
              <th className="text-right py-1.5 font-medium">High</th>
              <th className="text-right py-1.5 font-medium">Low</th>
              <th className="text-right py-1.5 font-medium">Rain</th>
              <th className="text-right py-1.5 font-medium">Rain days</th>
              <th className="text-right py-1.5 font-medium">Wind</th>
            </tr>
          </thead>
          <tbody>
            {visibleSeasons.map(s => (
              <tr key={s.name} className="border-b border-border/50">
                <td className="py-1.5 font-medium text-foreground">{s.name}{s.name === seasons[currentIdx].name ? ' (now)' : ''}</td>
                <td className="text-right text-muted-foreground">{s.tempMax ?? '\u2013'}&deg;</td>
                <td className="text-right text-muted-foreground">{s.tempMin ?? '\u2013'}&deg;</td>
                <td className="text-right text-muted-foreground">{s.rainfall ?? '\u2013'}mm</td>
                <td className="text-right text-muted-foreground">{s.rainDays ?? '\u2013'}/mo</td>
                <td className="text-right text-muted-foreground">{s.wind ?? '\u2013'}km/h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

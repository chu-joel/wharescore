'use client';

import { GraduationCap } from 'lucide-react';

interface School {
  name: string;
  type: string;
  eqi: number | null;
  distance_m: number;
  in_zone: boolean;
  roll?: number;
}

interface Props {
  rawReport: Record<string, unknown>;
}

export function HostedSchools({ rawReport }: Props) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const schools = (live.schools_1500m ?? []) as School[];
  const inZone = (live.in_zone_schools ?? []) as School[];

  if (schools.length === 0 && inZone.length === 0) return null;

  // Separate in-zone from other
  const inZoneNames = new Set(inZone.map(s => s.name));
  const inZoneSchools = schools.filter(s => s.in_zone || inZoneNames.has(s.name));
  const otherSchools = schools.filter(s => !s.in_zone && !inZoneNames.has(s.name)).slice(0, 6);

  const eqiColor = (eqi: number) => {
    if (eqi <= 440) return 'text-piq-success';
    if (eqi <= 480) return 'text-yellow-600';
    return 'text-risk-high';
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Schools</h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {/* In-zone schools */}
        {inZoneSchools.length > 0 && (
          <div>
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-1.5 mb-2">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                In-zone for {inZoneSchools.length} school{inZoneSchools.length !== 1 ? 's' : ''}
              </span>
            </div>
            <SchoolTable schools={inZoneSchools} highlight eqiColor={eqiColor} />
          </div>
        )}

        {/* Other nearby schools */}
        {otherSchools.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Other Nearby Schools</h4>
            <SchoolTable schools={otherSchools} eqiColor={eqiColor} />
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Source: Ministry of Education. EQI = Education Quality Indicator (lower is better).
        </p>
      </div>
    </div>
  );
}

function SchoolTable({ schools, highlight, eqiColor }: { schools: School[]; highlight?: boolean; eqiColor: (n: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">School</th>
            <th className="text-left py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">Type</th>
            <th className="text-center py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">EQI</th>
            <th className="text-right py-1.5 text-xs font-semibold text-piq-primary uppercase tracking-wider">Distance</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.name} className={`border-b border-border/50 last:border-0 ${highlight ? 'bg-green-50/50 dark:bg-green-950/5' : ''}`}>
              <td className="py-2 pr-2 font-medium text-xs">{s.name}</td>
              <td className="py-2 pr-2 text-xs text-muted-foreground">{s.type || '—'}</td>
              <td className="py-2 pr-2 text-center">
                {s.eqi ? (
                  <span className={`text-xs font-semibold ${eqiColor(s.eqi)}`}>{s.eqi}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 text-right text-xs text-muted-foreground">{Math.round(s.distance_m)}m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

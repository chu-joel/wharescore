'use client';

import { GraduationCap } from 'lucide-react';

interface School {
  name: string;
  type: string;
  eqi: number | null;
  decile: number | null;
  distance_m: number;
  in_zone: boolean;
  roll?: number;
  authority?: string;
}

interface Props {
  rawReport: Record<string, unknown>;
}

export function HostedSchools({ rawReport }: Props) {
  const live = (rawReport.liveability ?? {}) as unknown as Record<string, unknown>;
  const schools = (live.schools_1500m ?? []) as School[];
  const inZone = (live.in_zone_schools ?? []) as School[];

  if (schools.length === 0 && inZone.length === 0) return null;

  // In-zone schools are already shown above in HostedSchoolZones (with the green enrolment-zone
  // banner). This component now only lists OTHER nearby schools so the two sections stop
  // duplicating the same rows on the Full report.
  const inZoneNames = new Set(inZone.map(s => s.name));
  const otherSchools = schools
    .filter(s => !s.in_zone && !inZoneNames.has(s.name))
    .slice(0, 8);

  if (otherSchools.length === 0) return null;

  const eqiColor = (eqi: number) => {
    if (eqi <= 440) return 'text-piq-success';
    if (eqi <= 480) return 'text-yellow-600';
    return 'text-risk-high';
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">Other Nearby Schools</h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          Schools within 1.5&nbsp;km that you&apos;re <strong>not</strong> in the enrolment zone for. You can still apply
          out-of-zone if they have spare places.
        </p>
        <SchoolTable schools={otherSchools} eqiColor={eqiColor} />
        <p className="text-xs text-muted-foreground">
          Source: Ministry of Education. EQI = Education Quality Indicator (lower is better). Deciles were retired in 2023.
        </p>
      </div>
    </div>
  );
}

function SchoolTable({ schools, highlight, eqiColor }: { schools: School[]; highlight?: boolean; eqiColor: (n: number) => string }) {
  return (
    <>
      {/* Mobile: compact cards */}
      <div className="sm:hidden space-y-2">
        {schools.map((s) => (
          <div key={s.name} className={`rounded-lg p-2.5 ${highlight ? 'bg-green-50/50 dark:bg-green-950/5 border border-green-200/50 dark:border-green-800/30' : 'bg-muted/30 border border-border/50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.type || 'School'}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{Math.round(s.distance_m)} m</span>
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">School</th>
              <th className="text-left py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">Type</th>
              <th className="text-center py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">EQI</th>
              <th className="text-center py-1.5 pr-2 text-xs font-semibold text-piq-primary uppercase tracking-wider">Roll</th>
              <th className="text-right py-1.5 text-xs font-semibold text-piq-primary uppercase tracking-wider">Distance</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.name} className={`border-b border-border/50 last:border-0 ${highlight ? 'bg-green-50/50 dark:bg-green-950/5' : ''}`}>
                <td className="py-2 pr-2 font-medium text-xs">{s.name}</td>
                <td className="py-2 pr-2 text-xs text-muted-foreground">{s.type || '\u2013'}</td>
                <td className="py-2 pr-2 text-center">
                  {s.eqi ? (
                    <span className={`text-xs font-semibold ${eqiColor(s.eqi)}`}>{s.eqi}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{'\u2013'}</span>
                  )}
                </td>
                <td className="py-2 pr-2 text-center text-xs text-muted-foreground">{s.roll?.toLocaleString() ?? '\u2013'}</td>
                <td className="py-2 text-right text-xs text-muted-foreground">{Math.round(s.distance_m)} m</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

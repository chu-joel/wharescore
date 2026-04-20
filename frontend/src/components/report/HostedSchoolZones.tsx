'use client';

import { School } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface SchoolZone {
  school_name: string;
  school_id: number;
  institution_type: string;
  distance_m?: number | null;
  eqi?: number | null;
  roll?: number | null;
  suburb?: string | null;
  city?: string | null;
}

interface Props {
  snapshot: ReportSnapshot;
}

// Private schools (Catholic, independent, integrated) often have country-wide enrolment
// zones. a Wellington property is technically "in zone" for a Hutt or Upper Hutt private
// school 25 km away, which is nonsense in context. Drop anything further than this threshold
// so the "In School Enrolment Zones" list stays relevant to the renter.
const IN_ZONE_DISTANCE_CAP_M = 5000;

export function HostedSchoolZones({ snapshot }: Props) {
  const zonesRaw = (snapshot.school_zones ?? []) as SchoolZone[];

  // Keep only zones within the relevance cap; if we have no distance we trust the join.
  const zones = zonesRaw.filter((z) => z.distance_m == null || z.distance_m <= IN_ZONE_DISTANCE_CAP_M);

  if (zones.length === 0) return null;

  const typeLabel = (t: string) => {
    if (!t) return '';
    if (t.toLowerCase().includes('contributing')) return 'Primary (Yr 1–6)';
    if (t.toLowerCase().includes('full primary')) return 'Full Primary (Yr 1–8)';
    if (t.toLowerCase().includes('intermediate')) return 'Intermediate (Yr 7–8)';
    if (t.toLowerCase().includes('secondary')) return 'Secondary (Yr 9–13)';
    if (t.toLowerCase().includes('composite')) return 'Composite (Yr 1–13)';
    return t;
  };

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <School className="h-4 w-4 text-green-700 dark:text-green-400" />
        <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">
          In School Enrolment Zone{zones.length !== 1 ? 's' : ''}
        </h4>
      </div>
      <div className="divide-y divide-green-200/50 dark:divide-green-800/50">
        {zones.map((z) => (
          <div key={z.school_id} className="py-2">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="text-sm font-medium">{z.school_name}</span>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>{typeLabel(z.institution_type)}</span>
                  {z.roll && <span>· Roll: {z.roll.toLocaleString()}</span>}
                  {z.eqi && <span>· EQI: {z.eqi}</span>}
                </div>
              </div>
              {z.distance_m != null && (
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {z.distance_m >= 1000
                    ? `${(z.distance_m / 1000).toFixed(1)} km`
                    : `${z.distance_m} m`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Source: Ministry of Education enrolment zone boundaries. Zones may change. verify with school.
      </p>
    </div>
  );
}

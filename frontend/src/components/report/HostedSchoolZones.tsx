'use client';

import { School } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface SchoolZone {
  school_name: string;
  school_id: number;
  institution_type: string;
}

interface Props {
  snapshot: ReportSnapshot;
}

export function HostedSchoolZones({ snapshot }: Props) {
  const zones = (snapshot.school_zones ?? []) as SchoolZone[];

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
          <div key={z.school_id} className="flex justify-between items-center py-2">
            <span className="text-sm font-medium">{z.school_name}</span>
            <span className="text-xs text-muted-foreground">{typeLabel(z.institution_type)}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Source: Ministry of Education enrolment zone boundaries. Zones may change — verify with school.
      </p>
    </div>
  );
}

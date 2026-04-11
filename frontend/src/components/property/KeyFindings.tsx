'use client';

import { Lightbulb } from 'lucide-react';
import { FindingCard, generateFindings } from './FindingCard';
import { BlurredFindingCards } from './BlurredFindingCards';
import type { PropertyReport } from '@/lib/types';
import type { Persona } from '@/stores/personaStore';

interface KeyFindingsProps {
  report: PropertyReport;
  /** Max findings to show for free. Remaining are shown as blurred cards. */
  maxFree?: number;
  /** Current persona — affects finding order */
  persona?: Persona;
  /** Address ID for upgrade CTA */
  addressId?: number;
}

export function KeyFindings({ report, maxFree = 5, persona, addressId }: KeyFindingsProps) {
  const findings = generateFindings(report, persona);

  if (findings.length === 0) return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-piq-primary" />
        <h3 className="text-sm font-bold">No findings for this property</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        We didn&apos;t find any notable concerns or highlights for this address.
      </p>
    </div>
  );

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const infoCount = findings.filter(f => f.severity === 'info').length;
  const positiveCount = findings.filter(f => f.severity === 'positive').length;

  const freeFindings = findings.slice(0, maxFree);
  const hiddenFindings = findings.slice(maxFree);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-piq-primary" />
        <h3 className="text-sm font-bold">
          {findings.length} {findings.length === 1 ? 'thing' : 'things'} to know about this property
        </h3>
      </div>

      {/* Summary line — must sum to findings.length */}
      <p className="text-xs text-muted-foreground">
        {criticalCount > 0 && (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {criticalCount} critical{' '}
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {warningCount} to watch{' '}
          </span>
        )}
        {infoCount > 0 && (
          <span className="text-piq-primary font-medium">
            {infoCount} info{' '}
          </span>
        )}
        {positiveCount > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            {positiveCount} positive{' '}
          </span>
        )}
        {criticalCount === 0 && warningCount === 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            No significant concerns found.{' '}
          </span>
        )}
      </p>

      {/* Free finding cards */}
      <div className="space-y-2">
        {freeFindings.map((finding, i) => (
          <FindingCard key={i} finding={finding} index={i} />
        ))}
      </div>

      {/* Blurred ghost cards — show severity colors through blur */}
      {hiddenFindings.length > 0 && (
        <BlurredFindingCards
          findings={hiddenFindings}
          addressId={addressId ?? report.address.address_id}
          totalCount={findings.length}
        />
      )}
    </div>
  );
}

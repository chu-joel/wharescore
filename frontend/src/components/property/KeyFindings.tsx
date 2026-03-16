'use client';

import { Lightbulb } from 'lucide-react';
import { FindingCard, generateFindings } from './FindingCard';
import { ReportUpsell } from './ReportUpsell';
import type { PropertyReport } from '@/lib/types';

interface KeyFindingsProps {
  report: PropertyReport;
  /** Max findings to show for free. Remaining are gated behind upsell. */
  maxFree?: number;
}

export function KeyFindings({ report, maxFree = 5 }: KeyFindingsProps) {
  const findings = generateFindings(report);

  if (findings.length === 0) return null;

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const positiveCount = findings.filter(f => f.severity === 'positive').length;

  const freeFindings = findings.slice(0, maxFree);
  const hiddenFindings = findings.slice(maxFree);
  const hiddenCritical = hiddenFindings.filter(f => f.severity === 'critical').length;
  const hiddenWarning = hiddenFindings.filter(f => f.severity === 'warning').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-piq-primary" />
        <h3 className="text-sm font-bold">
          {findings.length} {findings.length === 1 ? 'thing' : 'things'} to know about this property
        </h3>
      </div>

      {/* Summary line */}
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

      {/* Gated findings teaser */}
      {hiddenFindings.length > 0 && (
        <ReportUpsell
          addressId={report.address.address_id}
          feature="findings"
          hiddenCount={hiddenFindings.length}
          criticalCount={hiddenCritical}
          warningCount={hiddenWarning}
        />
      )}
    </div>
  );
}

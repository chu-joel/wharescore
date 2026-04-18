'use client';

import { Lightbulb } from 'lucide-react';
import { FindingCard, generateFindings, type Finding } from './FindingCard';
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

// Coerce a backend-ranked finding into the frontend Finding shape expected by
// FindingCard. Backend returns {severity, title, detail}; FindingCard wants
// {headline, interpretation, severity, category, source}. Category/source are
// cosmetic here since the card renders severity + text.
function asFrontendFinding(
  ranked: { severity: string; title: string; detail: string },
): Finding {
  const sev = ranked.severity as Finding['severity'];
  return {
    severity: sev === 'critical' || sev === 'warning' || sev === 'info' || sev === 'positive'
      ? sev
      : 'info',
    headline: ranked.title,
    interpretation: ranked.detail || '',
    category: 'ranked',
    source: 'backend',
  };
}

export function KeyFindings({ report, maxFree = 5, persona, addressId }: KeyFindingsProps) {
  const allFindings = generateFindings(report, persona);

  if (allFindings.length === 0) return (
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

  // Prefer the backend's persona-ranked top-N for the free-visible slice so
  // the on-screen report and the browser-extension badge show the same two
  // findings side-by-side. Falls back to the frontend ranker when absent.
  const personaKey: 'renter' | 'buyer' = persona === 'renter' ? 'renter' : 'buyer';
  const backendRanked = report.ranked_findings?.[personaKey];

  let freeFindings: Finding[];
  if (backendRanked && backendRanked.length > 0) {
    const converted = backendRanked.map(asFrontendFinding).slice(0, maxFree);
    // If backend returned fewer than maxFree, top up from the frontend ranker
    // (avoid duplicates by headline).
    if (converted.length < maxFree) {
      const chosen = new Set(converted.map(f => f.headline));
      const filler = allFindings.filter(f => !chosen.has(f.headline));
      converted.push(...filler.slice(0, maxFree - converted.length));
    }
    freeFindings = converted;
  } else {
    freeFindings = allFindings.slice(0, maxFree);
  }

  const freeHeadlines = new Set(freeFindings.map(f => f.headline));
  const hiddenFindings = allFindings.filter(f => !freeHeadlines.has(f.headline));

  const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
  const warningCount = allFindings.filter(f => f.severity === 'warning').length;
  const infoCount = allFindings.filter(f => f.severity === 'info').length;
  const positiveCount = allFindings.filter(f => f.severity === 'positive').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-piq-primary" />
        <h3 className="text-sm font-bold">
          {allFindings.length} {allFindings.length === 1 ? 'thing' : 'things'} to know about this {persona === 'renter' ? 'rental' : 'property'}
        </h3>
      </div>

      {/* Summary line — must sum to allFindings.length. Vocabulary matches FindingCard
          badges (Critical / Watch / Note / Good). */}
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
            {infoCount} note{infoCount === 1 ? '' : 's'}{' '}
          </span>
        )}
        {positiveCount > 0 && (
          <span className="text-green-600 dark:text-green-400 font-medium">
            {positiveCount} good{' '}
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
          totalCount={allFindings.length}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { CheckCircle, Circle, AlertTriangle, ClipboardCheck, ChevronDown } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
}

interface DiligenceItem {
  name: string;
  cost: string;
  coveredByUs: boolean;
  /** What our report already shows for this item */
  ourCoverage?: string;
  /** Why this is especially important for THIS property */
  propertyNote?: string;
  priority: 'essential' | 'recommended' | 'conditional';
  // Personalised items are property-specific conditional checks that only
  // fire when the data triggers them (flood assessment, body corp records
  // for multi-unit, geotech for high liq/slope). Universal items are the
  // checks every buyer needs regardless (building inspection, LIM, legal,
  // insurance, title). Personalised leads; universal sits behind an expander.
  scope?: 'personalised' | 'universal';
}

/**
 * "What we've covered vs what you still need" — buyer due diligence tracker.
 * Shows 12 standard NZ due diligence items, marks which ones our report
 * already addresses, and highlights what the buyer still needs to do.
 *
 * This is the buyer's hero section (equivalent of LandlordChecklist for renters).
 */
export function BuyerDueDiligence({ report }: Props) {
  const hazards = report.hazards;
  const planning = report.planning;
  const isMultiUnit = report.property_detection?.is_multi_unit;

  const items: DiligenceItem[] = [];

  // === ITEMS WE COVER ===
  items.push({
    name: 'Natural hazard check',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: `${report.coverage?.available ?? '30+'} risk layers checked — flood, earthquake, tsunami, liquefaction, slope, wind, wildfire, coastal erosion`,
    priority: 'essential',
  });

  items.push({
    name: 'Contaminated land check',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: `${(planning?.contamination_count ?? 0) > 0 ? `${planning!.contamination_count} HAIL sites within 500m` : 'No contaminated sites found nearby'}`,
    priority: 'essential',
  });

  items.push({
    name: 'Zoning & planning review',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: `${planning?.zone_name ?? 'Zone data available'}${planning?.height_limit ? `, ${planning.height_limit}m height limit` : ''}${planning?.in_heritage_overlay ? ', heritage overlay' : ''}`,
    priority: 'essential',
  });

  items.push({
    name: 'Council rates',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: 'Live council rates data for this property',
    priority: 'essential',
  });

  items.push({
    name: 'Noise & environment assessment',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: `Road noise${report.environment?.noise_db ? ` (${Math.round(report.environment.noise_db)} dB)` : ''}, air quality, water quality checked`,
    priority: 'recommended',
  });

  items.push({
    name: 'School zones & transit access',
    cost: 'Included',
    coveredByUs: true,
    ourCoverage: 'School zone boundaries, transit stops, commute times assessed',
    priority: 'recommended',
  });

  // === ITEMS BUYER STILL NEEDS ===
  const hasFlood = isInFloodZone(hazards);
  const liqStr = String(hazards?.liquefaction_zone || '').toLowerCase();
  const isHighLiq = liqStr.includes('high') || liqStr.includes('very');
  const slopeStr = String(hazards?.slope_failure || '').toLowerCase();
  const isHighSlope = slopeStr.includes('high') || slopeStr.includes('very');
  const isEPB = planning?.epb_listed;

  // Property-specific conditional items lead. Building-inspection gets
  // promoted to personalised when the subject property is earthquake-prone
  // (buyer needs seismic assessment, not a standard inspection).
  if (isEPB) {
    items.push({
      name: 'Building inspection + seismic assessment',
      cost: '$2,000–$5,000',
      coveredByUs: false,
      propertyNote: 'CRITICAL — earthquake-prone building. A seismic assessment is required in addition to a standard inspection to scope strengthening works.',
      priority: 'essential',
      scope: 'personalised',
    });
  }

  if (isHighLiq || isHighSlope) {
    items.push({
      name: 'Geotechnical report',
      cost: '$1,500–$3,000',
      coveredByUs: false,
      propertyNote: `${isHighLiq ? 'High liquefaction' : ''}${isHighLiq && isHighSlope ? ' + ' : ''}${isHighSlope ? 'slope failure risk' : ''} flagged. Foundation assessment recommended.`,
      priority: 'essential',
      scope: 'personalised',
    });
  }

  if (isMultiUnit) {
    items.push({
      name: 'Body corporate records',
      cost: 'Free (request)',
      coveredByUs: false,
      propertyNote: 'Request: Section 146 + 147 disclosure, 3 years of minutes, LTMP, maintenance fund balance. Watch for upcoming special levies.',
      priority: 'essential',
      scope: 'personalised',
    });
  }

  if (hasFlood) {
    items.push({
      name: 'Flood risk assessment',
      cost: '$500–$2,000',
      coveredByUs: false,
      propertyNote: 'Property is in a mapped flood zone. A detailed assessment can determine floor level relative to flood height and mitigation options.',
      priority: 'recommended',
      scope: 'personalised',
    });
  }

  if (hasFlood || isHighLiq || isEPB) {
    items.push({
      name: 'Insurance quotes',
      cost: 'Free',
      coveredByUs: false,
      propertyNote: 'GET QUOTES BEFORE GOING UNCONDITIONAL. Hazards flagged on this property may increase premiums or limit cover.',
      priority: 'essential',
      scope: 'personalised',
    });
  }

  // Universal buyer checks — every property, regardless of hazards.
  if (!isEPB) {
    items.push({
      name: 'Building inspection',
      cost: '$400–$1,500',
      coveredByUs: false,
      priority: 'essential',
      scope: 'universal',
    });
  }

  items.push({
    name: 'LIM report (council records)',
    cost: '$300–$500',
    coveredByUs: false,
    propertyNote: 'Reveals building consent history, code compliance status, and any notices to fix. We cover hazards and zoning — the LIM adds consent and compliance records.',
    priority: 'essential',
    scope: 'universal',
  });

  if (!(hasFlood || isHighLiq || isEPB)) {
    items.push({
      name: 'Insurance quotes',
      cost: 'Free',
      coveredByUs: false,
      propertyNote: 'Get at least 3 quotes. EQC covers first $300K earthquake damage — check the gap to rebuild cost.',
      priority: 'essential',
      scope: 'universal',
    });
  }

  items.push({
    name: 'Legal review (conveyancing)',
    cost: '$1,500–$3,500',
    coveredByUs: false,
    propertyNote: isMultiUnit
      ? 'Essential for multi-unit. Lawyer should review body corporate records, LTMP, and request Section 147 additional disclosure.'
      : 'Lawyer reviews title, sale & purchase agreement, LIM, and any encumbrances/easements.',
    priority: 'essential',
    scope: 'universal',
  });

  items.push({
    name: 'Title search (LINZ)',
    cost: '~$5',
    coveredByUs: false,
    propertyNote: isMultiUnit
      ? 'Check title type: cross-lease, unit title, or freehold. If cross-lease, verify the flats plan is current (50% of NZ cross-leases are technically defective).'
      : 'Confirms ownership, encumbrances, easements, covenants, and title type.',
    priority: 'essential',
    scope: 'universal',
  });

  const coveredCount = items.filter(i => i.coveredByUs).length;
  const remaining = items.filter(i => !i.coveredByUs);
  const personalised = remaining.filter(i => i.scope === 'personalised');
  const universal = remaining.filter(i => i.scope !== 'personalised');
  const essentialRemaining = remaining.filter(i => i.priority === 'essential');

  return (
    <DueDiligenceCard
      coveredItems={items.filter(i => i.coveredByUs)}
      coveredCount={coveredCount}
      totalCount={items.length}
      essentialRemaining={essentialRemaining.length}
      personalised={personalised}
      universal={universal}
    />
  );
}

interface CardProps {
  coveredItems: DiligenceItem[];
  coveredCount: number;
  totalCount: number;
  essentialRemaining: number;
  personalised: DiligenceItem[];
  universal: DiligenceItem[];
}

function DueDiligenceRow({ item }: { item: DiligenceItem }) {
  return (
    <div className="flex items-start gap-2">
      {item.priority === 'essential' ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      )}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.cost}</span>
        </div>
        {item.propertyNote && (
          <p className="text-xs text-muted-foreground">{item.propertyNote}</p>
        )}
      </div>
    </div>
  );
}

function DueDiligenceCard({
  coveredItems,
  coveredCount,
  totalCount,
  essentialRemaining,
  personalised,
  universal,
}: CardProps) {
  const hasPersonalised = personalised.length > 0;
  // If nothing personalised fired, show the universal list inline — same
  // pattern as LandlordChecklist. Otherwise collapse universals behind an
  // expander so the property-specific items stay in focus.
  const [expanded, setExpanded] = useState(!hasPersonalised);

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardCheck className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-bold">Your due diligence</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        We've covered {coveredCount} of {totalCount} checks. {essentialRemaining} essential items remaining.
      </p>

      <div className="space-y-1.5 mb-3">
        <p className="text-xs font-semibold text-piq-primary uppercase tracking-wider">Covered by this report</p>
        {coveredItems.map((item) => (
          <div key={item.name} className="flex items-start gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-piq-success shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-medium">{item.name}</span>
              {item.ourCoverage && (
                <p className="text-xs text-muted-foreground">{item.ourCoverage}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        {hasPersonalised && (
          <>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Priority for this property
            </p>
            {personalised.map((item) => (
              <DueDiligenceRow key={item.name} item={item} />
            ))}
          </>
        )}

        {hasPersonalised && !expanded && universal.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-piq-primary hover:underline pt-1"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Show {universal.length} more vital check{universal.length === 1 ? '' : 's'}
          </button>
        )}

        {expanded && universal.length > 0 && (
          <>
            {hasPersonalised && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                Vital for every purchase
              </p>
            )}
            {!hasPersonalised && (
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                You still need
              </p>
            )}
            {universal.map((item) => (
              <DueDiligenceRow key={item.name} item={item} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

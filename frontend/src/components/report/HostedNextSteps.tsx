'use client';

import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  persona: string;
  report: PropertyReport;
}

interface ActionCard {
  level: 'essential' | 'recommended' | 'consider';
  title: string;
  description: string;
}

export function HostedNextSteps({ persona, report }: Props) {
  const h = report.hazards;
  const hasFlood = isInFloodZone(h);
  const hasLiquefaction = !!(h.liquefaction_zone && String(h.liquefaction_zone).toLowerCase().match(/moderate|high|significant/));
  const hasSlope = !!h.slope_failure;
  const needsGeotech = hasLiquefaction || hasSlope;

  const hasEpb = !!h.epb_rating;
  const hasContamination = !!(h.contamination_count && h.contamination_count > 0);
  const hasTsunami = !!h.tsunami_zone;
  const hasHighCrime = (report.liveability?.crime_rate ?? 0) > 70;

  const renterCards: ActionCard[] = [
    { level: 'essential', title: 'Healthy Homes Check', description: 'Request the signed compliance statement — legally required since July 2025' },
    { level: 'essential', title: 'Contents Insurance', description: 'Get quotes — check hazard exclusions for this area' },
    { level: 'recommended', title: 'Visit at Different Times', description: 'Check noise, parking, safety at day and night' },
    { level: 'recommended', title: 'Test Your Commute', description: 'Peak hour transit/drive to work from this address' },
    ...(hasEpb ? [{
      level: 'recommended' as const,
      title: 'Check Building Age & EPBs',
      description: 'Ask landlord about seismic strengthening status',
    }] : []),
    ...(hasTsunami ? [{
      level: 'consider' as const,
      title: 'Know Evacuation Route',
      description: 'Check civil defence tsunami evacuation routes',
    }] : []),
    ...(hasHighCrime ? [{
      level: 'consider' as const,
      title: 'Check Security',
      description: 'Deadbolts, sensor lights, window locks, alarm',
    }] : []),
  ];

  const buyerCards: ActionCard[] = [
    { level: 'essential', title: 'Get a LIM Report (~$300-$500)', description: 'Council info memorandum — your #1 due diligence document' },
    { level: 'essential', title: "Builder's Report (~$400-$1,500)", description: 'Pre-purchase building inspection by a qualified inspector' },
    { level: 'essential', title: 'Insurance Quotes', description: 'Get 2+ quotes BEFORE going unconditional' },
    { level: 'recommended', title: 'Legal Review', description: 'Title, covenants, easements, cross-lease checks' },
    ...(needsGeotech ? [{
      level: 'recommended' as const,
      title: 'Geotechnical Report (~$1,500-$3,000)',
      description: 'Soil stability assessment — critical for foundations',
    }] : []),
    ...(hasFlood ? [{
      level: 'recommended' as const,
      title: 'Flood Risk Assessment',
      description: 'Check floor level vs estimated flood level',
    }] : []),
    ...(hasContamination ? [{
      level: 'recommended' as const,
      title: 'Environmental Assessment (~$1,500-$3,000)',
      description: 'Phase 1 ESA for contaminated land nearby',
    }] : []),
    ...(hasEpb ? [{
      level: 'consider' as const,
      title: 'Seismic Strengthening Status',
      description: 'Check MBIE EPB register for nearby building remediation',
    }] : []),
  ];

  const cards = persona === 'renter' ? renterCards : buyerCards;

  const levelColors = {
    essential: 'border-l-piq-accent-warm bg-orange-50/50 dark:bg-orange-950/10',
    recommended: 'border-l-piq-primary bg-teal-50/50 dark:bg-teal-950/10',
    consider: 'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10',
  };

  const levelLabels = {
    essential: 'Before Signing',
    recommended: 'Do This',
    consider: 'Consider',
  };

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-lg font-bold">Your Next Steps</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Based on this report, here are recommended actions for this property.
        </p>
      </div>
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`rounded-lg border-l-4 border border-border p-3 ${levelColors[card.level]}`}
          >
            <span className={`text-xs font-bold uppercase tracking-wider ${
              card.level === 'essential' ? 'text-piq-accent-warm' : card.level === 'recommended' ? 'text-piq-primary' : 'text-blue-500'
            }`}>
              {levelLabels[card.level]}
            </span>
            <p className="font-semibold text-sm mt-0.5">{card.title}</p>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

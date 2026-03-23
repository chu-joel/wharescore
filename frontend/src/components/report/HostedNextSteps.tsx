'use client';

import type { PropertyReport } from '@/lib/types';

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
  const hazards = (report as Record<string, unknown>).hazards as Record<string, unknown> | undefined;
  const hasFlood = !!(hazards?.flood_zone || hazards?.flood_overlay);
  const liqStr = String(hazards?.liquefaction_class || hazards?.gwrc_liquefaction || hazards?.liquefaction_zone || '').toLowerCase();
  const hasLiquefaction = liqStr.includes('moderate') || liqStr.includes('high') || liqStr.includes('significant');
  const hasSlope = !!(hazards?.slope_failure_risk || hazards?.landslide_susceptibility_rating || hazards?.gwrc_slope_severity);
  const needsGeotech = hasLiquefaction || hasSlope;

  const hasEpb = !!(hazards?.epb_count && Number(hazards.epb_count) > 10);
  const hasContamination = !!(hazards?.contamination_count && Number(hazards.contamination_count) > 0);
  const hasTsunami = !!(hazards?.tsunami_zone || hazards?.wcc_tsunami_ranking);
  const hasHighCrime = !!(report.liveability as Record<string, unknown>)?.crime_rate &&
    Number((report.liveability as Record<string, unknown>).crime_rate) > 70;

  const renterCards: ActionCard[] = [
    { level: 'essential', title: 'Healthy Homes Check', description: 'Request compliance statement — legal requirement since 2021' },
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
    { level: 'essential', title: 'Get a LIM Report', description: 'Council info memorandum — your #1 document ($300-$500)' },
    { level: 'essential', title: "Builder's Report", description: 'Pre-purchase building inspection ($400-$1,500)' },
    { level: 'essential', title: 'Insurance Quotes', description: 'Get 2+ quotes BEFORE going unconditional' },
    { level: 'recommended', title: 'Legal Review', description: 'Title, covenants, easements, cross-lease checks' },
    ...(needsGeotech ? [{
      level: 'recommended' as const,
      title: 'Geotechnical Report',
      description: 'Soil stability assessment — critical for foundations ($1,500-$3,000)',
    }] : []),
    ...(hasFlood ? [{
      level: 'recommended' as const,
      title: 'Flood Risk Assessment',
      description: 'Check floor level vs estimated flood level',
    }] : []),
    ...(hasContamination ? [{
      level: 'recommended' as const,
      title: 'Environmental Assessment',
      description: 'Phase 1 ESA for contaminated land nearby ($1,500-$3,000)',
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
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
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

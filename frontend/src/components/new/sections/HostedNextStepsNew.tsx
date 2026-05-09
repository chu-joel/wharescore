'use client';

import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface ActionCard {
  level: 'essential' | 'recommended' | 'consider';
  title: string;
  description: string;
}

const LEVEL_LABEL = { essential: 'Before signing', recommended: 'Do this', consider: 'Consider' } as const;
const LEVEL_COLOUR: Record<ActionCard['level'], string> = {
  essential: 'var(--ws-warm)',
  recommended: 'var(--ws-piq)',
  consider: 'var(--ws-r-low)',
};
const LEVEL_BG: Record<ActionCard['level'], string> = {
  essential: 'rgba(212,134,59,.06)',
  recommended: 'rgba(13,115,119,.05)',
  consider: 'rgba(86,180,233,.06)',
};

export function HostedNextStepsNew({ persona, report }: { persona: string; report: PropertyReport }) {
  const h = report.hazards;
  const hasFlood = isInFloodZone(h);
  const hasLiq = !!(h.liquefaction_zone && /moderate|high|significant/i.test(String(h.liquefaction_zone)));
  const hasSlope = !!h.slope_failure;
  const needsGeotech = hasLiq || hasSlope;
  const hasEpb = !!h.epb_rating;
  const hasContam = !!(h.contamination_count && h.contamination_count > 0);
  const hasTsunami = !!h.tsunami_zone;
  const hasHighCrime = (report.liveability?.crime_rate ?? 0) > 70;

  const renter: ActionCard[] = [
    { level: 'essential', title: 'Healthy Homes check', description: 'Request the signed compliance statement. Legally required since July 2025.' },
    { level: 'essential', title: 'Contents insurance', description: 'Get quotes. Check hazard exclusions for this area.' },
    { level: 'recommended', title: 'Visit at different times', description: 'Check noise, parking, safety at day and night.' },
    { level: 'recommended', title: 'Test your commute', description: 'Peak-hour transit / drive to work from this address.' },
    ...(hasEpb ? [{ level: 'recommended', title: 'Check building age & EPBs', description: 'Ask the landlord about seismic strengthening status.' } as ActionCard] : []),
    ...(hasTsunami ? [{ level: 'consider', title: 'Know evacuation route', description: 'Check Civil Defence tsunami evacuation routes.' } as ActionCard] : []),
    ...(hasHighCrime ? [{ level: 'consider', title: 'Check security', description: 'Deadbolts, sensor lights, window locks, alarm.' } as ActionCard] : []),
  ];

  const buyer: ActionCard[] = [
    { level: 'essential', title: 'Get a LIM report (~$300-$500)', description: 'Council info memorandum. Your #1 due-diligence document.' },
    { level: 'essential', title: "Builder's report (~$400-$1,500)", description: 'Pre-purchase building inspection by a qualified inspector.' },
    { level: 'essential', title: 'Insurance quotes', description: 'Get 2+ quotes BEFORE going unconditional.' },
    { level: 'recommended', title: 'Legal review', description: 'Title, covenants, easements, cross-lease checks.' },
    ...(needsGeotech ? [{ level: 'recommended', title: 'Geotechnical report (~$1,500-$3,000)', description: 'Soil-stability assessment. Critical for foundations.' } as ActionCard] : []),
    ...(hasFlood ? [{ level: 'recommended', title: 'Flood risk assessment', description: 'Check floor level vs estimated flood level.' } as ActionCard] : []),
    ...(hasContam ? [{ level: 'recommended', title: 'Environmental assessment (~$1,500-$3,000)', description: 'Phase 1 ESA for contaminated land nearby.' } as ActionCard] : []),
    ...(hasEpb ? [{ level: 'consider', title: 'Seismic strengthening status', description: 'Check the MBIE EPB register for nearby building remediation.' } as ActionCard] : []),
  ];

  const cards = persona === 'renter' ? renter : buyer;

  return (
    <Card>
      <CardHead title="Your next steps" meta={`${cards.length} actions`} />
      <div className="ws-card-body">
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ws-ink-soft)' }}>
          Based on this report, here are recommended actions for this property.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {cards.map((card) => (
            <div key={card.title} style={{
              borderLeft: `3px solid ${LEVEL_COLOUR[card.level]}`,
              border: '1px solid var(--ws-rule)',
              borderLeftWidth: 3,
              background: LEVEL_BG[card.level],
              borderRadius: 'var(--ws-radius-sm)',
              padding: '10px 12px',
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: LEVEL_COLOUR[card.level],
              }}>
                {LEVEL_LABEL[card.level]}
              </span>
              <p style={{ margin: '2px 0 2px', fontSize: 13.5, fontWeight: 600, color: 'var(--ws-ink)' }}>
                {card.title}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { CheckSquare, AlertTriangle, ChevronDown } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone, isNearFloodZone, floodProximityM } from '@/lib/hazards';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface CheckItem {
  question: string;
  why: string;
  priority: 'must-ask' | 'good-to-ask';
  scope: 'personalised' | 'universal';
}

function buildItems(report: PropertyReport): CheckItem[] {
  const hazards = report.hazards;
  const environment = report.environment;
  const planning = report.planning;
  const items: CheckItem[] = [];

  const city = report.address.city?.toLowerCase() || '';
  const ta = report.address.ta?.toLowerCase() || '';
  const zone3 = ta.includes('queenstown') || ta.includes('central otago') || ta.includes('mackenzie') || ta.includes('waitaki') || city.includes('queenstown') || city.includes('wanaka') || city.includes('cromwell');
  const ceilingR = zone3 ? 'R3.3' : 'R2.9';

  // Universal must-asks
  items.push({ question: 'Can I see the signed Healthy Homes compliance statement?', why: 'Legally required since July 2025. Must be provided before you sign. Penalty up to $7,200 per breach.', priority: 'must-ask', scope: 'universal' });
  items.push({ question: 'What fixed heating is in the main living area? What capacity?', why: 'Must be a fixed heater (not portable) capable of heating to 18°C. If the room needs >2.4 kW, only a heat pump qualifies. Unflued gas heaters do not count.', priority: 'must-ask', scope: 'universal' });
  items.push({ question: `Is the ceiling insulation at least ${ceilingR}? Underfloor at least R1.3?`, why: `This property is in Climate Zone ${zone3 ? '3' : '1/2'}; minimum ceiling insulation is ${ceilingR}. Ask when it was last checked.`, priority: 'must-ask', scope: 'universal' });
  items.push({ question: 'When was the last rent increase, and how much?', why: 'Rent can only increase once per 12 months with 60 days written notice. You can challenge excessive increases at the Tribunal within 28 days.', priority: 'must-ask', scope: 'universal' });

  // Hazard-triggered (personalised)
  if (isInFloodZone(hazards)) {
    items.push({ question: 'Has this property ever flooded?', why: 'Property is in a mapped flood zone', priority: 'must-ask', scope: 'personalised' });
  } else if (isNearFloodZone(hazards)) {
    items.push({ question: 'Has this property or the street ever flooded?', why: `Within ${floodProximityM(hazards)} m of a mapped flood zone`, priority: 'must-ask', scope: 'personalised' });
  }
  if (planning?.epb_listed) {
    items.push({ question: 'What is the seismic strengthening timeline for this building?', why: 'Listed as earthquake-prone; may face strengthening deadline', priority: 'must-ask', scope: 'personalised' });
  }
  const windZone = String(environment?.wind_zone || '').toUpperCase();
  if (['H', 'VH', 'EH', 'SED', 'HIGH', 'VERY HIGH'].includes(windZone)) {
    items.push({ question: 'Are the windows and doors well-sealed? Any draught issues?', why: 'High wind zone; draughts increase heating costs', priority: 'good-to-ask', scope: 'personalised' });
  }
  const noiseDb = environment?.noise_db;
  if (noiseDb && noiseDb >= 60) {
    items.push({ question: 'Is there double glazing? Which rooms face the road?', why: `Road noise is ${Math.round(noiseDb)} dB; above comfortable levels`, priority: 'good-to-ask', scope: 'personalised' });
  }
  if (hazards?.aircraft_noise_name) {
    items.push({ question: 'How noticeable is aircraft noise? Which times are worst?', why: 'Property is within an airport noise overlay', priority: 'good-to-ask', scope: 'personalised' });
  }

  // Cold/exposure-triggered (personalised)
  const aspect = report.terrain?.aspect_label as string | undefined;
  const elevation = report.terrain?.elevation_m as number | undefined;
  const southFacing = aspect === 'S' || aspect === 'SE' || aspect === 'SW';
  const highElev = elevation != null && elevation > 200;
  if (southFacing) {
    items.push({ question: 'How warm does the main living area get in winter? Is there afternoon sun?', why: `${aspect}-facing; limited winter sun means higher heating costs`, priority: 'must-ask', scope: 'personalised' });
  }
  if (highElev || southFacing) {
    items.push({
      question: 'What are typical winter power bills here?',
      why: `${highElev ? `${Math.round(elevation!)} m elevation` : ''}${highElev && southFacing ? ' + ' : ''}${southFacing ? 'south-facing' : ''}; expect higher heating needs`,
      priority: 'must-ask', scope: 'personalised',
    });
  }
  if (hazards?.epb_construction_type) {
    const con = hazards.epb_construction_type.toLowerCase();
    if (/(unreinforced|masonry|brick)/i.test(con)) {
      items.push({ question: 'Has the building had any structural assessments or earthquake strengthening?', why: `Construction type: ${hazards.epb_construction_type}; older building stock`, priority: 'must-ask', scope: 'personalised' });
    }
  }

  const damp = isInFloodZone(hazards) || isNearFloodZone(hazards) ||
    String(hazards?.liquefaction_zone || '').toLowerCase().includes('high') ||
    hazards?.coastal_erosion_exposure;
  if (damp) {
    items.push({ question: 'Is there any history of dampness, mould, or condensation?', why: 'Environmental factors increase moisture risk at this location', priority: 'must-ask', scope: 'personalised' });
  }

  // Universal good-to-asks
  items.push({ question: 'Are pets allowed? Any restrictions?', why: 'Best to confirm before applying', priority: 'good-to-ask', scope: 'universal' });

  return items;
}

function ItemRow({ item }: { item: CheckItem }) {
  const isMust = item.priority === 'must-ask';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {isMust ? (
        <AlertTriangle size={14} style={{ color: 'var(--ws-r-high)', marginTop: 2, flexShrink: 0 }} />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ws-piq)', marginTop: 7, flexShrink: 0 }} />
      )}
      <div>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ws-ink)', fontWeight: isMust ? 500 : 400 }}>{item.question}</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>{item.why}</p>
      </div>
    </div>
  );
}

/**
 * What to ask the landlord. Personalised triggers from the report's hazards
 * and terrain lead; universal "vital for every rental" sits behind a
 * "show more" expander when there are personalised items, otherwise renders
 * expanded by default.
 */
export function LandlordChecklistNew({ report }: { report: PropertyReport }) {
  const items = buildItems(report);
  const personalised = items.filter((i) => i.scope === 'personalised');
  const universal = items.filter((i) => i.scope === 'universal');
  const hasPersonalised = personalised.length > 0;
  const [expanded, setExpanded] = useState(!hasPersonalised);

  return (
    <Card>
      <CardHead title="What to ask the landlord" meta={`${items.length} questions`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ws-ink-soft)' }}>
          <CheckSquare size={14} style={{ color: 'var(--ws-piq)' }} />
          {hasPersonalised
            ? `${personalised.length} based on this property, ${universal.length} vital for every rental.`
            : `${universal.length} vital questions for every rental.`}
        </div>

        {hasPersonalised && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--ws-r-vhigh)',
            }}>
              Based on this property
            </div>
            {personalised.map((item) => <ItemRow key={item.question} item={item} />)}
          </div>
        )}

        {hasPersonalised && !expanded && universal.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ws-btn ws-btn-ghost"
            style={{ alignSelf: 'flex-start', padding: '0 4px', minHeight: 32, fontSize: 12, color: 'var(--ws-piq-dark)' }}
          >
            <ChevronDown size={13} />
            Show {universal.length} more vital question{universal.length === 1 ? '' : 's'}
          </button>
        )}

        {expanded && universal.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {hasPersonalised && (
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--ws-ink-mute)',
              }}>
                Vital for every rental
              </div>
            )}
            {universal.map((item) => <ItemRow key={item.question} item={item} />)}
          </div>
        )}
      </div>
    </Card>
  );
}

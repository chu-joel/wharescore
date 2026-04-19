'use client';

import { useState } from 'react';
import { CheckSquare, AlertTriangle, ChevronDown } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
}

interface CheckItem {
  question: string;
  why: string;
  priority: 'must-ask' | 'good-to-ask';
  // Personalised items are data-triggered by this property's hazards /
  // environment / terrain. Universal items are generic renter questions
  // we'd show for any rental (Healthy Homes statement, rent-increase
  // history, pets, etc.). Personalised items lead; universal sits behind
  // a "Show N more" expander.
  scope: 'personalised' | 'universal';
}

function buildItems(report: PropertyReport): CheckItem[] {
  const hazards = report.hazards;
  const environment = report.environment;
  const planning = report.planning;
  const items: CheckItem[] = [];

  const city = report.address.city?.toLowerCase() || '';
  const ta = report.address.ta?.toLowerCase() || '';
  const isZone3 = ta.includes('queenstown') || ta.includes('central otago') || ta.includes('mackenzie') || ta.includes('waitaki') || city.includes('queenstown') || city.includes('wanaka') || city.includes('cromwell');
  const ceilingR = isZone3 ? 'R3.3' : 'R2.9';

  // ── Universal must-asks ──
  items.push({
    question: 'Can I see the signed Healthy Homes compliance statement?',
    why: 'Legally required since July 2025. Must be provided before you sign. Penalty up to $7,200 per breach.',
    priority: 'must-ask',
    scope: 'universal',
  });
  items.push({
    question: 'What fixed heating is in the main living area? What capacity?',
    why: `Must be a fixed heater (not portable) capable of heating to 18°C. If the room needs >2.4 kW, only a heat pump qualifies. Unflued gas heaters don't count.`,
    priority: 'must-ask',
    scope: 'universal',
  });
  items.push({
    question: `Is the ceiling insulation at least ${ceilingR}? Underfloor at least R1.3?`,
    why: `This property is in Climate Zone ${isZone3 ? '3' : '1/2'} — minimum ceiling insulation is ${ceilingR}. Ask when it was last checked.`,
    priority: 'must-ask',
    scope: 'universal',
  });
  items.push({
    question: 'When was the last rent increase, and how much?',
    why: 'Rent can only increase once per 12 months with 60 days written notice. You can challenge excessive increases at the Tribunal within 28 days.',
    priority: 'must-ask',
    scope: 'universal',
  });

  // ── Hazard-triggered (personalised) ──
  if (isInFloodZone(hazards)) {
    items.push({ question: 'Has this property ever flooded?', why: 'Property is in a mapped flood zone', priority: 'must-ask', scope: 'personalised' });
  }
  if (planning?.epb_listed) {
    items.push({ question: 'What is the seismic strengthening timeline for this building?', why: 'Listed as earthquake-prone — may face strengthening deadline', priority: 'must-ask', scope: 'personalised' });
  }
  const windZone = String(environment?.wind_zone || '').toUpperCase();
  if (['H', 'VH', 'EH', 'SED', 'HIGH', 'VERY HIGH'].includes(windZone)) {
    items.push({ question: 'Are the windows and doors well-sealed? Any draught issues?', why: 'High wind zone — draughts increase heating costs', priority: 'good-to-ask', scope: 'personalised' });
  }
  const noiseDb = environment?.noise_db;
  if (noiseDb && noiseDb >= 60) {
    items.push({ question: 'Is there double glazing? Which rooms face the road?', why: `Road noise is ${Math.round(noiseDb)} dB — above comfortable levels`, priority: 'good-to-ask', scope: 'personalised' });
  }
  if (hazards?.aircraft_noise_name) {
    items.push({ question: 'How noticeable is aircraft noise? Which times are worst?', why: 'Property is within an airport noise overlay', priority: 'good-to-ask', scope: 'personalised' });
  }

  // ── Cold/exposure-triggered (personalised) ──
  const aspect = report.terrain?.aspect_label;
  const elevation = report.terrain?.elevation_m;
  const isSouthFacing = aspect === 'S' || aspect === 'SE' || aspect === 'SW';
  const isHighElevation = elevation != null && elevation > 200;
  if (isSouthFacing) {
    items.push({ question: 'How warm does the main living area get in winter? Is there afternoon sun?', why: `${aspect}-facing — limited winter sun means higher heating costs`, priority: 'must-ask', scope: 'personalised' });
  }
  if (isHighElevation || isSouthFacing) {
    items.push({ question: 'What are typical winter power bills here?', why: `${isHighElevation ? `${Math.round(elevation!)}m elevation` : ''}${isHighElevation && isSouthFacing ? ' + ' : ''}${isSouthFacing ? 'south-facing' : ''} — expect higher heating needs`, priority: 'must-ask', scope: 'personalised' });
  }

  if (hazards?.epb_construction_type) {
    const conType = hazards.epb_construction_type.toLowerCase();
    if (conType.includes('unreinforced') || conType.includes('masonry') || conType.includes('brick')) {
      items.push({ question: 'Has the building had any structural assessments or earthquake strengthening?', why: `Construction type: ${hazards.epb_construction_type} — older building stock`, priority: 'must-ask', scope: 'personalised' });
    }
  }

  const hasDampRisk = isInFloodZone(hazards) ||
    String(hazards?.liquefaction_zone || '').toLowerCase().includes('high') ||
    hazards?.coastal_erosion_exposure;
  if (hasDampRisk) {
    items.push({ question: 'Is there any history of dampness, mould, or condensation?', why: 'Environmental factors increase moisture risk at this location', priority: 'must-ask', scope: 'personalised' });
  }

  // ── Universal good-to-asks ──
  items.push({ question: 'Are pets allowed? Any restrictions?', why: 'Best to confirm before applying', priority: 'good-to-ask', scope: 'universal' });
  if (!isHighElevation && !isSouthFacing) {
    items.push({ question: 'What are the typical power and water costs here?', why: 'Helps you budget accurately', priority: 'good-to-ask', scope: 'universal' });
  }

  return items;
}

function ItemRow({ item }: { item: CheckItem }) {
  const isMust = item.priority === 'must-ask';
  return (
    <div className="flex items-start gap-2">
      {isMust ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-piq-primary shrink-0 mt-1.5" />
      )}
      <div>
        <p className={`text-sm ${isMust ? 'font-medium' : ''}`}>{item.question}</p>
        <p className="text-xs text-muted-foreground">{item.why}</p>
      </div>
    </div>
  );
}

export function LandlordChecklist({ report }: Props) {
  const items = buildItems(report);
  const personalised = items.filter((i) => i.scope === 'personalised');
  const universal = items.filter((i) => i.scope === 'universal');

  // If no personalised triggers fire, the universal list IS the list — show
  // expanded by default so the renter still has a full checklist.
  const hasPersonalised = personalised.length > 0;
  const [expanded, setExpanded] = useState(!hasPersonalised);

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-bold">What to ask the landlord</span>
      </div>

      {hasPersonalised && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Based on this property
          </p>
          {personalised.map((item) => (
            <ItemRow key={item.question} item={item} />
          ))}
        </div>
      )}

      {hasPersonalised && !expanded && universal.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-piq-primary hover:underline"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Show {universal.length} standard question{universal.length === 1 ? '' : 's'}
        </button>
      )}

      {expanded && universal.length > 0 && (
        <div className="space-y-2">
          {hasPersonalised && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Standard questions
            </p>
          )}
          {universal.map((item) => (
            <ItemRow key={item.question} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

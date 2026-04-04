'use client';

import { CheckSquare, AlertTriangle } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';

interface Props {
  report: PropertyReport;
}

interface CheckItem {
  question: string;
  why: string;
  priority: 'must-ask' | 'good-to-ask';
}

/**
 * Free "What to ask the landlord" checklist for renters.
 * Personalized based on property hazard/environment data.
 * High-value free content that builds trust and drives conversion.
 */
export function LandlordChecklist({ report }: Props) {
  const hazards = report.hazards;
  const environment = report.environment;
  const planning = report.planning;

  const items: CheckItem[] = [];

  // Universal must-asks
  items.push({
    question: 'Can I see the Healthy Homes compliance statement?',
    why: 'Landlords must provide this by law since July 2021',
    priority: 'must-ask',
  });

  items.push({
    question: 'When was the last rent increase, and how much?',
    why: 'Rent can only increase once per 12 months',
    priority: 'must-ask',
  });

  items.push({
    question: 'What type of heating is in the main living area?',
    why: 'Must have a fixed heater capable of warming to 18°C',
    priority: 'must-ask',
  });

  // Hazard-triggered questions
  if (hazards?.flood_zone || hazards?.flood_extent_label) {
    items.push({
      question: 'Has this property ever flooded?',
      why: 'Property is in a mapped flood zone',
      priority: 'must-ask',
    });
  }

  if (planning?.epb_listed) {
    items.push({
      question: 'What is the seismic strengthening timeline for this building?',
      why: 'Listed as earthquake-prone — may face strengthening deadline',
      priority: 'must-ask',
    });
  }

  const windZone = String(environment?.wind_zone || '').toUpperCase();
  if (['H', 'VH', 'EH', 'SED', 'HIGH', 'VERY HIGH'].includes(windZone)) {
    items.push({
      question: 'Are the windows and doors well-sealed? Any draught issues?',
      why: 'High wind zone — draughts increase heating costs',
      priority: 'good-to-ask',
    });
  }

  const noiseDb = environment?.noise_db;
  if (noiseDb && noiseDb >= 60) {
    items.push({
      question: 'Is there double glazing? Which rooms face the road?',
      why: `Road noise is ${Math.round(noiseDb)} dB — above comfortable levels`,
      priority: 'good-to-ask',
    });
  }

  if (hazards?.aircraft_noise_name) {
    items.push({
      question: 'How noticeable is aircraft noise? Which times are worst?',
      why: 'Property is within an airport noise overlay',
      priority: 'good-to-ask',
    });
  }

  // Cold/exposure-triggered questions
  const aspect = report.terrain?.aspect_label;
  const elevation = report.terrain?.elevation_m;
  const isSouthFacing = aspect === 'S' || aspect === 'SE' || aspect === 'SW';
  const isHighElevation = elevation != null && elevation > 200;

  if (isSouthFacing) {
    items.push({
      question: 'How warm does the main living area get in winter? Is there afternoon sun?',
      why: `${aspect}-facing — limited winter sun means higher heating costs`,
      priority: 'must-ask',
    });
  }

  if (isHighElevation || isSouthFacing) {
    items.push({
      question: 'What are typical winter power bills here?',
      why: `${isHighElevation ? `${Math.round(elevation!)}m elevation` : ''}${isHighElevation && isSouthFacing ? ' + ' : ''}${isSouthFacing ? 'south-facing' : ''} — expect higher heating needs`,
      priority: 'must-ask',
    });
  }

  // Old building construction type
  if (hazards?.epb_construction_type) {
    const conType = hazards.epb_construction_type.toLowerCase();
    if (conType.includes('unreinforced') || conType.includes('masonry') || conType.includes('brick')) {
      items.push({
        question: 'Has the building had any structural assessments or earthquake strengthening?',
        why: `Construction type: ${hazards.epb_construction_type} — older building stock`,
        priority: 'must-ask',
      });
    }
  }

  // Dampness risk combo
  const hasDampRisk = (hazards?.flood_zone || hazards?.flood_extent_label) ||
    String(hazards?.liquefaction_zone || '').toLowerCase().includes('high') ||
    hazards?.coastal_erosion_exposure;
  if (hasDampRisk) {
    items.push({
      question: 'Is there any history of dampness, mould, or condensation?',
      why: 'Environmental factors increase moisture risk at this location',
      priority: 'must-ask',
    });
  }

  // Universal good-to-asks
  items.push({
    question: 'Is the property insulated? Ceiling and underfloor?',
    why: 'Insulation ≥R2.9 (ceiling) and ≥R1.3 (underfloor) is required',
    priority: 'good-to-ask',
  });

  items.push({
    question: 'Are pets allowed? Any restrictions?',
    why: 'Best to confirm before applying',
    priority: 'good-to-ask',
  });

  if (!isHighElevation && !isSouthFacing) {
    items.push({
      question: 'What are the typical power and water costs here?',
      why: 'Helps you budget accurately',
      priority: 'good-to-ask',
    });
  }

  const mustAsks = items.filter(i => i.priority === 'must-ask');
  const goodToAsks = items.filter(i => i.priority === 'good-to-ask');

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated">
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-bold">What to ask the landlord</span>
      </div>

      {mustAsks.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Must ask</p>
          {mustAsks.map((item) => (
            <div key={item.question} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">{item.question}</p>
                <p className="text-xs text-muted-foreground">{item.why}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {goodToAsks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Good to ask</p>
          {goodToAsks.map((item) => (
            <div key={item.question} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-piq-primary shrink-0 mt-1.5" />
              <div>
                <p className="text-sm">{item.question}</p>
                <p className="text-xs text-muted-foreground">{item.why}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

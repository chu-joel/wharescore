'use client';

import { ClipboardCheck, ExternalLink } from 'lucide-react';

export interface Action {
  title: string;
  description: string;
  priority: 'essential' | 'recommended' | 'optional';
  link?: { label: string; url: string };
}

const PRIORITY_CONFIG = {
  essential: {
    dot: 'bg-red-500',
    label: 'Essential',
    labelColor: 'text-red-700 dark:text-red-400',
  },
  recommended: {
    dot: 'bg-amber-500',
    label: 'Recommended',
    labelColor: 'text-amber-700 dark:text-amber-400',
  },
  optional: {
    dot: 'bg-blue-500',
    label: 'Optional',
    labelColor: 'text-blue-700 dark:text-blue-400',
  },
} as const;

function ActionItem({ action }: { action: Action }) {
  const config = PRIORITY_CONFIG[action.priority];

  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-1.5 h-2 w-2 rounded-full ${config.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{action.title}</span>
          <span className={`text-xs font-medium ${config.labelColor}`}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {action.description}
        </p>
        {action.link && (
          <a
            href={action.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-piq-primary hover:underline mt-1"
          >
            {action.link.label}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </li>
  );
}

export function DueDiligenceChecklist({ actions }: { actions: Action[] }) {
  if (actions.length === 0) return null;

  const essential = actions.filter(a => a.priority === 'essential');
  const recommended = actions.filter(a => a.priority === 'recommended');
  const optional = actions.filter(a => a.priority === 'optional');

  return (
    <div className="rounded-xl border border-border bg-card p-5 card-elevated">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 shrink-0">
          <ClipboardCheck className="h-4.5 w-4.5 text-piq-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold">Before You Buy: Your Checklist</h3>
          <p className="text-xs text-muted-foreground">
            {actions.length} action{actions.length !== 1 ? 's' : ''} based on this property&apos;s risks
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {essential.map((a, i) => <ActionItem key={`e-${i}`} action={a} />)}
        {recommended.map((a, i) => <ActionItem key={`r-${i}`} action={a} />)}
        {optional.map((a, i) => <ActionItem key={`o-${i}`} action={a} />)}
      </ul>
    </div>
  );
}

/**
 * Generate personalised due diligence actions based on the property's risks.
 */
export function generateActions(report: {
  hazards: import('@/lib/types').HazardData;
  environment: import('@/lib/types').EnvironmentData;
  liveability: import('@/lib/types').LiveabilityData;
  planning: import('@/lib/types').PlanningData;
}): Action[] {
  const actions: Action[] = [];
  const h = report.hazards;
  const e = report.environment;
  const p = report.planning;

  // --- Always recommend ---
  actions.push({
    title: 'Request a LIM report from council',
    description:
      'A Land Information Memorandum contains council records about the property including consents, compliance notices, and hazard information not available elsewhere.',
    priority: 'recommended',
    link: {
      label: 'Request a LIM from your council',
      url: 'https://www.govt.nz/browse/housing-and-property/buying-and-owning-a-home/getting-a-lim-report/',
    },
  });

  // --- Flood zone ---
  if (h.flood_zone) {
    actions.push({
      title: 'Check flood insurance availability and cost',
      description:
        'Contact your insurer about this property specifically. Some insurers exclude flood cover or charge significant excesses for properties in mapped flood zones.',
      priority: 'essential',
    });
    actions.push({
      title: 'Ask the agent about historical flooding',
      description:
        'Ask whether the property has experienced flooding, and request any relevant council or insurance records.',
      priority: 'essential',
    });
  }

  // --- Tsunami ---
  if (h.tsunami_zone) {
    actions.push({
      title: 'Know your tsunami evacuation route',
      description:
        'Familiarise yourself with the local tsunami evacuation zone and the nearest high ground. Your regional civil defence has maps and evacuation routes.',
      priority: 'recommended',
      link: {
        label: 'National Emergency Management Agency',
        url: 'https://getprepared.nz/tsunami/',
      },
    });
  }

  // --- Liquefaction ---
  if (h.liquefaction_zone) {
    const isHigh = h.liquefaction_zone.toLowerCase().includes('high');
    actions.push({
      title: 'Ask about foundation type and condition',
      description:
        isHigh
          ? 'In high-liquefaction areas, foundation type is critical. Ask the vendor or building inspector about the foundation design and any signs of ground movement.'
          : 'Moderate liquefaction risk. Ensure the building inspection covers foundation condition and any signs of ground settlement.',
      priority: isHigh ? 'essential' : 'recommended',
    });
  }

  // --- Slope failure ---
  if (h.slope_failure) {
    const severity = h.slope_failure.toLowerCase();
    if (severity.includes('high') || severity.includes('very')) {
      actions.push({
        title: 'Get a geotechnical assessment',
        description:
          'A geotech report will assess the stability of the land and any retaining structures. This is especially important for hillside properties in high slope-failure zones.',
        priority: 'essential',
      });
      actions.push({
        title: 'Inspect retaining walls',
        description:
          'Check all retaining walls for signs of movement, cracking, or leaning. Replacement can cost $50,000-$200,000+.',
        priority: 'essential',
      });
    }
  }

  // --- EPB ---
  if (h.epb_count && h.epb_count > 0) {
    actions.push({
      title: 'Ask your lawyer about nearby earthquake-prone buildings',
      description:
        `There are ${h.epb_count} earthquake-prone building${h.epb_count > 1 ? 's' : ''} within 300m. Your lawyer should review any implications for your property, especially regarding falling hazards.`,
      priority: 'recommended',
      link: {
        label: 'MBIE EPB Register',
        url: 'https://epbr.building.govt.nz/',
      },
    });
  }

  // --- EPB listed (the property itself) ---
  if (p.epb_listed) {
    actions.push({
      title: 'This building IS earthquake-prone — understand the remediation timeline',
      description:
        h.epb_deadline
          ? `The building is on the earthquake-prone register with a compliance deadline of ${h.epb_deadline}. Ask the vendor about seismic strengthening plans, costs, and who bears the cost.`
          : 'The building is on the earthquake-prone register. Ask the vendor about seismic strengthening plans, costs, and the council deadline for compliance.',
      priority: 'essential',
      link: {
        label: 'MBIE EPB Register',
        url: 'https://epbr.building.govt.nz/',
      },
    });
  }

  // --- Reclaimed land ---
  if (h.gwrc_liquefaction_geology?.toLowerCase().includes('reclaimed')) {
    actions.push({
      title: 'Commission a geotechnical assessment for reclaimed land',
      description:
        'This property is built on reclaimed land, which is highly susceptible to liquefaction. A geotech report should assess ground conditions and foundation adequacy.',
      priority: 'essential',
    });
  }

  // --- Fault zone ---
  if (h.fault_zone_name) {
    actions.push({
      title: 'Check fault avoidance zone building restrictions',
      description:
        `The property is near the ${h.fault_zone_name}. District Plans restrict certain building types and modifications in fault avoidance zones. Check what applies with your local council.`,
      priority: 'recommended',
    });
  }

  // --- Ground shaking amplification ---
  if (h.ground_shaking_severity?.toLowerCase().includes('high')) {
    actions.push({
      title: 'Ask about seismic strengthening and building age',
      description:
        'High ground shaking amplification zone. Older buildings (pre-1976) may not meet current seismic standards. Ask about the building\'s seismic rating and any strengthening work done.',
      priority: 'recommended',
    });
  }

  // --- Contamination ---
  if (h.contamination_count && h.contamination_count > 0) {
    actions.push({
      title: 'Check the SLUR for contamination details',
      description:
        'Review the Selected Land Use Register for details on nearby contaminated sites. Some contamination may affect bore water, gardening, or future development.',
      priority: 'recommended',
      link: {
        label: 'Check HAIL / SLUR register',
        url: 'https://www.mfe.govt.nz/land/contaminated-land',
      },
    });
  }

  // --- Coastal erosion ---
  if (h.coastal_erosion) {
    const isHigh = h.coastal_erosion.toLowerCase().includes('high') || h.coastal_erosion.toLowerCase().includes('severe');
    if (isHigh) {
      actions.push({
        title: 'Check for managed retreat or coastal adaptation plans',
        description:
          'Some councils are developing managed retreat plans for at-risk coastal areas. Ask council planning about any future restrictions on development or use.',
        priority: 'recommended',
      });
    }
  }

  // --- Noise ---
  if (e.noise_db && e.noise_db >= 60) {
    actions.push({
      title: 'Check window glazing and ventilation',
      description:
        e.noise_db >= 65
          ? 'High road noise area. Inspect whether the property has acoustic glazing. Retrofitting double glazing can cost $500-$1,500 per window.'
          : 'Moderate road noise. Double-glazed windows will significantly reduce indoor noise. Check what\'s currently installed.',
      priority: e.noise_db >= 65 ? 'recommended' : 'optional',
    });
  }

  // --- Heritage ---
  if (p.heritage_count && p.heritage_count > 0) {
    actions.push({
      title: 'Check heritage restrictions on modifications',
      description:
        'Heritage-listed buildings nearby may indicate a heritage area. Check if there are any restrictions on exterior modifications, additions, or demolition.',
      priority: 'optional',
    });
  }

  // --- Planning zone ---
  if (p.zone_name) {
    actions.push({
      title: `Understand your zone: ${p.zone_name}`,
      description:
        p.height_limit
          ? `This property is zoned ${p.zone_name} with a ${p.height_limit}m height limit. Check what activities and building types are permitted as of right.`
          : `This property is zoned ${p.zone_name}. Check what activities and building types are permitted, and whether any plan changes are proposed.`,
      priority: 'optional',
      link: {
        label: 'Check your district plan',
        url: 'https://www.mfe.govt.nz/rma/district-plans',
      },
    });
  }

  // Sort by priority
  const priorityOrder = { essential: 0, recommended: 1, optional: 2 };
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return actions;
}

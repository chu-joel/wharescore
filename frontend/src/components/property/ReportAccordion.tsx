'use client';

import {
  ShieldAlert,
  TreePine,
  TrendingUp,
  TrainFront,
  Landmark,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { getRatingColor } from '@/lib/constants';
import { formatScore } from '@/lib/format';
import {
  RiskHazardsSection,
  NeighbourhoodSection,
  MarketSection,
  TransportSection,
  PlanningSection,
} from './sections';
import type { PropertyReport } from '@/lib/types';

interface ReportAccordionProps {
  report: PropertyReport;
}

const SECTION_CONFIG = [
  { name: 'risk' as const, label: 'Risk & Hazards', Icon: ShieldAlert, iconColor: 'text-risk-very-high' },
  { name: 'liveability' as const, label: 'Neighbourhood', Icon: TreePine, iconColor: 'text-piq-success' },
  { name: 'market' as const, label: 'Market & Rental', Icon: TrendingUp, iconColor: 'text-piq-primary' },
  { name: 'transport' as const, label: 'Transport & Access', Icon: TrainFront, iconColor: 'text-piq-primary' },
  { name: 'planning' as const, label: 'Planning & Development', Icon: Landmark, iconColor: 'text-piq-primary' },
] as const;

export function ReportAccordion({ report }: ReportAccordionProps) {
  return (
    <Accordion className="space-y-2">
      {SECTION_CONFIG.map(({ name, label, Icon, iconColor }) => {
        const categories = Array.isArray(report.scores?.categories) ? report.scores.categories : [];
        const category = categories.find((c) => c.name === name);
        if (!category) return null;

        const color = getRatingColor(category.rating);

        return (
          <AccordionItem key={name}>
            <AccordionTrigger className="px-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
                <span className="text-sm font-semibold truncate">{label}</span>
                <Badge
                  className="ml-auto mr-2 text-[10px] text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {formatScore(category.score)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-1">
              <SectionContent name={name} category={category} report={report} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function SectionContent({
  name,
  category,
  report,
}: {
  name: (typeof SECTION_CONFIG)[number]['name'];
  category: NonNullable<ReturnType<PropertyReport['scores']['categories']['find']>>;
  report: PropertyReport;
}) {
  switch (name) {
    case 'risk':
      return <RiskHazardsSection category={category} />;
    case 'liveability':
      return <NeighbourhoodSection category={category} liveability={report.liveability} addressId={report.address.address_id} />;
    case 'market':
      return (
        <MarketSection
          addressId={report.address.address_id}
          category={category}
          market={report.market}
          property={report.property}
          detection={report.property_detection}
        />
      );
    case 'transport':
      return <TransportSection category={category} liveability={report.liveability} />;
    case 'planning':
      return <PlanningSection category={category} planning={report.planning} />;
  }
}

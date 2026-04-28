'use client';

import { useMemo } from 'react';
import {
  ShieldAlert,
  TreePine,
  TrendingUp,
  TrainFront,
  Landmark,
  Lock,
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
import { ReportUpsell } from './ReportUpsell';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import type { PropertyReport, CategoryScore } from '@/lib/types';
import type { SectionRelevance } from '@/lib/sectionRelevance';

interface ReportAccordionProps {
  report: PropertyReport;
  orderedSections: SectionRelevance[];
  defaultOpenSection?: string;
  /** If true, section content is partially gated. shows preview + upsell */
  locked?: boolean;
}

const SECTION_CONFIG = [
  { name: 'risk' as const, label: 'Risk & Hazards', Icon: ShieldAlert, iconColor: 'text-risk-very-high', iconBg: 'bg-red-100 dark:bg-red-900/30' },
  { name: 'liveability' as const, label: 'Neighbourhood', Icon: TreePine, iconColor: 'text-piq-success', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { name: 'market' as const, label: 'Market & Rental', Icon: TrendingUp, iconColor: 'text-piq-primary', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
  { name: 'transport' as const, label: 'Transport & Access', Icon: TrainFront, iconColor: 'text-piq-primary', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
  { name: 'planning' as const, label: 'Planning & Development', Icon: Landmark, iconColor: 'text-piq-primary', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
] as const;

export function ReportAccordion({ report, orderedSections, defaultOpenSection, locked = false }: ReportAccordionProps) {
  const orderedConfig = useMemo(() => {
    if (!orderedSections.length) return [...SECTION_CONFIG];
    return orderedSections
      .map((s) => SECTION_CONFIG.find((c) => c.name === s.section))
      .filter(Boolean) as (typeof SECTION_CONFIG)[number][];
  }, [orderedSections]);

  const topSection = orderedConfig[0]?.name;

  return (
    <Accordion
      className="space-y-2"
      defaultValue={defaultOpenSection ? [defaultOpenSection] : []}
    >
      {orderedConfig.map(({ name, label, Icon, iconColor, iconBg }) => {
        const categories = Array.isArray(report.scores?.categories) ? report.scores.categories : [];
        const category = categories.find((c) => c.name === name);
        if (!category) return null;

        const color = getRatingColor(category.rating);
        const isTopSection = name === topSection;

        const indicatorCount = category.indicators?.filter(i => i.is_available)?.length ?? 0;

        return (
          <AccordionItem key={name} value={name} className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg} shrink-0`}>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <span className="text-sm font-semibold truncate">{label}</span>
                {isTopSection && (
                  <Badge className="text-[9px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-0 shrink-0">
                    Most relevant
                  </Badge>
                )}
                {locked && (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <Badge
                  className="ml-auto mr-2 text-xs text-white shrink-0 font-bold"
                  style={{ backgroundColor: color }}
                >
                  {formatScore(category.score)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {locked ? (
                <LockedSectionPreview category={category} addressId={report.address.address_id} />
              ) : (
                <SectionContent name={name} category={category} report={report} />
              )}
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
      return <RiskHazardsSection category={category} hazards={report.hazards} coastal={report.coastal} />;
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
      return <TransportSection category={category} liveability={report.liveability} walkingReach={report.walking_reach} elevation={report.terrain?.elevation_m} />;
    case 'planning':
      return <PlanningSection category={category} planning={report.planning} />;
  }
}

/** Shows first 4 indicators, blurs the rest, then shows upsell */
const FREE_INDICATORS = 4;

function LockedSectionPreview({ category, addressId }: { category: CategoryScore; addressId: number }) {
  const available = category.indicators?.filter(i => i.is_available) ?? [];
  const unavailable = category.indicators?.filter(i => !i.is_available) ?? [];
  const freeIndicators = available.slice(0, FREE_INDICATORS);
  const hiddenCount = available.length - FREE_INDICATORS + unavailable.length;
  const highRiskHidden = available.slice(FREE_INDICATORS).filter(i => i.score >= 60).length;

  return (
    <div className="space-y-3">
      {/* Show first 2 indicators normally */}
      {freeIndicators.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {freeIndicators.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {/* Blurred preview fading into upsell */}
      {hiddenCount > 0 && (
        <>
          <div className="relative overflow-hidden" style={{ maxHeight: 120 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 select-none" style={{ filter: 'blur(5px)', pointerEvents: 'none' }} aria-hidden>
              {available.slice(FREE_INDICATORS, FREE_INDICATORS + 4).map((indicator) => (
                <IndicatorCard key={indicator.name} indicator={indicator} />
              ))}
            </div>
            {/* Fade-out gradient at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-b from-transparent via-card/60 to-card" />
          </div>
          <ReportUpsell
            addressId={addressId}
            feature="section-detail"
            hiddenCount={hiddenCount > 0 ? hiddenCount : undefined}
            criticalCount={highRiskHidden > 0 ? highRiskHidden : undefined}
          />
        </>
      )}
    </div>
  );
}

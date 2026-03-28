'use client';

import { AlertTriangle } from 'lucide-react';
import type { PropertyReport, CategoryScore } from '@/lib/types';
import type { QuestionId } from '@/lib/reportSections';
import {
  RiskHazardsSection,
  NeighbourhoodSection,
  MarketSection,
  TransportSection,
  PlanningSection,
} from './sections';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { CrimeCard } from './CrimeCard';
import { CrimeTrendSparkline } from './CrimeTrendSparkline';
import { NoiseLevelGauge } from './NoiseLevelGauge';
import { WalkabilityScore } from './WalkabilityScore';
import { TrajectoryIndicator } from './TrajectoryIndicator';
import { InsuranceRiskCard } from './InsuranceRiskCard';
import { InvestmentMetrics } from './InvestmentMetrics';
import { ReportUpsell } from './ReportUpsell';
import { PremiumGate } from './PremiumGate';
import { RenterChecklistContent } from './RenterChecklistContent';
import { BuyerChecklistContent } from './BuyerChecklistContent';
import { BuyerBudgetCalculator } from './BuyerBudgetCalculator';
import { RenterBudgetCalculator } from './RenterBudgetCalculator';
import { PriceAdvisorCard } from './PriceAdvisorCard';
import { useHostedReport } from '@/components/report/HostedReportContext';

interface QuestionContentProps {
  questionId: QuestionId;
  report: PropertyReport;
  locked?: boolean;
}

function findCategory(report: PropertyReport, name: string): CategoryScore | undefined {
  return report.scores?.categories?.find((c) => c.name === name);
}

export function QuestionContent({ questionId, report, locked = false }: QuestionContentProps) {
  const hosted = useHostedReport();
  if (locked && !hosted) {
    return (
      <ReportUpsell
        addressId={report.address.address_id}
        feature="section-detail"
      />
    );
  }

  switch (questionId) {
    // ── Renter Q1 / Buyer Q1: Safety & hazards ──
    // Show critical findings free, gate detailed breakdown + crime behind premium
    case 'safety': {
      const riskCat = findCategory(report, 'risk');
      if (hosted && riskCat) {
        // Hosted: show FULL hazard breakdown (user has paid)
        return (
          <div className="space-y-4">
            <RiskHazardsSection category={riskCat} hazards={report.hazards} environment={report.environment} />
            <CrimeCard
              percentile={report.liveability.crime_rate}
              victimisations={report.liveability.crime_victimisations}
              cityMedian={report.liveability.crime_city_median}
            />
            <InsuranceRiskCard report={report} />
          </div>
        );
      }
      const critical = riskCat?.indicators.filter((i) => i.is_available && i.score >= 60) ?? [];
      return (
        <div className="space-y-4">
          {critical.length > 0 ? (
            <div className="space-y-2">
              {critical.map((indicator) => (
                <div
                  key={indicator.name}
                  className="border-l-[5px] border-risk-very-high rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3.5 flex items-start gap-2.5 shadow-sm shadow-red-200 dark:shadow-red-900/50"
                >
                  {indicator.score >= 80 && (
                    <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  )}
                  <AlertTriangle className="h-4 w-4 text-risk-very-high shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <IndicatorCard indicator={indicator} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-3">
              <EmptyState
                variant="no-risk"
                title="No significant hazard risks detected"
                description={`${riskCat?.indicators.filter((i) => i.is_available).length ?? 0} hazard indicators assessed.`}
              />
            </div>
          )}
          <CrimeCard
            percentile={report.liveability.crime_rate}
            victimisations={report.liveability.crime_victimisations}
            cityMedian={report.liveability.crime_city_median}
          />
          <ReportUpsell addressId={report.address.address_id} feature="section-detail" />
        </div>
      );
    }

    case 'deal-breakers': {
      const riskCat = findCategory(report, 'risk');
      if (hosted && riskCat) {
        return (
          <div className="space-y-4">
            <RiskHazardsSection category={riskCat} hazards={report.hazards} environment={report.environment} />
            <InsuranceRiskCard report={report} />
          </div>
        );
      }
      const critical = riskCat?.indicators.filter((i) => i.is_available && i.score >= 60) ?? [];
      return (
        <div className="space-y-4">
          {critical.length > 0 ? (
            <div className="space-y-2">
              {critical.map((indicator) => (
                <div
                  key={indicator.name}
                  className="border-l-[5px] border-risk-very-high rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3.5 flex items-start gap-2.5 shadow-sm shadow-red-200 dark:shadow-red-900/50"
                >
                  {indicator.score >= 80 && (
                    <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                  )}
                  <AlertTriangle className="h-4 w-4 text-risk-very-high shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <IndicatorCard indicator={indicator} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 p-3">
              <EmptyState
                variant="no-risk"
                title="No deal-breaker hazards found"
                description={`${riskCat?.indicators.filter((i) => i.is_available).length ?? 0} hazard indicators assessed.`}
              />
            </div>
          )}
          <InsuranceRiskCard report={report} />
          <ReportUpsell addressId={report.address.address_id} feature="section-detail" />
        </div>
      );
    }

    // ── Renter Q2: Rent ──
    case 'rent-fair': {
      const marketCat = findCategory(report, 'market');
      return (
        <div className="space-y-4">
          <MarketSection
            addressId={report.address.address_id}
            category={marketCat ?? { name: 'market', score: 0, rating: 'moderate', indicators: [] }}
            market={report.market}
            property={report.property}
            detection={report.property_detection}
          />
          <RenterBudgetCalculator report={report} />
        </div>
      );
    }

    // ── Buyer Q2: True cost — FREE (collects user data via sendBeacon) ──
    case 'true-cost': {
      return (
        <div className="space-y-4">
          {/* Skip PriceAdvisorCard in hosted mode — HostedPriceAdvisor shown above */}
          {!hosted && <PriceAdvisorCard addressId={report.address.address_id} />}
          <BuyerBudgetCalculator report={report} />
          <InsuranceRiskCard report={report} />
        </div>
      );
    }

    // ── Buyer Q3: Investment (PREMIUM: yield + CAGR metrics) ──
    case 'investment': {
      const marketCat = findCategory(report, 'market');
      return (
        <div className="space-y-4">
          <PremiumGate label="Investment analysis" trigger="market">
            <InvestmentMetrics report={report} />
          </PremiumGate>
          {marketCat && (
            <MarketSection
              addressId={report.address.address_id}
              category={marketCat}
              market={report.market}
              property={report.property}
              detection={report.property_detection}
            />
          )}
        </div>
      );
    }

    // ── Renter Q3: Daily life (transport, noise, walkability) ──
    // Note: NeighbourhoodSection already includes CrimeCard, so we don't add it again
    case 'daily-life': {
      const transCat = findCategory(report, 'transport') ?? { name: 'transport', score: 0, rating: 'moderate' as const, indicators: [] };
      return (
        <div className="space-y-4">
          <WalkabilityScore report={report} />
          <TransportSection category={transCat} liveability={report.liveability} />
          <NoiseLevelGauge noiseDb={report.environment.noise_db} />
        </div>
      );
    }

    // ── Renter Q4: Neighbourhood trajectory ──
    // TrajectoryIndicator free (summary), crime trend sparkline is premium
    case 'neighbourhood-improving': {
      return (
        <div className="space-y-4">
          <TrajectoryIndicator report={report} />
          <PremiumGate label="Crime trend chart" trigger="risk">
            <CrimeTrendSparkline addressId={report.address.address_id} />
          </PremiumGate>
        </div>
      );
    }

    // ── Buyer Q4: Neighbourhood ──
    // NeighbourhoodSection includes CrimeCard + NZDep + amenities, so no need to add them separately
    case 'neighbourhood': {
      const livCat = findCategory(report, 'liveability');
      return (
        <div className="space-y-4">
          <TrajectoryIndicator report={report} />
          <CrimeTrendSparkline addressId={report.address.address_id} />
          {livCat && (
            <NeighbourhoodSection
              category={livCat}
              liveability={report.liveability}
              addressId={report.address.address_id}
            />
          )}
        </div>
      );
    }

    // ── Buyer Q5: Restrictions ──
    case 'restrictions': {
      const planCat = findCategory(report, 'planning');
      if (!planCat) return <p className="text-sm text-muted-foreground">No planning data available.</p>;
      return <PlanningSection category={planCat} planning={report.planning} />;
    }

    // ── Checklists (PREMIUM: actionable due diligence lists) ──
    case 'renter-checklist':
      return (
        <PremiumGate label="Personalised renter checklist" trigger="default">
          <RenterChecklistContent report={report} />
        </PremiumGate>
      );

    case 'buyer-checklist':
      return (
        <PremiumGate label="Due diligence checklist" trigger="default">
          <BuyerChecklistContent report={report} />
        </PremiumGate>
      );


    default:
      return null;
  }
}

'use client';

import { usePropertyReport } from '@/hooks/usePropertyReport';
import { useAISummary } from '@/hooks/useAISummary';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertySummaryCard } from './PropertySummaryCard';
import { ScoreGauge } from './ScoreGauge';
import { ScoreStrip } from './ScoreStrip';
import { AISummaryCard } from './AISummaryCard';
import { ReportAccordion } from './ReportAccordion';
import { scoreSectionRelevance } from '@/lib/sectionRelevance';
import { BuildingInfoBanner } from './BuildingInfoBanner';
import { KeyTakeaways } from './KeyTakeaways';
import { BetaBanner } from './BetaBanner';
import { ReportCTABanner } from './ReportCTABanner';
import { ReportUpsell } from './ReportUpsell';
import { FloatingReportButton } from './FloatingReportButton';
import { ErrorState } from '@/components/common/ErrorState';
import { ReportDisclaimer } from '@/components/common/ReportDisclaimer';
import { AppFooter } from '@/components/layout/AppFooter';
import { getRatingBin } from '@/lib/constants';
import { formatCoverage } from '@/lib/format';
import { NotFoundError, RateLimitError } from '@/lib/api';
import { Info, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NearbyHighlights } from './NearbyHighlights';
import { SolarPotentialCard } from './SolarPotentialCard';
import { CommutePreviewCard } from './CommutePreviewCard';
import { KeyFindings } from './KeyFindings';
import { CategoryRadar } from './CategoryRadar';
import { NoiseLevelGauge } from './NoiseLevelGauge';
import { ClimateForecastCard } from './ClimateForecastCard';
import { CoverageRing } from './CoverageRing';
import { useSearchStore } from '@/stores/searchStore';
import { useRouter } from 'next/navigation';

/** How many findings to show for free before gating */
const FREE_FINDINGS = 2;

export function PropertyReport({ addressId }: { addressId: number }) {
  const { data: report, isLoading, error, refetch } = usePropertyReport(addressId);
  const { data: aiData, isLoading: aiLoading } = useAISummary(addressId, !isLoading && !error);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const router = useRouter();

  const handleSearchAnother = () => {
    clearSelection();
    router.push('/');
  };

  if (isLoading) {
    return <ReportSkeleton />;
  }

  if (error) {
    if (error instanceof NotFoundError) {
      return (
        <div className="p-4">
          <ErrorState variant="not-found" />
        </div>
      );
    }
    if (error instanceof RateLimitError) {
      return (
        <div className="p-4">
          <ErrorState variant="rate-limit" onRetry={() => refetch()} />
        </div>
      );
    }
    return (
      <div className="p-4">
        <ErrorState variant="network" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!report) return null;

  const sectionRelevance = scoreSectionRelevance(report);

  const hasScores = Number.isFinite(report.scores?.overall);
  const bin = hasScores ? getRatingBin(report.scores.overall) : null;
  const percentileText = hasScores && report.scores.percentile
    ? `Top ${100 - report.scores.percentile}% in ${report.address.sa2_name}`
    : undefined;
  const hasCategories = Array.isArray(report.scores?.categories) && report.scores.categories.length > 0;

  return (
    <div className="flex flex-col min-h-full" key={addressId}>
      <div className="flex-1 px-4 py-5 space-y-5">
        {/* Beta Banner */}
        <BetaBanner />

        {/* Summary Card */}
        <PropertySummaryCard report={report} />

        {/* Earthquake-Prone Building Warning — always show (safety) */}
        {report.planning?.epb_listed && (
          <div className="flex items-start gap-3 rounded-lg border-2 border-red-500 bg-red-50 p-3 dark:bg-red-950/30">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                Earthquake-Prone Building
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                This property is listed on the earthquake-prone building register.
                The building may require seismic strengthening or demolition within a set timeframe.
              </p>
              <a
                href="https://epbr.building.govt.nz/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-medium text-red-700 underline hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                Check MBIE EPB Register →
              </a>
            </div>
          </div>
        )}

        {/* Multi-unit banner — always show (informational) */}
        {report.property_detection?.is_multi_unit && report.property_detection.unit_count && (
          <BuildingInfoBanner
            unitCount={report.property_detection.unit_count}
            siblingValuations={report.property_detection.sibling_valuations}
            currentValuationId={report.property.cv_valuation_id}
          />
        )}

        {/* Score Gauge — the visual hook */}
        {hasScores && bin ? (
          <ScoreGauge
            score={report.scores.overall}
            label={bin.label}
            color={bin.color}
            percentileText={percentileText}
          />
        ) : (
          <div className="flex flex-col items-center py-4 text-muted-foreground">
            <p className="text-sm">Score not yet available for this property</p>
            <p className="text-xs mt-1">Indicator data is still being processed</p>
          </div>
        )}

        {/* Score Strip — 5 circles, intriguing without detail */}
        {hasCategories && <ScoreStrip categories={report.scores.categories} />}

        {/* Coverage Ring */}
        {report.coverage && (
          <div className="flex items-center justify-center gap-1.5">
            <Tooltip>
              <TooltipTrigger className="cursor-help">
                <CoverageRing
                  available={report.coverage.available}
                  total={report.coverage.total}
                  percentage={report.coverage.percentage}
                />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  This report covers {report.coverage.available} of {report.coverage.total} risk
                  indicators. Coverage depends on available data for this location.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Category Radar — visual profile */}
        {hasCategories && <CategoryRadar categories={report.scores.categories} />}

        {/* === KEY FINDINGS (first 2 free, rest gated) === */}
        <div className="section-divider">
          <KeyFindings report={report} maxFree={FREE_FINDINGS} />
        </div>

        {/* === GATED: AI Summary === */}
        <ReportUpsell addressId={addressId} feature="ai-summary" />

        {/* === GATED: Comparisons === */}
        <ReportUpsell addressId={addressId} feature="comparisons" />

        {/* CTA Banner — primary conversion point */}
        <ReportCTABanner addressId={addressId} />

        {/* Nearby highlights — free (basic counts, builds trust) */}
        <div className="section-divider space-y-5">
          <p className="section-heading">Nearby essentials</p>
          <NearbyHighlights
            addressId={addressId}
            schoolCount={report.liveability.school_count}
            transitCount={report.liveability.transit_count}
          />
          <CommutePreviewCard
            travelTimes={report.liveability.transit_travel_times}
            peakTripsPerHour={report.liveability.peak_trips_per_hour}
            nearestStopName={report.liveability.nearest_stop_name}
          />
          <SolarPotentialCard
            meanKwh={report.hazards.solar_mean_kwh ?? null}
            maxKwh={report.hazards.solar_max_kwh ?? null}
          />
          <NoiseLevelGauge noiseDb={report.environment.noise_db} />
          <ClimateForecastCard projection={report.environment.climate_projection} />
        </div>

        {/* === GATED: Accordion Sections (headers visible, content locked) === */}
        <div className="section-divider space-y-5">
          <p className="section-heading">Detailed breakdown</p>
          <ReportAccordion
            report={report}
            orderedSections={sectionRelevance}
            defaultOpenSection={sectionRelevance[0]?.section}
            locked
          />
        </div>

        {/* === GATED: Checklist === */}
        <div className="section-divider">
          <ReportUpsell addressId={addressId} feature="checklist" />
        </div>

        {/* Key Takeaways — simplified (just CTA buttons) */}
        <div className="section-divider">
          <KeyTakeaways report={report} onSearchAnother={handleSearchAnother} />
        </div>

        {/* Disclaimer */}
        <ReportDisclaimer />
      </div>
      <AppFooter />

      {/* Floating download button — always visible */}
      <FloatingReportButton addressId={addressId} />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Summary card skeleton */}
      <Skeleton className="h-32 w-full rounded-xl" />
      {/* Score gauge skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-36 w-36 rounded-full" />
      </div>
      {/* Score strip skeleton */}
      <div className="flex justify-center gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-9 rounded-full" />
        ))}
      </div>
      {/* AI summary skeleton */}
      <div className="space-y-2 rounded-xl bg-muted/30 p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      {/* Accordion skeletons */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

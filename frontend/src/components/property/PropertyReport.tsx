'use client';

import { usePropertyReport } from '@/hooks/usePropertyReport';
import { useAISummary } from '@/hooks/useAISummary';
import { usePropertyRates } from '@/hooks/usePropertyRates';
import { useAreaFeed } from '@/hooks/useAreaFeed';
import { Skeleton } from '@/components/ui/skeleton';
import { PropertySummaryCard } from './PropertySummaryCard';
import { ScoreGauge } from './ScoreGauge';
import { ScoreStrip } from './ScoreStrip';
import { AISummaryCard } from './AISummaryCard';
import { QuestionAccordion } from './QuestionAccordion';
import { PersonaToggle } from './PersonaToggle';
import { HeroQuestion } from './HeroQuestion';
import { BuildingInfoBanner } from './BuildingInfoBanner';
import { KeyTakeaways } from './KeyTakeaways';
import { BetaBanner } from './BetaBanner';
import { ReportCTABanner } from './ReportCTABanner';
import { FloatingReportButton } from './FloatingReportButton';
import { ErrorState } from '@/components/common/ErrorState';
import { ReportDisclaimer } from '@/components/common/ReportDisclaimer';
import { AppFooter } from '@/components/layout/AppFooter';
import { getRatingBin } from '@/lib/constants';
import { NotFoundError, RateLimitError } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import { KeyFindings } from './KeyFindings';
import { AreaEventTeaser } from './AreaEventTeaser';
import { CategoryRadar } from './CategoryRadar';
import { PremiumGate } from './PremiumGate';
import { DataLayersAccordion } from './DataLayersAccordion';
import { SavePropertyButton } from './SavePropertyButton';
import { ScrollPrompt } from './ScrollPrompt';
import { SocialProof } from './SocialProof';
import { EmailSummaryCapture } from './EmailSummaryCapture';
import { generateFindings } from './FindingCard';
import { trackVisit, shouldShowComparisonUpsell } from '@/hooks/useVisitTracker';
import { usePersonaStore } from '@/stores/personaStore';
import { getQuestionsForPersona } from '@/lib/reportSections';
import { useSearchStore } from '@/stores/searchStore';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';

/** How many findings to show for free before gating */
const FREE_FINDINGS = 2;

export function PropertyReport({ addressId }: { addressId: number }) {
  const { data: report, isLoading, error, refetch } = usePropertyReport(addressId);
  const { data: aiData, isLoading: aiLoading } = useAISummary(addressId, !isLoading && !error);
  // Fire-and-forget: fetch live council rates in parallel — updates CV in DB + invalidates report cache
  usePropertyRates(addressId, !isLoading && !error);
  // Area activity feed — seismic, weather, emergency events near the property
  const { data: areaFeed } = useAreaFeed(addressId, !isLoading && !error);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const router = useRouter();
  const persona = usePersonaStore((s) => s.persona);
  const questions = getQuestionsForPersona(persona);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const canDownload = useDownloadGateStore((s) => s.canDownload);
  const setCoverage = useDownloadGateStore((s) => s.setCoverage);

  // Track property visit for second-visit detection
  useEffect(() => {
    if (!report) return;
    trackVisit(addressId);
    setCoverage(report.coverage ?? null);
    // If second property visit + can't download → show "comparing" upsell after 30s (once per session)
    if (shouldShowComparisonUpsell() && !canDownload().allowed) {
      const t = setTimeout(() => {
        setShowUpgradeModal(true, 'comparing');
      }, 30000);
      return () => clearTimeout(t);
    }
  }, [addressId, report]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchAnother = () => {
    clearSelection();
    router.push('/');
  };

  // Hooks must be called unconditionally (before any early returns)
  const findings = useMemo(() => report ? generateFindings(report, persona) : [], [report, persona]);
  const riskCount = useMemo(() => findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length, [findings]);

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

  if (!report) {
    return (
      <div className="p-4">
        <ErrorState variant="network" onRetry={() => refetch()} />
      </div>
    );
  }

  const hasScores = Number.isFinite(report.scores?.overall);
  const bin = hasScores ? getRatingBin(report.scores.overall) : null;
  const percentileText = hasScores && report.scores.percentile
    ? `Top ${100 - report.scores.percentile}% in ${report.address.sa2_name}`
    : undefined;
  const hasCategories = Array.isArray(report.scores?.categories) && report.scores.categories.length > 0;

  // For renters, first question (safety) is promoted as hero (always expanded).
  // For buyers, all questions go in the accordion (deal-breakers starts expanded via DEFAULT_EXPANDED).
  const heroQuestion = persona === 'buyer' ? null : questions[0];
  // Daily life / neighbourhood is promoted to its own section, so exclude from accordion
  const promotedIds = new Set(['daily-life', 'neighbourhood']);
  const accordionQuestions = (persona === 'buyer' ? questions : questions.slice(1)).filter((q) => !promotedIds.has(q.id));

  return (
    <div className="flex flex-col min-h-full" key={`${addressId}-${persona}`}>
      <div className="flex-1 px-4 py-5 space-y-5">
        {/* Beta Banner */}
        <BetaBanner />

        {/* Summary Card + Save Button */}
        <PropertySummaryCard report={report} />
        <div className="flex items-center justify-between -mt-2">
          <SavePropertyButton
            addressId={addressId}
            fullAddress={report.address.full_address}
          />
          <SocialProof suburbName={report.address.sa2_name} />
        </div>

        {/* Persona Toggle */}
        <PersonaToggle />

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

        {/* === KEY FINDINGS — the emotional hook, show first === */}
        <div className="section-divider">
          <KeyFindings report={report} maxFree={FREE_FINDINGS} persona={persona} addressId={addressId} />
        </div>

        {/* === AREA ACTIVITY FEED TEASER — significant events near property === */}
        {areaFeed && areaFeed.summary.total_events > 0 && (
          <AreaEventTeaser feed={areaFeed} addressId={addressId} />
        )}

        {/* Score Gauge + Strip — context after findings */}
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

        {/* Score Strip — 5 circles */}
        {hasCategories && <ScoreStrip categories={report.scores.categories} />}

        {/* Data Layers Accordion */}
        {report.coverage && (
          <DataLayersAccordion coverage={report.coverage} />
        )}

        {/* Category Radar — visual profile */}
        {hasCategories && <CategoryRadar categories={report.scores.categories} />}

        {/* Email capture + AI Summary */}
        <div className="section-divider">
          <EmailSummaryCapture
            addressId={addressId}
            fullAddress={report.address.full_address}
            findingCount={findings.length}
            riskCount={riskCount}
          />
        </div>

        <AISummaryCard
          summary={aiData?.ai_summary ?? null}
          areaProfile={aiData?.area_profile ?? null}
          suburbName={report.address.sa2_name}
          loading={aiLoading}
        />

        {/* Daily life snapshot — always visible, high-value info */}
        {(() => {
          const dailyLifeQ = questions.find((q) => q.id === 'daily-life' || q.id === 'neighbourhood');
          if (!dailyLifeQ) return null;
          return (
            <div className="section-divider">
              <HeroQuestion question={dailyLifeQ} report={report} />
            </div>
          );
        })()}

        {/* === HERO QUESTION — first question promoted to full-width card === */}
        {heroQuestion && heroQuestion.id !== 'daily-life' && heroQuestion.id !== 'neighbourhood' && (
          <div className="section-divider">
            <HeroQuestion question={heroQuestion} report={report} />
          </div>
        )}

        {/* === QUESTION ACCORDION — remaining questions as expandable sections === */}
        <div className="section-divider space-y-5">
          <p className="section-heading">
            {persona === 'renter' ? 'More about this rental' : 'More about this property'}
          </p>
          <QuestionAccordion
            report={report}
            questions={accordionQuestions}
          />
        </div>

        {/* CTA Banner — primary conversion point */}
        <ReportCTABanner
          addressId={addressId}
          suburbName={report.address.sa2_name}
          capitalValue={report.property.capital_value}
          medianRent={report.market.rent_assessment?.median}
        />

        {/* Key Takeaways — simplified (just CTA buttons) */}
        <div className="section-divider">
          <KeyTakeaways report={report} onSearchAnother={handleSearchAnother} />
        </div>

        {/* Disclaimer */}
        <ReportDisclaimer />
      </div>
      <AppFooter />

      {/* Floating download button — contextual CTA copy */}
      <FloatingReportButton addressId={addressId} riskCount={riskCount} />

      {/* Scroll-triggered upgrade prompt */}
      <ScrollPrompt report={report} />
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Summary card skeleton */}
      <Skeleton className="h-32 w-full rounded-xl" />
      {/* Persona toggle skeleton */}
      <Skeleton className="h-12 w-full rounded-xl" />
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
      {/* Question section skeletons */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

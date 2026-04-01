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
import { useEffect, useMemo, useState } from 'react';

/** How many findings to show for free before gating */
const FREE_FINDINGS = 2;

export function PropertyReport({ addressId }: { addressId: number }) {
  const { data: report, isLoading, isEnriching, error, refetch } = usePropertyReport(addressId);
  const { data: aiData, isLoading: aiLoading } = useAISummary(addressId, !isLoading && !error);
  // Lazily fetch live council rates — DB CV shown first, updates inline when this resolves
  const { data: liveRates, isLoading: ratesLoading } = usePropertyRates(addressId, !isLoading && !error);
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
      <div className="flex-1 px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-5">
        {/* Beta Banner */}
        <BetaBanner />

        {/* Summary Card + Save Button */}
        <PropertySummaryCard report={report} liveRates={liveRates} ratesLoading={ratesLoading} />
        <div className="flex items-center justify-between -mt-2">
          <SavePropertyButton
            addressId={addressId}
            fullAddress={report.address.full_address}
          />
          {isEnriching ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
              Finalising score…
            </span>
          ) : (
            <SocialProof suburbName={report.address.sa2_name} />
          )}
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
                Check building safety register →
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
        <div className="section-divider space-y-3 sm:space-y-5">
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

const ANALYSIS_STEPS = [
  { label: 'Checking flood zones & coastal hazards', icon: '🌊' },
  { label: 'Scanning earthquake & liquefaction data', icon: '🔬' },
  { label: 'Analyzing tsunami & slope failure risk', icon: '⚡' },
  { label: 'Reviewing building & title records', icon: '🏠' },
  { label: 'Checking noise, air & water quality', icon: '🌿' },
  { label: 'Mapping nearby schools & transit', icon: '🚌' },
  { label: 'Reviewing district plan & zoning', icon: '📋' },
  { label: 'Fetching rental market data', icon: '📊' },
  { label: 'Calculating your property score', icon: '✨' },
];

function ReportSkeleton() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => {
        const next = prev + 1;
        if (next < ANALYSIS_STEPS.length) {
          setCompletedSteps((cs) => [...cs, prev]);
          return next;
        }
        // Loop back but keep showing progress
        return prev;
      });
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const currentStep = ANALYSIS_STEPS[step] ?? ANALYSIS_STEPS[ANALYSIS_STEPS.length - 1];
  const progress = Math.min(((step + 1) / ANALYSIS_STEPS.length) * 100, 95);

  return (
    <div className="p-4 pt-8 flex flex-col items-center">
      <div className="max-w-sm w-full space-y-8">
        {/* Animated score circle placeholder */}
        <div className="flex justify-center">
          <div className="relative h-28 w-28">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
              <circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                className="text-piq-primary transition-all duration-700 ease-out"
                strokeDasharray={`${progress * 2.64} 264`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl animate-pulse">{currentStep.icon}</span>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Analyzing property</p>
          <p className="text-xs text-piq-primary font-medium h-5 transition-opacity duration-300">
            {currentStep.label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted/60 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-piq-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Completed checklist */}
        <div className="space-y-1.5">
          {ANALYSIS_STEPS.slice(0, Math.min(step + 1, ANALYSIS_STEPS.length)).map((s, i) => {
            const done = completedSteps.includes(i);
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 text-xs transition-all duration-300 ${
                  done ? 'text-muted-foreground' : 'text-foreground font-medium'
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5 text-piq-primary shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-piq-primary animate-pulse" />
                )}
                {s.label}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Checking 40+ government risk factors
        </p>
      </div>
    </div>
  );
}

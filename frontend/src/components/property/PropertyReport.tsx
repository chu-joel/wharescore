'use client';

import { usePropertyReport } from '@/hooks/usePropertyReport';
import { useAISummary } from '@/hooks/useAISummary';
import { usePropertyRates } from '@/hooks/usePropertyRates';
import { useAreaFeed } from '@/hooks/useAreaFeed';
import { PropertySummaryCard } from './PropertySummaryCard';
// ScoreGauge + ScoreStrip removed — Snapshots now provide the verdict
import { AISummaryCard } from './AISummaryCard';
import { QuestionAccordion } from './QuestionAccordion';
import { PersonaToggle } from './PersonaToggle';
// HeroQuestion removed — renters get LandlordChecklist as hero, buyers use accordion
import { BuildingInfoBanner } from './BuildingInfoBanner';
import { KeyTakeaways } from './KeyTakeaways';
import { BetaBanner } from './BetaBanner';
import { ReportCTABanner } from './ReportCTABanner';
import { FloatingReportButton } from './FloatingReportButton';
import { ErrorState } from '@/components/common/ErrorState';
import { ReportDisclaimer } from '@/components/common/ReportDisclaimer';
import { AppFooter } from '@/components/layout/AppFooter';
// getRatingBin moved to Snapshot components
import { NotFoundError, RateLimitError } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import { KeyFindings } from './KeyFindings';
import { AreaEventTeaser } from './AreaEventTeaser';
import { BuyerSnapshot } from './BuyerSnapshot';
import { BuyerDueDiligence } from './BuyerDueDiligence';
import { RenterSnapshot } from './RenterSnapshot';
import { LandlordChecklist } from './LandlordChecklist';
import { ComparisonBars } from './ComparisonBars';
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

  // Score data used by Snapshot components internally

  // Skip checklist questions from accordion — they're promoted to hero sections.
  // All other questions (including daily-life, neighbourhood, rent-fair) stay in accordion.
  const skipIds = persona === 'renter'
    ? new Set(['renter-checklist'])
    : new Set(['buyer-checklist']);
  const accordionQuestions = questions.filter((q) => !skipIds.has(q.id));

  return (
    <div className="flex flex-col min-h-full" key={`${addressId}-${persona}`}>
      <div className="flex-1 px-3 sm:px-4 py-3 sm:py-5 space-y-3 sm:space-y-5">
        {/* Beta Banner */}
        <BetaBanner />

        {/* Persona toggle sits ABOVE the summary card so persona-specific
            copy (median rent vs CV, etc.) in the card always matches the
            tab the user has selected. Moved from below the card — users
            were seeing a renter-flavoured headline before realising they
            hadn't chosen their persona yet. */}
        <PersonaToggle />

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
            <SocialProof suburbName={report.address.suburb || report.address.sa2_name} />
          )}
        </div>

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

        {/* ═══════════════════════════════════════════════════════
            VERDICT → EVIDENCE → ACTION → UPGRADE → DEEP DIVE
            ═══════════════════════════════════════════════════════ */}

        {/* 1. VERDICT — persona-specific snapshot with overall assessment */}
        {persona === 'renter' && <RenterSnapshot report={report} />}
        {persona === 'buyer' && <BuyerSnapshot report={report} />}

        {/* 1b. COMPARISON — property vs suburb vs city */}
        {report.comparisons && <ComparisonBars report={report} />}

        {/* 2. EVIDENCE — key findings that support the verdict */}
        <div className="section-divider">
          <KeyFindings report={report} maxFree={FREE_FINDINGS} persona={persona} addressId={addressId} />
        </div>

        {/* Area activity — recent events near property */}
        {areaFeed && areaFeed.summary.total_events > 0 && (
          <AreaEventTeaser feed={areaFeed} addressId={addressId} />
        )}

        {/* 3. ACTION — what to do about it (highest-value free content) */}
        {persona === 'renter' && (
          <div className="section-divider">
            <LandlordChecklist report={report} />
          </div>
        )}
        {persona === 'buyer' && (
          <div className="section-divider">
            <BuyerDueDiligence report={report} />
          </div>
        )}

        {/* 4. UPGRADE — conversion point. Divide CV by unit_count for
            multi-unit properties so the "to protect a $X decision" line
            reflects the user's likely purchase, not the whole-building
            rateable value. */}
        {(() => {
          const rawCv = report.property.capital_value;
          const units = report.property_detection?.unit_count ?? 1;
          const isMulti = !!report.property_detection?.is_multi_unit;
          const looksBuildingLevel = !!rawCv && isMulti && units > 1 && rawCv > 5_000_000;
          const effectiveCv = looksBuildingLevel && rawCv ? Math.round(rawCv / units) : rawCv;
          return (
            <ReportCTABanner
              addressId={addressId}
              suburbName={report.address.suburb || report.address.sa2_name}
              capitalValue={effectiveCv}
              medianRent={report.market.rent_assessment?.median}
            />
          );
        })()}

        {/* 5. DEEP DIVE — question sections for users who want more */}
        <div className="section-divider space-y-3 sm:space-y-5">
          <p className="section-heading">
            {persona === 'renter' ? 'More about this rental' : 'More about this property'}
          </p>
          <QuestionAccordion
            report={report}
            questions={accordionQuestions}
          />
        </div>

        {/* AI Summary — area narrative, in the deep dive zone */}
        {/* AI narrative is written per SA2 — keep sa2_name as the label so the
            header matches the content's subject (which may differ from the
            user-facing suburb, e.g. 'Kelburn SA2' vs 'Aro Valley' suburb). */}
        <AISummaryCard
          summary={aiData?.ai_summary ?? null}
          areaProfile={aiData?.area_profile ?? null}
          suburbName={report.address.sa2_name}
          loading={aiLoading}
        />

        {/* Email capture — below the fold */}
        <div className="section-divider">
          <EmailSummaryCapture
            addressId={addressId}
            fullAddress={report.address.full_address}
            findingCount={findings.length}
            riskCount={riskCount}
          />
        </div>

        {/* Data coverage — compact, for users who want to verify */}
        {report.coverage && (
          <DataLayersAccordion coverage={report.coverage} compact />
        )}

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

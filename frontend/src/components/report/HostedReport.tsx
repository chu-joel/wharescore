'use client';

import { useEffect, useMemo } from 'react';
import { Calendar, Share2, Printer, Home, TrendingUp } from 'lucide-react';
import { transformReport } from '@/lib/transformReport';
import { useHostedReportStore, computeRentBand } from '@/stores/hostedReportStore';
import { ReportSidebar } from './ReportSidebar';
import { HostedRentAdvisor } from './HostedRentAdvisor';
import { HostedPriceAdvisor } from './HostedPriceAdvisor';
import { HostedReportProvider } from './HostedReportContext';
import { HostedRentHistory } from './HostedRentHistory';
import { HostedHPIChart } from './HostedHPIChart';
import { HostedHealthyHomes } from './HostedHealthyHomes';
import { HostedNextSteps } from './HostedNextSteps';
import { HostedMethodology } from './HostedMethodology';
import { HostedExecutiveSummary } from './HostedExecutiveSummary';
import { HostedSchools } from './HostedSchools';
import { HostedInfrastructure } from './HostedInfrastructure';
import { HostedNeighbourhoodStats } from './HostedNeighbourhoodStats';
import { HostedAtAGlance } from './HostedAtAGlance';
import { HostedRecommendations } from './HostedRecommendations';
import { HostedNearbyHighlights } from './HostedNearbyHighlights';
import { HostedAISummary } from './HostedAISummary';
import { HostedOutdoorRec } from './HostedOutdoorRec';
import { HostedSchoolZones } from './HostedSchoolZones';
import { HostedRoadNoise } from './HostedRoadNoise';
import { HostedAreaFeed } from './HostedAreaFeed';
import { HostedHazardAdvice } from './HostedHazardAdvice';
import { LazySection } from './LazySection';

import { ScoreGauge } from '@/components/property/ScoreGauge';
import { ScoreStrip } from '@/components/property/ScoreStrip';
import { CategoryRadar } from '@/components/property/CategoryRadar';
import { KeyFindings } from '@/components/property/KeyFindings';
import { QuestionContent } from '@/components/property/QuestionContent';
import { getRatingBin } from '@/lib/constants';
import { getQuestionsForPersona } from '@/lib/reportSections';
import { formatCurrency } from '@/lib/format';
import { useAreaFeed } from '@/hooks/useAreaFeed';
import type { ReportSnapshot, PropertyReport } from '@/lib/types';

interface HostedReportProps {
  snapshot: ReportSnapshot;
  token: string;
}

export function HostedReport({ snapshot, token }: HostedReportProps) {
  const store = useHostedReportStore();

  useEffect(() => {
    store.initFromSnapshot(snapshot.meta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.meta.address_id]);

  const report: PropertyReport = useMemo(() => {
    return transformReport(snapshot.report);
  }, [snapshot.report]);

  const rentBand = useMemo(() => {
    return computeRentBand(snapshot, store);
  }, [snapshot, store.bedrooms, store.bathrooms, store.finishTier, store.weeklyRent, store.hasParking, store.isFurnished, store.isPartiallyFurnished, store.notInsulated, store.sharedKitchen, store.utilitiesIncluded, store.hasOutdoorSpace, store.isCharacterProperty]);

  // Live area feed — fetch seismic/weather/emergency events even for hosted report
  const { data: areaFeed } = useAreaFeed(snapshot.meta.address_id);

  const hasScores = Number.isFinite(report.scores?.overall);
  const bin = hasScores ? getRatingBin(report.scores.overall) : null;
  const persona = snapshot.meta.persona;
  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `Property Report — ${snapshot.meta.full_address}`, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const cv = report.property.capital_value;
  const buildingArea = report.property.building_area_sqm;
  const questions = getQuestionsForPersona(persona);

  // Extract key risk findings
  const riskIndicators = report.scores?.categories?.find(c => c.name === 'risk');

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══ Sticky header ═══ */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-piq-primary font-bold text-sm tracking-tight shrink-0">WhareScore</span>
            <span className="text-border hidden sm:inline">|</span>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">{snapshot.meta.full_address}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleShare} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Share">
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-piq-primary text-white text-xs font-medium hover:bg-piq-primary/90 transition-colors">
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Content (single column, sidebar offset on desktop) ═══ */}
      <div className="lg:pr-80">
      <div className="max-w-2xl mx-auto px-4">

        {/* ═══ COVER ═══ */}
        <div className="pt-10 pb-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-piq-primary/10 text-piq-primary text-xs font-semibold">
            {persona === 'renter' ? <Home className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {persona === 'renter' ? 'Renter Report' : 'Buyer Report'}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{snapshot.meta.full_address}</h1>
          <p className="text-sm text-muted-foreground">{snapshot.meta.sa2_name} · {snapshot.meta.ta_name}</p>

          {hasScores && bin && (
            <div className="flex justify-center pt-2">
              <ScoreGauge score={report.scores.overall} label={bin.label} color={bin.color} />
            </div>
          )}

          {/* Key stats pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {cv && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                CV {formatCurrency(cv)}
              </span>
            )}
            {buildingArea && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                {buildingArea.toLocaleString()} m²
              </span>
            )}
            {report.coverage && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                {report.coverage.available}/{report.coverage.total} data layers
              </span>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3 inline mr-1" />
            Generated {generatedDate}
          </p>
        </div>

        {/* ═══ SCORE STRIP ═══ */}
        {hasScores && report.scores.categories && (
          <div className="pb-6">
            <ScoreStrip categories={report.scores.categories} />
          </div>
        )}

        {/* ═══ AT A GLANCE — RAG status grid ═══ */}
        <div className="pb-6">
          <HostedAtAGlance report={report} />
        </div>

        {/* ═══ EXECUTIVE SUMMARY — key stats, walkability, insurance, area profile ═══ */}
        <div className="pb-6">
          <HostedExecutiveSummary report={report} snapshot={snapshot} persona={persona} rentBand={rentBand} storeBedrooms={store.bedrooms} />
        </div>

        {/* ═══ AI ANALYSIS — narrative summary from Claude ═══ */}
        <div className="pb-6">
          <HostedAISummary snapshot={snapshot} />
        </div>

        {/* ═══ CATEGORY RADAR ═══ */}
        {hasScores && report.scores.categories && (
          <div className="pb-6">
            <CategoryRadar categories={report.scores.categories} />
          </div>
        )}

        {/* ═══ KEY FINDINGS (all shown — user has paid) ═══ */}
        <div className="pb-6">
          <KeyFindings report={report} maxFree={999} persona={persona} />
        </div>

        {/* ═══ HAZARD INTELLIGENCE — watch items, top events, advice, timeline ═══ */}
        <div className="pb-6">
          <HostedAreaFeed feed={areaFeed} snapshot={snapshot} />
        </div>

        {/* ═══ MOBILE SIDEBAR ═══ */}
        <div className="lg:hidden print:hidden pb-6">
          <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
            <ReportSidebar snapshot={snapshot} rentBand={rentBand} />
          </div>
        </div>

        {/* ═══ RENT/PRICE ADVISOR — the core persona-specific analysis ═══ */}
        <div className="pb-6">
          <HostedRentAdvisor snapshot={snapshot} rentBand={rentBand} persona={persona} userRent={store.weeklyRent} />
        </div>

        {snapshot.rent_history?.length > 0 && (
          <div className="pb-6">
            <HostedRentHistory snapshot={snapshot} />
          </div>
        )}

        <div className="pb-6">
          <HostedPriceAdvisor snapshot={snapshot} persona={persona} />
        </div>

        {snapshot.hpi_data?.length > 0 && (
          <div className="pb-6">
            <HostedHPIChart snapshot={snapshot} />
          </div>
        )}

        {/* ═══ ALL QUESTION SECTIONS — deep-dive into each area ═══ */}
        <HostedReportProvider snapshot={snapshot}>
          {questions.map((q) => (
            <div key={q.id} id={`sec-${q.id}`} className="pb-6 scroll-mt-16">
              <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
                <div className="px-5 pt-5 pb-3">
                  <h3 className="text-lg font-bold">{q.question}</h3>
                </div>
                <div className="px-5 pb-5">
                  <QuestionContent questionId={q.id} report={report} />
                </div>
              </div>
            </div>
          ))}
        </HostedReportProvider>

        {/* ═══ Below-fold — lazy-loaded via Intersection Observer ═══ */}

        <LazySection><div className="pb-6">
          <HostedNearbyHighlights snapshot={snapshot} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedSchoolZones snapshot={snapshot} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedSchools rawReport={snapshot.report} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedRoadNoise snapshot={snapshot} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedNeighbourhoodStats rawReport={snapshot.report} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedOutdoorRec snapshot={snapshot} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedInfrastructure rawReport={snapshot.report} />
        </div></LazySection>

        {persona === 'renter' && (
          <LazySection><div className="pb-6">
            <HostedHealthyHomes report={report} />
          </div></LazySection>
        )}

        <LazySection><div className="pb-6">
          <HostedHazardAdvice report={report} snapshot={snapshot} persona={persona} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedRecommendations snapshot={snapshot} persona={persona} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedNextSteps persona={persona} report={report} />
        </div></LazySection>

        <LazySection><div className="pb-6">
          <HostedMethodology />
        </div></LazySection>

        {/* ═══ DISCLAIMER ═══ */}
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2 mb-8">
          <span className="text-piq-primary font-bold text-sm tracking-tight">WhareScore</span>
          <p className="text-xs text-muted-foreground">
            Report generated {generatedDate} for {snapshot.meta.full_address}.
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed max-w-md mx-auto">
            Based on publicly available government data. Not a registered valuation, appraisal, or legal document.
            Risk scores are indicative estimates. Obtain professional reports before making significant financial decisions.
          </p>
          <p className="text-[10px] text-muted-foreground pt-1">
            <a href="https://wharescore.co.nz" className="text-piq-primary hover:underline">wharescore.co.nz</a>
          </p>
        </div>
      </div>

      {/* ═══ DESKTOP SIDEBAR (floating) ═══ */}
      <div className="hidden lg:block fixed top-[49px] right-0 w-80 h-[calc(100vh-49px)] border-l border-border bg-background overflow-y-auto print:hidden">
        <ReportSidebar snapshot={snapshot} rentBand={rentBand} />
      </div>

      </div> {/* end lg:pr-80 wrapper */}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}{sub && <span className="ml-0.5">({sub})</span>}</p>
    </div>
  );
}

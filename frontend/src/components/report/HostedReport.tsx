'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Calendar, Share2, Printer, Home, TrendingUp, ArrowLeft, ChevronRight, ChevronLeft, MapPin, Building2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabs } from '@/components/ui/tabs';
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
import { HostedTerrain } from './HostedTerrain';
import { HostedDemographics } from './HostedDemographics';
import { HostedClimate } from './HostedClimate';

import { LandlordChecklist } from '@/components/property/LandlordChecklist';
import { KnowYourRights } from '@/components/property/KnowYourRights';
import { MouldDampnessRisk } from '@/components/property/MouldDampnessRisk';
import { SunAspectCard } from '@/components/property/SunAspectCard';
import { ScoreGauge } from '@/components/property/ScoreGauge';
import { ScoreStrip } from '@/components/property/ScoreStrip';
import { CategoryRadar } from '@/components/property/CategoryRadar';
import { KeyFindings } from '@/components/property/KeyFindings';
import { QuestionContent } from '@/components/property/QuestionContent';
import { getRatingBin } from '@/lib/constants';
import { getQuestionsForPersona } from '@/lib/reportSections';
import { formatCurrency, effectivePerUnitCv, resolveFloorArea } from '@/lib/format';
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

  // Live area feed. fetch seismic/weather/emergency events even for hosted report
  const { data: areaFeed } = useAreaFeed(snapshot.meta.address_id);

  // Tab from URL hash
  const initialTab = typeof window !== 'undefined' && window.location.hash === '#area' ? 'area' : 'property';

  const hasScores = Number.isFinite(report.scores?.overall);
  const bin = hasScores ? getRatingBin(report.scores.overall) : null;
  const persona = snapshot.meta.persona;
  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const generatedTimeLabel = (() => {
    const d = new Date(snapshot.meta.generated_at);
    if (Number.isNaN(d.getTime())) return null;
    const hour = d.getHours();
    return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  })();

  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `Property Report. ${snapshot.meta.full_address}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Per-unit CV so multi-unit apartment reports don't show the whole-building total.
  const cv = effectivePerUnitCv(report.property.capital_value, {
    isMultiUnit: !!(report.property_detection?.is_multi_unit),
    unitCount: report.property_detection?.unit_count,
  });
  const floor = resolveFloorArea(report.property, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    titleType: report.property.title_type,
  });
  const rawProp = (snapshot.report?.property ?? {}) as Record<string, unknown>;
  const titleType = rawProp.title_type as string;
  const buildingUse = rawProp.building_use as string;
  const propertyType = (titleType && titleType !== 'Unknown' ? titleType : null)
    || (buildingUse && buildingUse !== 'Unknown' ? buildingUse : null);
  const allQuestions = getQuestionsForPersona(persona);
  // Filter out checklist questions. they're rendered standalone after the question sections
  const skipIds = persona === 'renter'
    ? new Set(['renter-checklist'])
    : new Set(['buyer-checklist']);
  const questions = allQuestions.filter((q) => !skipIds.has(q.id));

  // Extract key risk findings
  const riskIndicators = report.scores?.categories?.find(c => c.name === 'risk');

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══ Sticky header ═══ */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="flex items-center gap-1.5 text-piq-primary font-bold text-sm tracking-tight shrink-0 hover:opacity-80 transition-opacity min-h-[44px]" title="Back to WhareScore" aria-label="Back to WhareScore home">
              <ArrowLeft className="h-3.5 w-3.5" />
              WhareScore
            </a>
            <span className="text-border hidden sm:inline">|</span>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">{snapshot.meta.full_address}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] justify-center" title="Copy link to clipboard" aria-label="Share. copy report link">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                {copied ? 'Copied!' : 'Share'}
              </span>
              {copied && <span className="text-xs text-piq-primary font-medium sm:hidden">Copied!</span>}
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-piq-primary text-white text-xs font-medium hover:bg-piq-primary/90 transition-colors min-h-[44px] min-w-[44px] justify-center" title="Print or save as PDF using your browser's print dialog" aria-label="Print report">
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
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

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{snapshot.meta.full_address}</h1>
          <p className="text-sm text-muted-foreground">{snapshot.meta.sa2_name} · {snapshot.meta.ta_name}</p>

          {hasScores && bin && (
            <div className="flex justify-center pt-2">
              <ScoreGauge score={report.scores.overall} label={bin.label} color={bin.color} />
            </div>
          )}

          {/* Key stats pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {propertyType && (
              <span className="px-3 py-1.5 rounded-lg bg-piq-primary/10 border border-piq-primary/20 text-xs font-medium text-piq-primary">
                {propertyType}
              </span>
            )}
            {cv && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                Valuation {formatCurrency(cv)}
              </span>
            )}
            {floor && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                {floor.label} {floor.value.toLocaleString()} m²
              </span>
            )}
            {report.coverage && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                {`${report.coverage.available} sources checked`}
              </span>
            )}
            {snapshot.terrain?.elevation_m != null && (
              <span className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs font-medium">
                {snapshot.terrain.elevation_m.toFixed(0)}m elevation
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 inline mr-1" />
            Generated {generatedDate}{generatedTimeLabel ? ` (${generatedTimeLabel})` : ''}
          </p>

          {/* First-visit orientation */}
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Your personalised property intelligence report. Scroll down to explore, or switch between <strong>Your Property</strong> and <strong>The Area</strong> using the tabs below.
          </p>
        </div>

        {/* ═══ SCORE STRIP ═══ */}
        {hasScores && report.scores.categories && (
          <div className="pb-6">
            <ScoreStrip categories={report.scores.categories} />
          </div>
        )}

        {/* ═══ TABS ═══ */}
        <Tabs defaultValue={initialTab} onTabChange={(tab) => {
          // Update URL hash
          window.history.replaceState(null, '', `#${tab}`);
        }}>
          <div className="sticky top-[49px] z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-2 print:hidden">
            <TabsList className="max-w-md mx-auto">
              <TabsTrigger value="property">
                <span className="flex items-center justify-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Your Property
                </span>
              </TabsTrigger>
              <TabsTrigger value="area">
                <span className="flex items-center justify-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  The Area
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ TAB 1: YOUR PROPERTY ═══ */}
          <TabsContent value="property">
            {/* Print-only section header */}
            <div className="hidden print:block pt-4 pb-2">
              <div className="flex items-center gap-2 border-b-2 border-piq-primary pb-2">
                <Building2 className="h-5 w-5 text-piq-primary" />
                <h2 className="text-xl font-bold text-piq-primary">Part 1: Your Property</h2>
              </div>
            </div>
            <div className="pt-6 print:pt-2">
              <div className="pb-6">
                <HostedAtAGlance report={report} />
              </div>

              <div className="pb-6">
                <HostedExecutiveSummary report={report} snapshot={snapshot} persona={persona} rentBand={rentBand} storeBedrooms={store.bedrooms} />
              </div>

              <div className="pb-6">
                <HostedAISummary snapshot={snapshot} />
              </div>

              {hasScores && report.scores.categories && (
                <div className="pb-6">
                  <CategoryRadar categories={report.scores.categories} />
                </div>
              )}

              <div className="pb-6">
                <KeyFindings report={report} maxFree={999} persona={persona} />
              </div>

              <div className="pb-6">
                <HostedAreaFeed feed={areaFeed} snapshot={snapshot} />
              </div>

              {/* Mobile sidebar (inline copy, hidden on lg+). Screen readers ignore the floating copy on mobile via aria-hidden below. */}
              <div className="lg:hidden print:hidden pb-6" aria-label="Adjust inputs">
                <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
                  <ReportSidebar snapshot={snapshot} rentBand={rentBand} instanceId="mobile" />
                </div>
              </div>

              <div className="pb-6">
                <HostedRentAdvisor snapshot={snapshot} rentBand={rentBand} persona={persona} userRent={store.weeklyRent} />
              </div>

              {/* Renter-specific: Healthy Homes + Mould Risk + Sun. right after rent (their #1 concern) */}
              {persona === 'renter' && (
                <>
                  <div className="pb-6">
                    <HostedHealthyHomes report={report} />
                  </div>
                  <div className="pb-6">
                    <MouldDampnessRisk report={report} />
                  </div>
                  <div className="pb-6">
                    <SunAspectCard report={report} />
                  </div>
                </>
              )}

              {snapshot.rent_history?.length > 0 && (
                <div className="pb-6">
                  <HostedRentHistory snapshot={snapshot} />
                </div>
              )}

              <div className="pb-6">
                <HostedPriceAdvisor snapshot={snapshot} persona={persona} />
              </div>

              {/* HPI chart is a buyer signal. renters have no price exposure. Keep it off the renter report. */}
              {persona === 'buyer' && snapshot.hpi_data?.length > 0 && (
                <div className="pb-6">
                  <HostedHPIChart snapshot={snapshot} />
                </div>
              )}

              <HostedReportProvider snapshot={snapshot}>
                {questions.map((q) => (
                  <div key={q.id} id={`sec-${q.id}`} className="pb-6 scroll-mt-16">
                    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
                      <div className="px-5 pt-5 pb-3">
                        <h3 className="text-lg font-bold">{q.question}</h3>
                      </div>
                      <div className="px-5 pb-5">
                        <QuestionContent questionId={q.id} report={report} persona={persona} />
                      </div>
                    </div>
                  </div>
                ))}
              </HostedReportProvider>

              {/* Renter-specific: Landlord checklist + Rights. after questions, before hazard advice */}
              {persona === 'renter' && (
                <>
                  <div className="pb-6">
                    <LandlordChecklist report={report} />
                  </div>
                  <div className="pb-6">
                    <KnowYourRights report={report} userRent={store.weeklyRent} />
                  </div>
                </>
              )}

              <div className="pb-6">
                <HostedHazardAdvice report={report} snapshot={snapshot} persona={persona} />
              </div>

              <div className="pb-6">
                <HostedRecommendations snapshot={snapshot} persona={persona} />
              </div>

              <div className="pb-6">
                <HostedNextSteps persona={persona} report={report} />
              </div>

              {/* Tab navigation footer */}
              <TabNavFooter direction="next" targetTab="area" label="The Area" />
            </div>
          </TabsContent>

          {/* ═══ TAB 2: THE AREA ═══ */}
          <TabsContent value="area">
            {/* Print-only section header + page break */}
            <div className="hidden print:block pt-4 pb-2" style={{ breakBefore: 'page' }}>
              <div className="flex items-center gap-2 border-b-2 border-piq-primary pb-2">
                <MapPin className="h-5 w-5 text-piq-primary" />
                <h2 className="text-xl font-bold text-piq-primary">Part 2: The Area</h2>
              </div>
            </div>
            <div className="pt-6 print:pt-2">
              <div className="pb-6">
                <HostedDemographics snapshot={snapshot} isFull={true} />
              </div>

              <div className="pb-6">
                <HostedClimate snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedNearbyHighlights snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedSchoolZones snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedSchools rawReport={snapshot.report} />
              </div>

              <div className="pb-6">
                <HostedRoadNoise snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedTerrain snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedNeighbourhoodStats rawReport={snapshot.report} snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedOutdoorRec snapshot={snapshot} />
              </div>

              <div className="pb-6">
                <HostedInfrastructure rawReport={snapshot.report} />
              </div>

              {/* Tab navigation footer */}
              <TabNavFooter direction="prev" targetTab="property" label="Your Property" />
            </div>
          </TabsContent>
        </Tabs>

        {/* ═══ SHARED: Below tabs ═══ */}
        <div className="pb-6 pt-2">
          <HostedMethodology />
        </div>

        {/* ═══ DISCLAIMER ═══ */}
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2 mb-8">
          <span className="text-piq-primary font-bold text-sm tracking-tight">WhareScore</span>
          <p className="text-xs text-muted-foreground">
            Report generated {generatedDate} for {snapshot.meta.full_address}.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            Based on publicly available government data. Not a registered valuation, appraisal, or legal document.
            Risk scores are indicative estimates. Obtain professional reports before making significant financial decisions.
          </p>
          <p className="text-xs text-muted-foreground pt-1">
            <a href="https://wharescore.co.nz" className="text-piq-primary hover:underline">wharescore.co.nz</a>
          </p>
        </div>
      </div>

      {/* ═══ DESKTOP SIDEBAR (floating, hidden below lg) ═══ */}
      <div className="hidden lg:block fixed top-[49px] right-0 w-80 h-[calc(100vh-49px)] border-l border-border bg-background overflow-y-auto print:hidden" aria-label="Adjust inputs">
        <ReportSidebar snapshot={snapshot} rentBand={rentBand} instanceId="desktop" />
      </div>

      </div> {/* end lg:pr-80 wrapper */}
    </div>
  );
}

function TabNavFooter({ direction, targetTab, label }: { direction: 'next' | 'prev'; targetTab: string; label: string }) {
  const { setActiveTab } = useTabs();
  const handleClick = () => {
    setActiveTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.replaceState(null, '', `#${targetTab}`);
  };

  return (
    <div className="print:hidden pb-6">
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors group"
      >
        {direction === 'next' ? (
          <>
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Continue reading</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-piq-primary transition-colors">{label}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-piq-primary transition-colors" />
          </>
        ) : (
          <>
            <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-piq-primary transition-colors" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Go back to</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-piq-primary transition-colors">{label}</p>
            </div>
          </>
        )}
      </button>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}{sub && <span className="ml-0.5">({sub})</span>}</p>
    </div>
  );
}

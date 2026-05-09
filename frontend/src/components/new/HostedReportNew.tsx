'use client';

import { useEffect, useMemo } from 'react';
import { Building2, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, useTabs } from '@/components/ui/tabs';
import { transformReport } from '@/lib/transformReport';
import { useHostedReportStore, computeRentBand } from '@/stores/hostedReportStore';
import { ReportSidebar } from '@/components/report/ReportSidebar';
import { HostedReportProvider } from '@/components/report/HostedReportContext';

// Classic — not yet ported (heavy / niche)
import { HostedNeighbourhoodStats } from '@/components/report/HostedNeighbourhoodStats';
import { HostedAreaFeed } from '@/components/report/HostedAreaFeed';
import { HostedHazardAdvice } from '@/components/report/HostedHazardAdvice';
import { HostedTerrain } from '@/components/report/HostedTerrain';
// HostedDemographics + HostedClimate ported below as *New
import { MOCK_COASTAL_SEVERE } from '@/components/report/HostedCoastalTimeline';
import { HostedCoastalTimelineNew } from '@/components/new/sections/HostedCoastalTimelineNew';

// Ported — new design system
import { HostedExecutiveSummaryNew } from '@/components/new/sections/HostedExecutiveSummaryNew';
import { HostedClimateNew } from '@/components/new/sections/HostedClimateNew';
import { HostedDemographicsNew } from '@/components/new/sections/HostedDemographicsNew';
import { HostedAtAGlanceNew } from '@/components/new/sections/HostedAtAGlanceNew';
import { HostedAISummaryNew } from '@/components/new/sections/HostedAISummaryNew';
import { HostedRentAdvisorNew } from '@/components/new/sections/HostedRentAdvisorNew';
import { HostedPriceAdvisorNew } from '@/components/new/sections/HostedPriceAdvisorNew';
import { HostedHPIChartNew } from '@/components/new/sections/HostedHPIChartNew';
import { HostedHealthyHomesNew } from '@/components/new/sections/HostedHealthyHomesNew';
import { HostedRentHistoryNew } from '@/components/new/sections/HostedRentHistoryNew';
import { HostedRecommendationsNew } from '@/components/new/sections/HostedRecommendationsNew';
import { HostedNextStepsNew } from '@/components/new/sections/HostedNextStepsNew';
import { HostedSchoolsNew } from '@/components/new/sections/HostedSchoolsNew';
import { HostedSchoolZonesNew } from '@/components/new/sections/HostedSchoolZonesNew';
import { HostedNearbyHighlightsNew } from '@/components/new/sections/HostedNearbyHighlightsNew';
import { HostedInfrastructureNew } from '@/components/new/sections/HostedInfrastructureNew';
import { HostedRoadNoiseNew } from '@/components/new/sections/HostedRoadNoiseNew';
import { HostedOutdoorRecNew } from '@/components/new/sections/HostedOutdoorRecNew';
import { HostedMethodologyNew } from '@/components/new/sections/HostedMethodologyNew';

import { LandlordChecklist } from '@/components/property/LandlordChecklist';
import { KnowYourRights } from '@/components/property/KnowYourRights';
import { MouldDampnessRisk } from '@/components/property/MouldDampnessRisk';
import { SunAspectCard } from '@/components/property/SunAspectCard';
import { CategoryRadar } from '@/components/property/CategoryRadar';
import { QuestionContent } from '@/components/property/QuestionContent';
import { getQuestionsForPersona } from '@/lib/reportSections';
import { useAreaFeed } from '@/hooks/useAreaFeed';
import type { ReportSnapshot, PropertyReport } from '@/lib/types';

import { CategoryScoreboardNew } from '@/components/new/sections/CategoryScoreboardNew';
import { KeyFindingsNew } from '@/components/new/sections/KeyFindingsNew';

interface Props {
  snapshot: ReportSnapshot;
  token: string;
}

/**
 * Full hosted report in the new design system. Renders the same sections as
 * classic HostedReport but in the /new chrome:
 * - cover + sticky header live in HostedReportShell (parent)
 * - ScoreStrip replaced by CategoryScoreboardNew
 * - KeyFindings replaced by KeyFindingsNew (severity glyph + keyword + colour)
 * - Tabs (classic) reskinned via tokens-new.css scoped Tailwind remap
 * - All Hosted* sub-components rendered inline (each picks up new tokens)
 * - Methodology + disclaimer replaced with new design
 */
export function HostedReportNew({ snapshot, token }: Props) {
  void token;
  const store = useHostedReportStore();

  useEffect(() => {
    store.initFromSnapshot(snapshot.meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.meta.address_id]);

  const report: PropertyReport = useMemo(
    () => transformReport(snapshot.report, (snapshot as unknown as { rates_data?: unknown }).rates_data),
    [snapshot.report, (snapshot as unknown as { rates_data?: unknown }).rates_data],
  );

  const rentBand = useMemo(
    () => computeRentBand(snapshot, store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      snapshot, store.bedrooms, store.bathrooms, store.finishTier, store.weeklyRent,
      store.hasParking, store.isFurnished, store.isPartiallyFurnished, store.notInsulated,
      store.sharedKitchen, store.utilitiesIncluded, store.hasOutdoorSpace, store.isCharacterProperty,
    ],
  );

  const { data: areaFeed } = useAreaFeed(snapshot.meta.address_id);

  const initialTab = typeof window !== 'undefined' && window.location.hash === '#area' ? 'area' : 'property';
  const persona = snapshot.meta.persona;
  const hasScores = Number.isFinite(report.scores?.overall);

  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const allQuestions = getQuestionsForPersona(persona);
  const skipIds = persona === 'renter' ? new Set(['renter-checklist']) : new Set(['buyer-checklist']);
  const questions = allQuestions.filter((q) => !skipIds.has(q.id));

  return (
    <div style={{ background: 'var(--ws-bg)', overflowX: 'hidden' }}>
      <div style={{ paddingRight: 'min(20rem, 0px)' }} className="hosted-new-content">
        <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 16px' }}>

          {/* ═══ SCOREBOARD (replaces ScoreStrip) ═══ */}
          {hasScores && report.scores.categories && (
            <div style={{ paddingBottom: 24 }}>
              <CategoryScoreboardNew report={report} />
            </div>
          )}

          {/* ═══ TABS ═══ */}
          <Tabs
            defaultValue={initialTab}
            onTabChange={(tab) => {
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', `#${tab}`);
              }
            }}
          >
            <div style={{
              position: 'sticky', top: 56, zIndex: 40,
              background: 'color-mix(in oklab, var(--ws-bg) 95%, transparent)',
              backdropFilter: 'saturate(140%) blur(8px)',
              margin: '0 -16px', padding: '8px 16px',
            }} className="print:hidden">
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

            {/* TAB 1: YOUR PROPERTY */}
            <TabsContent value="property">
              <PrintHeader title="Part 1: Your Property" Icon={Building2} />
              <div style={{ paddingTop: 24 }}>
                <Section><HostedAtAGlanceNew report={report} /></Section>
                <Section><HostedExecutiveSummaryNew report={report} snapshot={snapshot} persona={persona} rentBand={rentBand} storeBedrooms={store.bedrooms} /></Section>
                <Section><HostedAISummaryNew snapshot={snapshot} /></Section>
                {hasScores && report.scores.categories && (
                  <Section><CategoryRadar categories={report.scores.categories} /></Section>
                )}
                <Section>
                  <KeyFindingsNew report={report} persona={persona} maxFree={999} />
                </Section>
                <Section><HostedAreaFeed feed={areaFeed} snapshot={snapshot} /></Section>

                {/* Mobile sidebar */}
                <Section className="lg:hidden">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <ReportSidebar snapshot={snapshot} rentBand={rentBand} instanceId="mobile" />
                  </div>
                </Section>

                <Section><HostedRentAdvisorNew snapshot={snapshot} rentBand={rentBand} persona={persona} userRent={store.weeklyRent} /></Section>

                {persona === 'renter' && (
                  <>
                    <Section><HostedHealthyHomesNew report={report} /></Section>
                    <Section><MouldDampnessRisk report={report} /></Section>
                    <Section><SunAspectCard report={report} /></Section>
                  </>
                )}

                {snapshot.rent_history?.length > 0 && (
                  <Section><HostedRentHistoryNew snapshot={snapshot} /></Section>
                )}

                <Section><HostedPriceAdvisorNew snapshot={snapshot} persona={persona} /></Section>

                {persona === 'buyer' && snapshot.hpi_data?.length > 0 && (
                  <Section><HostedHPIChartNew snapshot={snapshot} /></Section>
                )}

                <HostedReportProvider snapshot={snapshot}>
                  {questions.map((q) => (
                    <div key={q.id} id={`sec-${q.id}`} style={{ paddingBottom: 24, scrollMarginTop: 64 }}>
                      <article style={{
                        background: 'var(--ws-surface)',
                        border: '1px solid var(--ws-rule)',
                        borderRadius: 'var(--ws-radius-lg)',
                        boxShadow: 'var(--ws-shadow-sm)',
                        overflow: 'hidden',
                      }}>
                        <header style={{ padding: '16px 20px 10px', borderBottom: '1px solid var(--ws-rule)' }}>
                          <h3 style={{
                            margin: 0, fontSize: 16, fontWeight: 700,
                            color: 'var(--ws-ink)', letterSpacing: '-0.005em',
                          }}>
                            {q.question}
                          </h3>
                        </header>
                        <div style={{ padding: '14px 20px 18px' }}>
                          <QuestionContent questionId={q.id} report={report} persona={persona} />
                        </div>
                      </article>
                    </div>
                  ))}
                </HostedReportProvider>

                {persona === 'renter' && (
                  <>
                    <Section><LandlordChecklist report={report} /></Section>
                    <Section><KnowYourRights report={report} userRent={store.weeklyRent} /></Section>
                  </>
                )}

                {(() => {
                  const useMock = process.env.NODE_ENV !== 'production'
                    && typeof window !== 'undefined'
                    && new URLSearchParams(window.location.search).get('mockCoastal') === '1';
                  const coastal = useMock ? MOCK_COASTAL_SEVERE : snapshot.coastal;
                  if (!coastal || coastal.tier === 'not_applicable') return null;
                  return <Section><HostedCoastalTimelineNew coastal={coastal} persona={persona} /></Section>;
                })()}

                <Section><HostedHazardAdvice report={report} snapshot={snapshot} persona={persona} /></Section>
                <Section><HostedRecommendationsNew snapshot={snapshot} persona={persona} /></Section>
                <Section><HostedNextStepsNew persona={persona} report={report} /></Section>

                <TabNavFooter direction="next" targetTab="area" label="The Area" />
              </div>
            </TabsContent>

            {/* TAB 2: THE AREA */}
            <TabsContent value="area">
              <PrintHeader title="Part 2: The Area" Icon={MapPin} pageBreak />
              <div style={{ paddingTop: 24 }}>
                <Section><HostedDemographicsNew snapshot={snapshot} isFull={true} /></Section>
                <Section><HostedClimateNew snapshot={snapshot} /></Section>
                <Section><HostedNearbyHighlightsNew snapshot={snapshot} /></Section>
                <Section><HostedSchoolZonesNew snapshot={snapshot} /></Section>
                <Section><HostedSchoolsNew rawReport={snapshot.report} /></Section>
                <Section><HostedRoadNoiseNew snapshot={snapshot} /></Section>
                <Section><HostedTerrain snapshot={snapshot} /></Section>
                <Section><HostedNeighbourhoodStats rawReport={snapshot.report} snapshot={snapshot} /></Section>
                <Section><HostedOutdoorRecNew snapshot={snapshot} /></Section>
                <Section><HostedInfrastructureNew rawReport={snapshot.report} /></Section>

                <TabNavFooter direction="prev" targetTab="property" label="Your Property" />
              </div>
            </TabsContent>
          </Tabs>

          {/* Methodology + Disclaimer (shared) */}
          <Section><HostedMethodologyNew /></Section>

          <div style={{
            border: '1px solid var(--ws-rule)',
            background: 'var(--ws-bg-2)',
            borderRadius: 'var(--ws-radius-lg)',
            padding: 20,
            textAlign: 'center',
            display: 'grid', gap: 6,
            marginBottom: 32,
          }}>
            <span style={{ color: 'var(--ws-piq)', fontWeight: 700, fontSize: 13, letterSpacing: '-0.005em' }}>
              WhareScore
            </span>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
              Report generated {generatedDate} for {snapshot.meta.full_address}.
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Based on publicly available government data. Not a registered valuation, appraisal, or legal document. Risk scores are indicative estimates. Obtain professional reports before making significant financial decisions.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>
              <a href="https://wharescore.co.nz" style={{ color: 'var(--ws-piq)' }}>wharescore.co.nz</a>
            </p>
          </div>
        </div>

        {/* Desktop floating sidebar — only on lg+ */}
        <aside
          aria-label="Adjust inputs"
          style={{
            position: 'fixed', top: 56, right: 0,
            width: 320, height: 'calc(100vh - 56px)',
            borderLeft: '1px solid var(--ws-rule)',
            background: 'var(--ws-surface)', overflowY: 'auto',
          }}
          className="hidden lg:block print:hidden"
        >
          <ReportSidebar snapshot={snapshot} rentBand={rentBand} instanceId="desktop" />
        </aside>
      </div>

      {/* lg: pad right so floating sidebar doesn't overlap content */}
      <style>{`
        @media (min-width: 1024px) {
          .hosted-new-content { padding-right: 320px; }
        }
      `}</style>
    </div>
  );
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ paddingBottom: 24 }} className={className}>
      {children}
    </div>
  );
}

function PrintHeader({ title, Icon, pageBreak }: { title: string; Icon: typeof Building2; pageBreak?: boolean }) {
  return (
    <div className="hidden print:block pt-4 pb-2" style={pageBreak ? { breakBefore: 'page' } : undefined}>
      <div className="flex items-center gap-2 border-b-2 border-piq-primary pb-2">
        <Icon className="h-5 w-5 text-piq-primary" />
        <h2 className="text-xl font-bold text-piq-primary">{title}</h2>
      </div>
    </div>
  );
}

function TabNavFooter({ direction, targetTab, label }: { direction: 'next' | 'prev'; targetTab: string; label: string }) {
  const { setActiveTab } = useTabs();
  const onClick = () => {
    setActiveTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.replaceState(null, '', `#${targetTab}`);
  };
  return (
    <div style={{ paddingBottom: 24 }} className="print:hidden">
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--ws-surface)',
          border: '1px solid var(--ws-rule)',
          borderRadius: 'var(--ws-radius-lg)',
          cursor: 'pointer',
          transition: 'border-color 180ms, background-color 180ms',
        }}
        className="ws-tab-nav"
      >
        {direction === 'next' ? (
          <>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>Continue reading</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ws-ink)' }}>{label}</p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--ws-ink-mute)' }} />
          </>
        ) : (
          <>
            <ChevronLeft size={18} style={{ color: 'var(--ws-ink-mute)' }} />
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>Go back to</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ws-ink)' }}>{label}</p>
            </div>
          </>
        )}
      </button>
    </div>
  );
}

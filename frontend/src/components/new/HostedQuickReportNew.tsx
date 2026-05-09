'use client';

import { useEffect, useMemo } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { transformReport } from '@/lib/transformReport';
import { useHostedReportStore, computeRentBand } from '@/stores/hostedReportStore';
import { QuickHazardSummary } from '@/components/report/QuickHazardSummary';
import { QuickActions } from '@/components/report/QuickActions';
import { QuickVerdict } from '@/components/report/QuickVerdict';
import { QuickUpgradeBanner } from '@/components/report/QuickUpgradeBanner';
import { HostedDemographicsNew } from '@/components/new/sections/HostedDemographicsNew';

// Ported sections
import { HostedAtAGlanceNew } from '@/components/new/sections/HostedAtAGlanceNew';
import { HostedSchoolZonesNew } from '@/components/new/sections/HostedSchoolZonesNew';
import { HostedNearbyHighlightsNew } from '@/components/new/sections/HostedNearbyHighlightsNew';
import { LandlordChecklist } from '@/components/property/LandlordChecklist';
import { MouldDampnessRisk } from '@/components/property/MouldDampnessRisk';
import { KnowYourRights } from '@/components/property/KnowYourRights';
import type { ReportSnapshot, PropertyReport } from '@/lib/types';
import { HostedReportProvider } from '@/components/report/HostedReportContext';

import { CategoryScoreboardNew } from '@/components/new/sections/CategoryScoreboardNew';
import { KeyFindingsNew } from '@/components/new/sections/KeyFindingsNew';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  snapshot: ReportSnapshot;
  token: string;
}

/**
 * Quick hosted report in the new design system. Same sections and gating as
 * classic HostedQuickReport (8-section preview), drops cover/header (shell
 * provides them), uses CategoryScoreboardNew + KeyFindingsNew for the lead.
 */
export function HostedQuickReportNew({ snapshot, token }: Props) {
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

  const persona = snapshot.meta.persona;
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');
  const fullPrice = '$2.99';
  const hasScores = Number.isFinite(report.scores?.overall);
  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  void isPro;

  // AI bottom line
  const ai = snapshot.ai_insights as { bottom_line?: string; key_takeaways?: string[] } | null;

  return (
    <HostedReportProvider snapshot={snapshot}>
      <div style={{ background: 'var(--ws-bg)', overflowX: 'hidden' }}>
        <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 16px' }}>

          {hasScores && report.scores.categories && (
            <Section><CategoryScoreboardNew report={report} /></Section>
          )}

          {/* Bottom line */}
          {ai?.bottom_line && (
            <Section>
              <Card>
                <CardHead title="The bottom line" meta="AI summary" />
                <div className="ws-card-body" style={{ display: 'grid', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--ws-ink)' }}>
                    {ai.bottom_line}
                  </p>
                  {ai.key_takeaways && ai.key_takeaways.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                      {ai.key_takeaways.slice(0, 3).map((t, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ws-ink-soft)' }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--ws-piq)', flexShrink: 0, marginTop: 7,
                          }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </Section>
          )}

          <Section><HostedAtAGlanceNew report={report} /></Section>
          <Section><KeyFindingsNew report={report} persona={persona} maxFree={3} /></Section>
          <Section>
            <QuickVerdict snapshot={snapshot} persona={persona} rentBand={rentBand} userRent={store.weeklyRent} />
          </Section>

          {persona === 'renter' && (
            <>
              <Section><MouldDampnessRisk report={report} /></Section>
              <Section><LandlordChecklist report={report} /></Section>
              <Section><KnowYourRights report={report} userRent={store.weeklyRent} /></Section>
            </>
          )}

          <Section><QuickHazardSummary report={report} snapshot={snapshot} /></Section>
          <Section><HostedSchoolZonesNew snapshot={snapshot} /></Section>
          <Section><HostedNearbyHighlightsNew snapshot={snapshot} /></Section>
          <Section><HostedDemographicsNew snapshot={snapshot} isFull={false} /></Section>
          <Section><QuickActions snapshot={snapshot} persona={persona} /></Section>

          {/* Expiry warning */}
          {(() => {
            if (!snapshot.expires_at) return null;
            const expiresAt = new Date(snapshot.expires_at);
            const now = new Date();
            const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysLeft > 7) return null;
            const urgent = daysLeft <= 3;
            const accent = urgent ? 'var(--ws-r-vhigh)' : 'var(--ws-r-high)';
            return (
              <div style={{
                border: `1px solid ${urgent ? 'rgba(196,45,45,.40)' : 'rgba(213,94,0,.40)'}`,
                background: urgent ? 'rgba(196,45,45,.04)' : 'rgba(213,94,0,.04)',
                borderRadius: 'var(--ws-radius)',
                padding: 16,
                display: 'flex', alignItems: 'flex-start', gap: 12,
                marginBottom: 16,
              }}>
                <Clock size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: accent }}>
                    {daysLeft <= 0
                      ? 'This report expires today'
                      : `This report expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)', lineHeight: 1.5 }}>
                    Quick Reports are available for 30 days. Upgrade to a Full Report to keep it permanently and unlock 25+ sections.
                  </p>
                  <a
                    href="#upgrade-banner"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('upgrade-banner')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 600, color: 'var(--ws-piq)',
                      marginTop: 4,
                    }}
                  >
                    <Sparkles size={12} />
                    Upgrade to Full Report. {fullPrice}
                  </a>
                </div>
              </div>
            );
          })()}

          <Section>
            <div id="upgrade-banner">
              <QuickUpgradeBanner token={token} />
            </div>
          </Section>

          {/* Disclaimer */}
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
              Quick Report generated {generatedDate} for {snapshot.meta.full_address}.
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Based on publicly available government data. Not a registered valuation, appraisal, or legal document. Risk scores are indicative estimates. Obtain professional reports before making significant financial decisions.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5 }}>
              <a href="https://wharescore.co.nz" style={{ color: 'var(--ws-piq)' }}>wharescore.co.nz</a>
            </p>
          </div>

        </div>
      </div>
    </HostedReportProvider>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div style={{ paddingBottom: 24 }}>{children}</div>;
}

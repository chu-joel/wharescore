'use client';

import { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { usePropertyReport } from '@/hooks/usePropertyReport';
import { useAISummary } from '@/hooks/useAISummary';
import { useAreaFeed } from '@/hooks/useAreaFeed';
import { usePersonaStore } from '@/stores/personaStore';
import { useRentInputStore } from '@/stores/rentInputStore';
import { useBuyerInputStore } from '@/stores/buyerInputStore';
import { useSearchStore } from '@/stores/searchStore';
import { useTypologyMedian } from '@/hooks/useTypologyMedian';
import { generateFindings } from '@/components/property/FindingCard';
import { trackVisit, markVisitedEver } from '@/hooks/useVisitTracker';

import { HeroBlockNew } from '@/components/new/sections/HeroBlockNew';
import { CategoryScoreboardNew } from '@/components/new/sections/CategoryScoreboardNew';
import { KeyFindingsNew } from '@/components/new/sections/KeyFindingsNew';
import { IndicatorGrid23New } from '@/components/new/sections/IndicatorGrid23New';
import { ComparisonBarsNew } from '@/components/new/sections/ComparisonBarsNew';
import { DataLayersNew } from '@/components/new/sections/DataLayersNew';
import { CoverageNew } from '@/components/new/sections/CoverageNew';
import { AISummaryNew } from '@/components/new/sections/AISummaryNew';
import { BuyerSnapshotNew } from '@/components/new/sections/BuyerSnapshotNew';
import { RenterSnapshotNew } from '@/components/new/sections/RenterSnapshotNew';
import { LandlordChecklistNew } from '@/components/new/sections/LandlordChecklistNew';
import { SocialProofNew } from '@/components/new/sections/SocialProofNew';
import { EmailSummaryCaptureNew } from '@/components/new/sections/EmailSummaryCaptureNew';
import { ReportCTABannerNew } from '@/components/new/sections/ReportCTABannerNew';
import { ReportDisclaimerNew } from '@/components/new/sections/ReportDisclaimerNew';
import { FloatingReportButtonNew } from '@/components/new/sections/FloatingReportButtonNew';
import { ScrollPromptNew } from '@/components/new/sections/ScrollPromptNew';
import { SignupNudgeNew } from '@/components/new/sections/SignupNudgeNew';
import { BetaBannerNew } from '@/components/new/sections/BetaBannerNew';
import { BuildingInfoBannerNew } from '@/components/new/sections/BuildingInfoBannerNew';
import { KeyTakeawaysNew } from '@/components/new/sections/KeyTakeawaysNew';
import { AreaEventTeaserNew } from '@/components/new/sections/AreaEventTeaserNew';

/**
 * On-screen property report — fully ported to the new design system.
 *
 * Every section uses new primitives (Card, SeverityTag, Pill, IndicatorChip,
 * BarRow, LayerRow, Finding) and new tokens. All gating, persona logic,
 * modal triggers, save/share/export, signup nudges and area events continue
 * to flow through the existing stores and hooks unchanged.
 */
export function PropertyReportNew({ addressId }: { addressId: number }) {
  const { data: report, isLoading, error } = usePropertyReport(addressId);
  const { data: aiData, isLoading: aiLoading } = useAISummary(addressId, !isLoading && !error);
  const { data: areaFeed } = useAreaFeed(addressId, !isLoading && !error);
  const persona = usePersonaStore((s) => s.persona);
  const weeklyRent = useRentInputStore((s) => s.weeklyRent);
  const askingPrice = useBuyerInputStore((s) => s.askingPrice);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const typologyMedian = useTypologyMedian(report?.market?.rental_overview ?? []).median;

  const findings = useMemo(
    () => (report ? generateFindings(report, persona, { weeklyRent, askingPrice, typologyMedian }) : []),
    [report, persona, weeklyRent, askingPrice, typologyMedian],
  );
  const riskCount = useMemo(
    () => findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length,
    [findings],
  );

  useEffect(() => {
    if (!report) return;
    trackVisit(addressId);
    markVisitedEver();
  }, [report, addressId]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 420, color: 'var(--ws-ink-mute)' }}>
        <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--ws-piq)' }} />
          <span style={{ fontSize: 13 }}>Loading report&hellip;</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{
          border: '1px solid var(--ws-rule)', borderRadius: 'var(--ws-radius-lg)',
          background: 'var(--ws-surface)', padding: 18,
        }}>
          <strong>Couldn&rsquo;t load this property.</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--ws-ink-soft)' }}>
            The address may be invalid, or the API is unreachable.
          </p>
        </div>
      </div>
    );
  }

  const suburbName = report.address?.suburb || report.address?.sa2_name || '';

  return (
    <div>
      <HeroBlockNew report={report} />

      <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>

        <BetaBannerNew />

        {report.property_detection?.is_multi_unit && (report.property_detection.unit_count ?? 0) >= 2 && (
          <BuildingInfoBannerNew
            unitCount={report.property_detection.unit_count ?? 0}
            siblingValuations={report.property_detection.sibling_valuations ?? null}
            currentValuationId={report.property?.cv_valuation_id ?? null}
          />
        )}

        <CategoryScoreboardNew report={report} />

        <SocialProofNew suburbName={suburbName} />

        <KeyTakeawaysNew report={report} onSearchAnother={clearSelection} />

        <KeyFindingsNew report={report} persona={persona} addressId={addressId} maxFree={5} />

        {areaFeed && <AreaEventTeaserNew feed={areaFeed} addressId={addressId} />}

        <AISummaryNew
          summary={aiData?.ai_summary ?? null}
          areaProfile={aiData?.area_profile ?? null}
          suburbName={suburbName}
          loading={aiLoading}
        />

        {persona === 'renter' ? (
          <>
            <RenterSnapshotNew report={report} />
            <LandlordChecklistNew report={report} />
          </>
        ) : (
          <BuyerSnapshotNew report={report} />
        )}

        <IndicatorGrid23New report={report} />

        <ComparisonBarsNew report={report} />

        <DataLayersNew report={report} />

        <CoverageNew report={report} />

        <EmailSummaryCaptureNew
          addressId={addressId}
          fullAddress={report.address.full_address}
          findingCount={findings.length}
          riskCount={riskCount}
        />

        <ReportCTABannerNew
          addressId={addressId}
          suburbName={suburbName}
          capitalValue={report.property?.capital_value ?? null}
          medianRent={report.market?.rent_assessment?.median ?? null}
        />

        <ReportDisclaimerNew />
      </div>

      {/* Fixed-position conversion chrome */}
      <FloatingReportButtonNew addressId={addressId} riskCount={riskCount} />
      <ScrollPromptNew report={report} />
      <SignupNudgeNew />
    </div>
  );
}

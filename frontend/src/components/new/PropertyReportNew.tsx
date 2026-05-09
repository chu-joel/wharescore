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
import { ScrollPromptNew } from '@/components/new/sections/ScrollPromptNew';
import { SignupNudgeNew } from '@/components/new/sections/SignupNudgeNew';
import { BetaBannerNew } from '@/components/new/sections/BetaBannerNew';
import { BuildingInfoBannerNew } from '@/components/new/sections/BuildingInfoBannerNew';
import { KeyTakeawaysNew } from '@/components/new/sections/KeyTakeawaysNew';
import { AreaEventTeaserNew } from '@/components/new/sections/AreaEventTeaserNew';
import { GenerateReportButtonNew } from '@/components/new/sections/GenerateReportButtonNew';
import { RentAdvisorCard } from '@/components/property/RentAdvisorCard';
import { PriceAdvisorCard } from '@/components/property/PriceAdvisorCard';
import { RentComparisonFlow } from '@/components/property/RentComparisonFlow';
import { SavePropertyButton } from '@/components/property/SavePropertyButton';
import { PropertyDetailsChip } from '@/components/property/PropertyDetailsChip';
import { BuyerDueDiligence } from '@/components/property/BuyerDueDiligence';
import { QuestionAccordion } from '@/components/property/QuestionAccordion';
import { HPITrendChart } from '@/components/property/HPITrendChart';
import { RentHistoryChart } from '@/components/property/RentHistoryChart';
import { PremiumGate } from '@/components/property/PremiumGate';
import { getQuestionsForPersona } from '@/lib/reportSections';
import { AlertTriangle } from 'lucide-react';

/**
 * On-screen property report — fully ported to the new design system.
 *
 * Every section uses new primitives (Card, SeverityTag, Pill, IndicatorChip,
 * BarRow, LayerRow, Finding) and new tokens. All gating, persona logic,
 * modal triggers, save/share/export, signup nudges and area events continue
 * to flow through the existing stores and hooks unchanged.
 */
export function PropertyReportNew({ addressId }: { addressId: number }) {
  const { data: report, isLoading, isEnriching, error } = usePropertyReport(addressId);
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

  // Effective per-unit CV — if the rates record is building-level for a
  // multi-unit site (heuristic: > $5m AND >1 unit), divide by unit count
  // so the CTA banner ("to protect a $X decision") matches the user's
  // likely purchase, not the whole-building rateable value. Mirrors the
  // IIFE in classic PropertyReport.tsx.
  const rawCv = report.property?.capital_value ?? null;
  const units = report.property_detection?.unit_count ?? 1;
  const isMulti = !!report.property_detection?.is_multi_unit;
  const looksBuildingLevel = !!rawCv && isMulti && units > 1 && (rawCv as number) > 5_000_000;
  const effectiveCv = looksBuildingLevel && rawCv ? Math.round((rawCv as number) / units) : rawCv;

  // QuestionAccordion ("More about this property") deep-dive. Skip the
  // checklist questions that are already promoted to hero sections.
  const questions = getQuestionsForPersona(persona);
  const skipIds = persona === 'renter' ? new Set(['renter-checklist']) : new Set(['buyer-checklist']);
  const accordionQuestions = questions.filter((q) => !skipIds.has(q.id));

  return (
    <div>
      <HeroBlockNew
        report={report}
        actionSlot={<GenerateReportButtonNew addressId={addressId} riskCount={riskCount} />}
      />

      <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <SavePropertyButton
            addressId={addressId}
            fullAddress={report.address.full_address}
            score={report.scores?.overall ?? null}
            rating={report.scores?.rating ?? null}
            isMultiUnit={!!report.property_detection?.is_multi_unit}
            lng={report.address.lng}
            lat={report.address.lat}
          />
          {isEnriching && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--ws-ink-mute)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: 'var(--ws-ink-mute)', opacity: 0.6,
              }} />
              Finalising score&hellip;
            </span>
          )}
        </div>

        {/* Property details chip — drives bedrooms/bathrooms/dwelling/finish
            for RentAdvisorCard + PriceAdvisorCard inputs across the report.
            Without this the advisor cards have no shared input source. */}
        <PropertyDetailsChip report={report} />

        <BetaBannerNew />

        {/* Earthquake-Prone Building hard safety banner — always shown when
            the property is on the MBIE EPB register, regardless of persona
            or gating. Mirrors classic PropertyReport. */}
        {report.planning?.epb_listed && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            borderRadius: 8, border: '2px solid var(--ws-r-vhigh, #c42d2d)',
            background: 'rgba(196,45,45,.06)', padding: 12,
          }}>
            <AlertTriangle size={18} style={{ color: 'var(--ws-r-vhigh, #c42d2d)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ display: 'grid', gap: 4 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ws-r-vhigh, #c42d2d)' }}>
                Earthquake-Prone Building
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ws-ink-soft)' }}>
                This property is listed on the earthquake-prone building register.
                The building may require seismic strengthening or demolition within a set timeframe.
              </p>
              <a
                href="https://epbr.building.govt.nz/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--ws-r-vhigh, #c42d2d)', textDecoration: 'underline' }}
              >
                Check building safety register →
              </a>
            </div>
          </div>
        )}

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

        <KeyFindingsNew report={report} persona={persona} addressId={addressId} maxFree={2} />

        {areaFeed && areaFeed.summary?.total_events > 0 && (
          <AreaEventTeaserNew feed={areaFeed} addressId={addressId} />
        )}

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
            {/* Rent predictor — same component the classic UI uses
                (carries its own card chrome). Mirrors classic
                MarketSection's RentComparisonFlow + RentAdvisorCard
                pairing, just hoisted into the main on-screen flow so
                renters don't need a hidden accordion to find it. */}
            <RentComparisonFlow
              addressId={addressId}
              market={report.market}
              detection={report.property_detection ?? null}
            />
            <RentAdvisorCard addressId={addressId} />
            {/* Rent history chart — classic component fetches via API
                and renders inline. Mirrors classic MarketSection. */}
            <RentHistoryChart addressId={addressId} />
          </>
        ) : (
          <>
            <BuyerSnapshotNew report={report} />
            {/* Buyer due-diligence tracker — "what we covered vs what
                you still need". ACTION-zone content from classic
                PropertyReport, brought across so buyers don't lose the
                checklist of inspections / consents / insurance steps. */}
            <BuyerDueDiligence report={report} />
            {/* Market price predictor — surfaced on-screen rather than
                buried in an accordion so buyers can see the asking-price
                vs estimate read at a glance. Uses the existing classic
                card unchanged. */}
            <PriceAdvisorCard addressId={addressId} />
          </>
        )}

        <IndicatorGrid23New report={report} />

        <ComparisonBarsNew report={report} />

        {/* HPI trend — buyer-only, gated behind PremiumGate to mirror
            classic MarketSection. A national house price index has no
            bearing on a rental decision so renters never see it. */}
        {persona === 'buyer' && (
          <PremiumGate label="NZ House Price Index trend" trigger="market">
            <HPITrendChart />
          </PremiumGate>
        )}

        {/* Deep-dive accordion — "More about this property" — keeps
            classic QuestionAccordion intact (each question maps to a
            full section: safety/daily-life/neighbourhood/restrictions
            /investment/true-cost). Reusing the classic component avoids
            losing the per-question content while a native /new port is
            outstanding; tokens compose with tokens-new.css. */}
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{
            margin: 0, fontSize: 12, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: 'var(--ws-ink-mute)',
          }}>
            {persona === 'renter' ? 'More about this rental' : 'More about this property'}
          </p>
          <QuestionAccordion report={report} questions={accordionQuestions} />
        </div>

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
          capitalValue={effectiveCv}
          medianRent={report.market?.rent_assessment?.median ?? null}
        />

        <ReportDisclaimerNew />
      </div>

      {/* Fixed-position conversion chrome. The Generate Report CTA is
          now inline in HeroBlockNew (matches A6-balanced header slot)
          rather than hovering over the map as a fixed pill. */}
      <ScrollPromptNew report={report} />
      <SignupNudgeNew />
    </div>
  );
}

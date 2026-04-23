'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Share2, Printer, Home, TrendingUp, ArrowLeft, Clock, Sparkles } from 'lucide-react';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { transformReport } from '@/lib/transformReport';
import { useHostedReportStore, computeRentBand } from '@/stores/hostedReportStore';
import { HostedAtAGlance } from './HostedAtAGlance';
import { HostedSchoolZones } from './HostedSchoolZones';
import { HostedNearbyHighlights } from './HostedNearbyHighlights';
import { QuickHazardSummary } from './QuickHazardSummary';
import { QuickActions } from './QuickActions';
import { QuickVerdict } from './QuickVerdict';
import { QuickUpgradeBanner } from './QuickUpgradeBanner';
import { HostedDemographics } from './HostedDemographics';
import { ScoreGauge } from '@/components/property/ScoreGauge';
import { ScoreStrip } from '@/components/property/ScoreStrip';
import { KeyFindings } from '@/components/property/KeyFindings';
import { LandlordChecklist } from '@/components/property/LandlordChecklist';
import { MouldDampnessRisk } from '@/components/property/MouldDampnessRisk';
import { KnowYourRights } from '@/components/property/KnowYourRights';
import { getRatingBin } from '@/lib/constants';
import { formatCurrency, effectivePerUnitCv, resolveFloorArea } from '@/lib/format';
import type { ReportSnapshot, PropertyReport } from '@/lib/types';
import { HostedReportProvider } from './HostedReportContext';

interface HostedQuickReportProps {
  snapshot: ReportSnapshot;
  token: string;
}

export function HostedQuickReport({ snapshot, token }: HostedQuickReportProps) {
  const store = useHostedReportStore();

  useEffect(() => {
    store.initFromSnapshot(snapshot.meta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.meta.address_id]);

  const report: PropertyReport = useMemo(() => {
    return transformReport(snapshot.report, (snapshot as unknown as { rates_data?: unknown }).rates_data);
  }, [snapshot.report, (snapshot as unknown as { rates_data?: unknown }).rates_data]);

  const rentBand = useMemo(() => {
    return computeRentBand(snapshot, store);
  }, [snapshot, store.bedrooms, store.bathrooms, store.finishTier, store.weeklyRent, store.hasParking, store.isFurnished, store.isPartiallyFurnished, store.notInsulated, store.sharedKitchen, store.utilitiesIncluded, store.hasOutdoorSpace, store.isCharacterProperty]);

  const hasScores = Number.isFinite(report.scores?.overall);
  const bin = hasScores ? getRatingBin(report.scores.overall) : null;
  const persona = snapshot.meta.persona;
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');
  const fullPrice = isPro ? '$4.99' : '$9.99';
  const generatedDate = new Date(snapshot.meta.generated_at).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

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

  // AI bottom line
  const ai = snapshot.ai_insights as { bottom_line?: string; key_takeaways?: string[] } | null;

  return (
    <HostedReportProvider snapshot={snapshot}>
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ═══ Sticky header ═══ */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="flex items-center gap-1.5 text-piq-primary font-bold text-sm tracking-tight shrink-0 hover:opacity-80 transition-opacity min-h-[44px]" title="Back to WhareScore" aria-label="Back to WhareScore home">
              <ArrowLeft className="h-3.5 w-3.5" />
              WhareScore
            </a>
            <span className="text-border hidden sm:inline">|</span>
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">{snapshot.meta.full_address}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-piq-primary/10 text-piq-primary text-xs font-semibold">Quick</span>
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

      {/* ═══ Content. single column, no sidebar ═══ */}
      <div className="max-w-2xl mx-auto px-4">

        {/* ═══ COVER ═══ */}
        <div className="pt-10 pb-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-piq-primary/10 text-piq-primary text-xs font-semibold">
            {persona === 'renter' ? <Home className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {persona === 'renter' ? 'Quick Renter Report' : 'Quick Buyer Report'}
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
          </div>

          <p className="text-xs text-muted-foreground">
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

        {/* ═══ 1. AI BOTTOM LINE ═══ */}
        {ai?.bottom_line && (
          <div className="pb-6">
            <div className="rounded-xl border border-border bg-card card-elevated p-5 space-y-3">
              <h3 className="text-lg font-bold">The Bottom Line</h3>
              <p className="text-sm leading-relaxed">{ai.bottom_line}</p>
              {ai.key_takeaways && ai.key_takeaways.length > 0 && (
                <ul className="space-y-1.5">
                  {ai.key_takeaways.slice(0, 3).map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-piq-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ═══ 2. AT A GLANCE. RAG status grid ═══ */}
        <div className="pb-6">
          <HostedAtAGlance report={report} />
        </div>

        {/* ═══ 3. KEY FINDINGS (top 3. upgrade for all) ═══ */}
        <div className="pb-6">
          <KeyFindings report={report} maxFree={3} persona={persona} />
        </div>

        {/* ═══ 4. RENT/PRICE VERDICT ═══ */}
        <div className="pb-6">
          <QuickVerdict
            snapshot={snapshot}
            persona={persona}
            rentBand={rentBand}
            userRent={store.weeklyRent}
          />
        </div>

        {/* ═══ RENTER-SPECIFIC: Mould risk + Landlord checklist + Rights ═══ */}
        {persona === 'renter' && (
          <>
            <div className="pb-6">
              <MouldDampnessRisk report={report} />
            </div>
            <div className="pb-6">
              <LandlordChecklist report={report} />
            </div>
            <div className="pb-6">
              <KnowYourRights report={report} userRent={store.weeklyRent} />
            </div>
          </>
        )}

        {/* ═══ 4. HAZARD SUMMARY ═══ */}
        <div className="pb-6">
          <QuickHazardSummary report={report} snapshot={snapshot} />
        </div>

        {/* ═══ 5. SCHOOLS ═══ */}
        <div className="pb-6">
          <HostedSchoolZones snapshot={snapshot} />
        </div>

        {/* ═══ 6. NEIGHBOURHOOD HIGHLIGHTS ═══ */}
        <div className="pb-6">
          <HostedNearbyHighlights snapshot={snapshot} />
        </div>

        {/* ═══ 7. DEMOGRAPHICS (basic. population, age, commute) ═══ */}
        <div className="pb-6">
          <HostedDemographics snapshot={snapshot} isFull={false} />
        </div>

        {/* ═══ 8. TOP ACTIONS ═══ */}
        <div className="pb-6">
          <QuickActions snapshot={snapshot} persona={persona} />
        </div>

        {/* ═══ EXPIRY WARNING + UPGRADE BANNER ═══ */}
        {(() => {
          if (!snapshot.expires_at) return null;
          const expiresAt = new Date(snapshot.expires_at);
          const now = new Date();
          const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 7) return null; // Only show warning in last 7 days
          const isUrgent = daysLeft <= 3;
          return (
            <div className={`pb-4 rounded-xl border-2 ${isUrgent ? 'border-red-500/40 bg-red-50 dark:bg-red-950/20' : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20'} p-4 flex items-start gap-3`}>
              <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="flex-1 space-y-1">
                <p className={`text-sm font-semibold ${isUrgent ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {daysLeft <= 0
                    ? 'This report expires today'
                    : `This report expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Quick Reports are available for 30 days. Upgrade to a Full Report to keep it permanently
                  and unlock 25+ sections of detailed analysis.
                </p>
                <a
                  href="#upgrade"
                  onClick={(e) => { e.preventDefault(); document.getElementById('upgrade-banner')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-piq-primary hover:underline mt-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Upgrade to Full Report. {fullPrice}
                </a>
              </div>
            </div>
          );
        })()}
        <div className="pb-6" id="upgrade-banner">
          <QuickUpgradeBanner token={token} />
        </div>

        {/* ═══ DISCLAIMER ═══ */}
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2 mb-8">
          <span className="text-piq-primary font-bold text-sm tracking-tight">WhareScore</span>
          <p className="text-xs text-muted-foreground">
            Quick Report generated {generatedDate} for {snapshot.meta.full_address}.
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
    </div>
    </HostedReportProvider>
  );
}

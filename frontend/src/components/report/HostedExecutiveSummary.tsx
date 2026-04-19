'use client';

import { AlertTriangle, MapPin, Building2, Ruler, TreePine, Bus, Navigation, Shield, Footprints, Volume2 } from 'lucide-react';
import type { PropertyReport, ReportSnapshot } from '@/lib/types';
import { formatCurrency, effectivePerUnitCv } from '@/lib/format';
import { isInFloodZone } from '@/lib/hazards';

interface Props {
  report: PropertyReport;
  snapshot: ReportSnapshot;
  persona: string;
  rentBand?: { bandLow: number; bandHigh: number; baseline: { raw_median: number; bond_count: number } | null };
  storeBedrooms?: string;
}

export function HostedExecutiveSummary({ report, snapshot, persona, rentBand, storeBedrooms }: Props) {
  const hazards = report.hazards;
  const market = report.market;
  const prop = report.property;

  // Access raw snapshot data for fields not in typed interfaces
  const rawLive = (snapshot.report.liveability ?? {}) as Record<string, unknown>;
  const rawPlan = (snapshot.report.planning ?? {}) as Record<string, unknown>;
  const rawEnv = (snapshot.report.environment ?? {}) as Record<string, unknown>;
  const rawProp = (snapshot.report.property ?? {}) as Record<string, unknown>;

  // Key stats grid
  const stats: { icon: React.ReactNode; label: string; value: string }[] = [];

  const bedrooms = storeBedrooms ?? String((snapshot.meta.inputs_at_purchase ?? {} as Record<string, unknown>).bedrooms ?? '');
  if (bedrooms) stats.push({ icon: <Building2 className="h-3.5 w-3.5" />, label: 'Bedrooms', value: bedrooms });

  // For multi-unit properties where only a building-level CV exists,
  // show the per-unit estimate instead of the whole-building total so
  // the sidebar doesn't advertise a "$80.8M Capital Value" on an apartment.
  const detection = (snapshot.report.property_detection ?? {}) as { is_multi_unit?: boolean; unit_count?: number };
  const effectiveCv = effectivePerUnitCv(prop.capital_value, {
    isMultiUnit: !!detection.is_multi_unit,
    unitCount: detection.unit_count,
  });
  const cvIsPerUnitEstimate = !!(
    detection.is_multi_unit && (detection.unit_count ?? 1) > 1 && effectiveCv !== prop.capital_value
  );
  const hideBuildingAreas = !!detection.is_multi_unit && (detection.unit_count ?? 1) > 1;

  if (effectiveCv) stats.push({
    icon: <Building2 className="h-3.5 w-3.5" />,
    label: cvIsPerUnitEstimate ? 'Capital Value (est. per unit)' : 'Capital Value',
    value: formatCurrency(effectiveCv),
  });
  if (prop.land_value && !hideBuildingAreas) stats.push({ icon: <TreePine className="h-3.5 w-3.5" />, label: 'Land Value', value: formatCurrency(prop.land_value) });
  if (prop.improvement_value && !hideBuildingAreas) stats.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: 'Improvements', value: formatCurrency(prop.improvement_value) });
  if (prop.building_area_sqm && !hideBuildingAreas) stats.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: 'Building', value: `${prop.building_area_sqm.toLocaleString()} m²` });
  if (prop.land_area_sqm && !hideBuildingAreas) stats.push({ icon: <TreePine className="h-3.5 w-3.5" />, label: 'Land Area', value: `${prop.land_area_sqm.toLocaleString()} m²` });

  const footprint = rawProp.footprint_sqm as number;
  if (footprint && footprint !== prop.building_area_sqm && !hideBuildingAreas) {
    stats.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: 'Footprint', value: `${Math.round(footprint).toLocaleString()} m²` });
  }

  // Skip "Use" when the value is literally "Unknown" — showing a prominent "Unknown" cell
  // undermines confidence in the rest of the card.
  const buildingUse = String(rawProp.building_use ?? '');
  if (buildingUse && buildingUse.toLowerCase() !== 'unknown') {
    stats.push({ icon: <Building2 className="h-3.5 w-3.5" />, label: 'Use', value: buildingUse });
  }

  const titleType = String(rawProp.title_type ?? '');
  const titleNo = String(rawProp.title_no ?? '');
  if (titleType && titleType.toLowerCase() !== 'unknown') {
    stats.push({ icon: <Building2 className="h-3.5 w-3.5" />, label: 'Title', value: titleType });
  }
  if (titleNo && persona === 'buyer') stats.push({ icon: <Building2 className="h-3.5 w-3.5" />, label: 'Title Ref', value: titleNo });

  // Estate description is raw legal jargon (e.g. "Stratum in Freehold, 1/1, Unit 3 and Accessory
  // Unit A3 DP 85559"). Collapsed into the details accordion below instead of the big stat grid
  // so it doesn't dominate the card for renters who can't act on it.
  const estateDesc = String(rawProp.estate_description ?? '');

  // Zone display: the zone category often duplicates the tail of the zone name (e.g.
  // "High Density Residential Zone" + "Zone"). Only show the category parenthetically when
  // it adds real information.
  const zoneName = String(rawPlan.zone_name ?? '');
  const zoneCategory = String(rawPlan.zone_category ?? '');
  const categoryIsRedundant =
    !zoneCategory ||
    zoneCategory === zoneName ||
    zoneName.toLowerCase().includes(zoneCategory.toLowerCase());
  const zoneDisplay = categoryIsRedundant ? zoneName : `${zoneName} (${zoneCategory})`;
  if (zoneName) stats.push({ icon: <MapPin className="h-3.5 w-3.5" />, label: 'Zone', value: zoneDisplay });

  const transitStops = report.liveability?.transit_count;
  if (transitStops != null) stats.push({ icon: <Bus className="h-3.5 w-3.5" />, label: 'Transit (400m)', value: `${transitStops} stops` });

  const cbdDist = report.liveability?.cbd_distance_m;
  if (cbdDist) stats.push({ icon: <Navigation className="h-3.5 w-3.5" />, label: 'To CBD', value: cbdDist >= 1000 ? `${(cbdDist / 1000).toFixed(1)} km` : `${Math.round(cbdDist)} m` });

  const noiseDb = report.environment?.noise_db;
  if (noiseDb) stats.push({ icon: <Volume2 className="h-3.5 w-3.5" />, label: 'Road Noise', value: `${Math.round(noiseDb)} dB` });

  // Walkability — from raw snapshot since not in typed LiveabilityData
  const walkScoreRaw = rawLive.walkability_score;
  const walkScore: number | undefined = typeof walkScoreRaw === 'number' ? walkScoreRaw : undefined;
  const walkLabel = walkScore != null ? (walkScore >= 90 ? "Walker's Paradise" : walkScore >= 70 ? 'Very Walkable' : walkScore >= 50 ? 'Somewhat Walkable' : 'Car-Dependent') : null;

  // Insurance risk
  const insuranceFactors: string[] = [];
  if (hazards.tsunami_zone) insuranceFactors.push('Tsunami zone');
  if (isInFloodZone(hazards)) insuranceFactors.push('Flood zone');
  if (hazards.liquefaction_zone) insuranceFactors.push('Liquefaction');
  if (hazards.coastal_erosion) insuranceFactors.push('Coastal erosion');
  const insuranceLevel = insuranceFactors.length === 0 ? 'Low' : insuranceFactors.length <= 2 ? 'Moderate' : 'High';

  // Trajectory — from raw snapshot
  const trajectoryRaw = rawLive.trajectory as Record<string, unknown> | undefined;
  const trajectoryDir = String(trajectoryRaw?.direction ?? '');
  const trajectoryLabel = String(trajectoryRaw?.label ?? '');

  // Area profile
  const areaProfile = report.area_profile;

  // Median rent
  const medianRent = market?.rent_assessment?.median;

  // Multi-unit flag
  const isMultiUnit = !!(report.property_detection?.is_multi_unit ?? rawProp.multi_unit);
  const cvDate = String(rawProp.cv_date ?? '');
  const isContaminated = !!(rawPlan.contaminated_listed ?? report.planning?.contamination_count);

  // EPB alert
  const epbCount = hazards.epb_count;
  const isEpbListed = !!rawPlan.epb_listed;

  // Red flags count
  const findings = report.scores?.categories?.flatMap(c => c.indicators?.filter(i => i.score >= 60) ?? []) ?? [];
  const criticalCount = findings.filter(f => f.score >= 80).length;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-lg font-bold mb-4">Executive Summary</h3>

        {/* ── Key Stats Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/40 border border-border p-2.5 text-center">
              <div className="hidden sm:flex justify-center mb-1 text-muted-foreground">{s.icon}</div>
              <p className="text-sm font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Walkability + Insurance side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {typeof walkScore === 'number' && (
            <div className="rounded-lg border border-border p-3 flex items-center gap-3">
              <div className="shrink-0">
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 60 60" className="w-14 h-14">
                    <circle cx="30" cy="30" r="26" fill="none" stroke="#E2E8F0" strokeWidth="4" />
                    <circle cx="30" cy="30" r="26" fill="none" stroke="#0D7377" strokeWidth="4"
                      strokeDasharray={`${(walkScore / 100) * 163.4} 163.4`}
                      strokeLinecap="round" transform="rotate(-90 30 30)" />
                    <text x="30" y="33" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0D7377">{walkScore}</text>
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Footprints className="h-3 w-3" /> Walkability</p>
                <p className="text-sm font-bold text-piq-primary">{walkLabel}</p>
              </div>
            </div>
          )}

          <div className={`rounded-lg border p-3 ${
            insuranceLevel === 'Low' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' :
            insuranceLevel === 'Moderate' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' :
            'border-red-200 bg-red-50/50 dark:bg-red-950/10'
          }`}>
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Insurance Risk</p>
            <p className={`text-sm font-bold ${
              insuranceLevel === 'Low' ? 'text-green-700' : insuranceLevel === 'Moderate' ? 'text-amber-700' : 'text-red-700'
            }`}>{insuranceLevel}</p>
            {insuranceFactors.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                May face excess or exclusions for {insuranceFactors.join(', ').toLowerCase()}.
              </p>
            )}
          </div>
        </div>

        {/* ── Property flags (buyer) ── */}
        {persona === 'buyer' && (isMultiUnit || cvDate || isContaminated) && (
          <div className="text-xs text-muted-foreground space-y-1 mb-5">
            {isMultiUnit && <p><span className="font-medium">Multi-unit building</span> — check body corporate rules, levies, and long-term maintenance plan.</p>}
            {isContaminated && <p className="text-amber-700 font-medium">This property is on the contaminated land register. Get a Phase 1 Environmental Site Assessment.</p>}
            {cvDate && <p>Council valuation date: {new Date(cvDate).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })}.</p>}
          </div>
        )}

        {/* ── EPB Alert ── */}
        {isEpbListed && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 mb-5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">This property is on the Earthquake-Prone Buildings register</p>
              <p className="text-xs text-red-600/80 mt-0.5">
                Check MBIE EPB register for remediation timeline{hazards.epb_deadline ? ` — deadline: ${hazards.epb_deadline}` : ''}.
              </p>
            </div>
          </div>
        )}

        {/* ── Trajectory ── */}
        {trajectoryDir && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 mb-5 flex items-center gap-2">
            <span className={`text-lg ${trajectoryDir === 'improving' ? 'text-green-600' : trajectoryDir === 'declining' ? 'text-red-600' : 'text-amber-600'}`}>
              {trajectoryDir === 'improving' ? '↑' : trajectoryDir === 'declining' ? '↓' : '→'}
            </span>
            <span className="text-sm font-medium">
              Neighbourhood is {trajectoryDir}
              {trajectoryLabel && <span className="text-muted-foreground font-normal"> — {trajectoryLabel}</span>}
            </span>
          </div>
        )}

        {/* ── Rent / Yield context ── */}
        {/* Renter: show the PERSONALISED fair-band for this bedroom count / condition, not the
            area all-beds median (which was previously labelled "Market rent estimate" and sat
            adjacent to a different number in the Rent Advisor below). */}
        {persona === 'renter' && rentBand?.baseline && rentBand.bandLow > 0 && (
          <div className="rounded-lg border border-border bg-piq-primary/5 p-3 mb-5">
            <p className="text-sm">
              <span className="font-medium text-muted-foreground">Fair rent for a {storeBedrooms ?? ''}-bed here: </span>
              <span className="font-bold text-piq-primary">${rentBand.bandLow}–${rentBand.bandHigh}/wk</span>
              {market?.trend?.cagr_1yr != null && (
                <span className={`ml-2 text-xs font-medium ${market.trend!.cagr_1yr! >= 0 ? 'text-piq-accent-warm' : 'text-piq-success'}`}>
                  {market.trend!.cagr_1yr! >= 0 ? '+' : ''}{market.trend!.cagr_1yr!.toFixed(1)}%/yr area trend
                </span>
              )}
            </p>
            {medianRent && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Area all-sizes median: ${medianRent}/wk · {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}
              </p>
            )}
          </div>
        )}
        {persona === 'buyer' && rentBand?.baseline && rentBand.bandLow > 0 && (
          <div className="rounded-lg border border-border bg-piq-primary/5 p-3 mb-5">
            <p className="text-sm">
              <span className="font-medium text-muted-foreground">Market rent estimate: </span>
              <span className="font-bold text-piq-primary">${rentBand.bandLow}–${rentBand.bandHigh}/wk</span>
              <span className="text-muted-foreground"> ({formatCurrency(Math.round((rentBand.bandLow + rentBand.bandHigh) / 2 * 52))}/yr)</span>
              {market?.trend?.cagr_1yr != null && (
                <span className={`ml-2 text-xs font-medium ${market.trend!.cagr_1yr! >= 0 ? 'text-piq-accent-warm' : 'text-piq-success'}`}>
                  {market.trend!.cagr_1yr! >= 0 ? '+' : ''}{market.trend!.cagr_1yr!.toFixed(1)}%/yr
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              For {storeBedrooms ?? '2'}-bed {snapshot.meta.dwelling_type.toLowerCase()} · {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}
            </p>
          </div>
        )}

        {/* ── Area Profile ── */}
        {areaProfile && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold mb-1.5">About {snapshot.meta.sa2_name}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {areaProfile}
            </p>
          </div>
        )}

        {/* ── Estate / title description (collapsed by default) ── */}
        {estateDesc && (
          <details className="text-xs text-muted-foreground group">
            <summary className="cursor-pointer select-none hover:text-foreground transition-colors">
              Title &amp; estate details
            </summary>
            <p className="mt-1.5 font-mono leading-relaxed break-words">
              {estateDesc}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}

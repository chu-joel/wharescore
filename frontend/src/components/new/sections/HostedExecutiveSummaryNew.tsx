'use client';

import { AlertTriangle, MapPin, Building2, Ruler, TreePine, Bus, Navigation, Shield, Footprints, Volume2 } from 'lucide-react';
import type { PropertyReport, ReportSnapshot } from '@/lib/types';
import { formatCurrency, effectivePerUnitCv, resolveFloorArea } from '@/lib/format';
import { isInFloodZone } from '@/lib/hazards';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props {
  report: PropertyReport;
  snapshot: ReportSnapshot;
  persona: string;
  rentBand?: { bandLow: number; bandHigh: number; baseline: { raw_median: number; bond_count: number } | null };
  storeBedrooms?: string;
}

export function HostedExecutiveSummaryNew({ report, snapshot, persona, rentBand, storeBedrooms }: Props) {
  const hazards = report.hazards;
  const market = report.market;
  const prop = report.property;

  const rawLive = (snapshot.report.liveability ?? {}) as Record<string, unknown>;
  const rawPlan = (snapshot.report.planning ?? {}) as Record<string, unknown>;
  const rawProp = (snapshot.report.property ?? {}) as Record<string, unknown>;

  const stats: { Icon: typeof Building2; label: string; value: string }[] = [];

  const bedrooms = storeBedrooms ?? String((snapshot.meta.inputs_at_purchase ?? {} as Record<string, unknown>).bedrooms ?? '');
  if (bedrooms) stats.push({ Icon: Building2, label: 'Bedrooms', value: bedrooms });

  const detection = (snapshot.report.property_detection ?? {}) as { is_multi_unit?: boolean; unit_count?: number };
  const effectiveCv = effectivePerUnitCv(prop.capital_value, {
    isMultiUnit: !!detection.is_multi_unit,
    unitCount: detection.unit_count,
  });
  const cvIsPerUnitEstimate = !!(detection.is_multi_unit && (detection.unit_count ?? 1) > 1 && effectiveCv !== prop.capital_value);
  const hideBuildingAreas = !!detection.is_multi_unit && (detection.unit_count ?? 1) > 1;

  if (effectiveCv) stats.push({
    Icon: Building2,
    label: cvIsPerUnitEstimate ? 'CV (per unit est.)' : 'Capital value',
    value: formatCurrency(effectiveCv),
  });
  if (prop.land_value && !hideBuildingAreas) stats.push({ Icon: TreePine, label: 'Land value', value: formatCurrency(prop.land_value) });
  if (prop.improvement_value && !hideBuildingAreas) stats.push({ Icon: Ruler, label: 'Improvements', value: formatCurrency(prop.improvement_value) });
  if (!hideBuildingAreas) {
    const floor = resolveFloorArea(prop, {
      isMultiUnit: !!report.property_detection?.is_multi_unit,
      titleType: prop.title_type,
    });
    if (floor) stats.push({ Icon: Ruler, label: floor.label, value: `${Math.round(floor.value).toLocaleString()} m²` });
  }
  if (prop.land_area_sqm && !hideBuildingAreas) stats.push({ Icon: TreePine, label: 'Land area', value: `${prop.land_area_sqm.toLocaleString()} m²` });

  const buildingUse = String(rawProp.building_use ?? '');
  if (buildingUse && buildingUse.toLowerCase() !== 'unknown') stats.push({ Icon: Building2, label: 'Use', value: buildingUse });
  const titleType = String(rawProp.title_type ?? '');
  const titleNo = String(rawProp.title_no ?? '');
  if (titleType && titleType.toLowerCase() !== 'unknown') stats.push({ Icon: Building2, label: 'Title', value: titleType });
  if (titleNo && persona === 'buyer') stats.push({ Icon: Building2, label: 'Title ref', value: titleNo });

  const estateDesc = String(rawProp.estate_description ?? '');
  const zoneName = String(rawPlan.zone_name ?? '');
  const zoneCategory = String(rawPlan.zone_category ?? '');
  const categoryRedundant = !zoneCategory || zoneCategory === zoneName || zoneName.toLowerCase().includes(zoneCategory.toLowerCase());
  const zoneDisplay = categoryRedundant ? zoneName : `${zoneName} (${zoneCategory})`;
  if (zoneName) stats.push({ Icon: MapPin, label: 'Zone', value: zoneDisplay });

  const transitStops = report.liveability?.transit_count;
  if (transitStops != null) stats.push({ Icon: Bus, label: 'Transit (400 m)', value: `${transitStops} stops` });
  const cbdDist = report.liveability?.cbd_distance_m;
  if (cbdDist) stats.push({ Icon: Navigation, label: 'To CBD', value: cbdDist >= 1000 ? `${(cbdDist / 1000).toFixed(1)} km` : `${Math.round(cbdDist)} m` });
  const noiseDb = report.environment?.noise_db;
  if (noiseDb) stats.push({ Icon: Volume2, label: 'Road noise', value: `${Math.round(noiseDb)} dB` });

  const walkScoreRaw = rawLive.walkability_score;
  const walkScore: number | undefined = typeof walkScoreRaw === 'number' ? walkScoreRaw : undefined;
  const walkLabel = walkScore != null ? (walkScore >= 90 ? "Walker's paradise" : walkScore >= 70 ? 'Very walkable' : walkScore >= 50 ? 'Somewhat walkable' : 'Car-dependent') : null;

  const insuranceFactors: string[] = [];
  if (hazards.tsunami_zone) insuranceFactors.push('Tsunami zone');
  if (isInFloodZone(hazards)) insuranceFactors.push('Flood zone');
  if (hazards.liquefaction_zone) insuranceFactors.push('Liquefaction');
  if (hazards.coastal_erosion) insuranceFactors.push('Coastal erosion');
  const insuranceLevel: 'Low' | 'Moderate' | 'High' = insuranceFactors.length === 0 ? 'Low' : insuranceFactors.length <= 2 ? 'Moderate' : 'High';
  const insuranceColour = insuranceLevel === 'Low' ? 'var(--ws-success)' : insuranceLevel === 'Moderate' ? 'var(--ws-warm)' : 'var(--ws-r-vhigh)';
  const insuranceBg = insuranceLevel === 'Low' ? 'rgba(45,106,79,.06)' : insuranceLevel === 'Moderate' ? 'rgba(212,134,59,.08)' : 'rgba(196,45,45,.06)';

  const trajectoryRaw = rawLive.trajectory as Record<string, unknown> | undefined;
  const trajectoryDir = String(trajectoryRaw?.direction ?? '');
  const trajectoryLabel = String(trajectoryRaw?.label ?? '');
  const areaProfile = report.area_profile;
  const medianRent = market?.rent_assessment?.median;
  const isMultiUnit = !!(report.property_detection?.is_multi_unit ?? rawProp.multi_unit);
  const cvDate = String(rawProp.cv_date ?? '');
  const isContaminated = !!(rawPlan.contaminated_listed ?? report.planning?.contamination_count);
  const isEpbListed = !!rawPlan.epb_listed;

  return (
    <Card>
      <CardHead title="Executive summary" />
      <div className="ws-card-body" style={{ display: 'grid', gap: 14 }}>
        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1,
          background: 'var(--ws-rule)',
          borderRadius: 'var(--ws-radius)',
          border: '1px solid var(--ws-rule)', overflow: 'hidden',
        }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              background: 'var(--ws-surface)', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start',
            }}>
              <span style={{ color: 'var(--ws-ink-mute)' }}><s.Icon size={13} /></span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ws-ink)', fontVariantNumeric: 'tabular-nums' }}>
                {s.value}
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: 'var(--ws-ink-mute)',
              }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Walkability + Insurance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {typeof walkScore === 'number' && (
            <div style={{
              border: '1px solid var(--ws-rule)', borderRadius: 'var(--ws-radius-sm)',
              padding: 12, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg viewBox="0 0 60 60" width={56} height={56}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="var(--ws-rule)" strokeWidth="4" />
                <circle cx="30" cy="30" r="26" fill="none" stroke="var(--ws-piq)" strokeWidth="4"
                  strokeDasharray={`${(walkScore / 100) * 163.4} 163.4`}
                  strokeLinecap="round" transform="rotate(-90 30 30)" />
                <text x="30" y="34" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--ws-piq-dark)">
                  {walkScore}
                </text>
              </svg>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--ws-ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  <Footprints size={11} /> Walkability
                </p>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ws-piq-dark)' }}>{walkLabel}</p>
              </div>
            </div>
          )}

          <div style={{
            border: `1px solid ${insuranceColour}`, background: insuranceBg,
            borderRadius: 'var(--ws-radius-sm)', padding: 12,
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--ws-ink-mute)', display: 'inline-flex', alignItems: 'center', gap: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Shield size={11} /> Insurance risk
            </p>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: insuranceColour }}>{insuranceLevel}</p>
            {insuranceFactors.length > 0 && (
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ws-ink-soft)' }}>
                May face excess or exclusions for {insuranceFactors.join(', ').toLowerCase()}.
              </p>
            )}
          </div>
        </div>

        {/* Property flags (buyer) */}
        {persona === 'buyer' && (isMultiUnit || cvDate || isContaminated) && (
          <div style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--ws-ink-soft)' }}>
            {isMultiUnit && <p style={{ margin: 0 }}><strong style={{ color: 'var(--ws-ink)' }}>Multi-unit building.</strong> Check body corporate rules, levies, and long-term maintenance plan.</p>}
            {isContaminated && <p style={{ margin: 0, color: 'var(--ws-r-high)', fontWeight: 500 }}>This property is on the contaminated land register. Get a Phase 1 Environmental Site Assessment.</p>}
            {cvDate && <p style={{ margin: 0 }}>Council valuation date: {new Date(cvDate).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' })}.</p>}
          </div>
        )}

        {/* EPB alert */}
        {isEpbListed && (
          <div style={{
            border: '1px solid rgba(196,45,45,.30)', background: 'rgba(196,45,45,.06)',
            borderRadius: 'var(--ws-radius-sm)', padding: 12,
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--ws-r-vhigh)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ws-r-vhigh)' }}>
                This property is on the Earthquake-Prone Buildings register
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ws-r-vhigh)', opacity: 0.85 }}>
                Check MBIE EPB register for remediation timeline.
              </p>
            </div>
          </div>
        )}

        {/* Trajectory */}
        {trajectoryDir && (
          <div style={{
            border: '1px solid var(--ws-rule)', background: 'var(--ws-bg-2)',
            borderRadius: 'var(--ws-radius-sm)', padding: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{
              fontSize: 18,
              color: trajectoryDir === 'improving' ? 'var(--ws-success)'
                  : trajectoryDir === 'declining' ? 'var(--ws-r-vhigh)'
                                                  : 'var(--ws-warm)',
            }}>
              {trajectoryDir === 'improving' ? '↑' : trajectoryDir === 'declining' ? '↓' : '→'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ws-ink)' }}>
              <strong>Neighbourhood is {trajectoryDir}</strong>
              {trajectoryLabel && <span style={{ color: 'var(--ws-ink-mute)' }}>. {trajectoryLabel}</span>}
            </span>
          </div>
        )}

        {/* Rent context */}
        {persona === 'renter' && rentBand?.baseline && rentBand.bandLow > 0 && (
          <div style={{
            border: '1px solid var(--ws-rule)', background: 'rgba(13,115,119,.05)',
            borderRadius: 'var(--ws-radius-sm)', padding: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              <span style={{ color: 'var(--ws-ink-mute)' }}>Fair rent for a {storeBedrooms ?? ''}-bed here: </span>
              <strong style={{ color: 'var(--ws-piq-dark)' }}>${rentBand.bandLow}-${rentBand.bandHigh}/wk</strong>
              {market?.trend?.cagr_1yr != null && (
                <span style={{
                  marginLeft: 8, fontSize: 11.5, fontWeight: 500,
                  color: market.trend.cagr_1yr >= 0 ? 'var(--ws-warm)' : 'var(--ws-success)',
                }}>
                  {market.trend.cagr_1yr >= 0 ? '+' : ''}{market.trend.cagr_1yr.toFixed(1)}%/yr
                </span>
              )}
            </p>
            {medianRent && (
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
                Area all-sizes median: ${medianRent}/wk · {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}.
              </p>
            )}
          </div>
        )}
        {persona === 'buyer' && rentBand?.baseline && rentBand.bandLow > 0 && (
          <div style={{
            border: '1px solid var(--ws-rule)', background: 'rgba(13,115,119,.05)',
            borderRadius: 'var(--ws-radius-sm)', padding: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              <span style={{ color: 'var(--ws-ink-mute)' }}>Market rent estimate: </span>
              <strong style={{ color: 'var(--ws-piq-dark)' }}>${rentBand.bandLow}-${rentBand.bandHigh}/wk</strong>
              <span style={{ color: 'var(--ws-ink-mute)' }}> ({formatCurrency(Math.round((rentBand.bandLow + rentBand.bandHigh) / 2 * 52))}/yr)</span>
              {market?.trend?.cagr_1yr != null && (
                <span style={{
                  marginLeft: 8, fontSize: 11.5, fontWeight: 500,
                  color: market.trend.cagr_1yr >= 0 ? 'var(--ws-warm)' : 'var(--ws-success)',
                }}>
                  {market.trend.cagr_1yr >= 0 ? '+' : ''}{market.trend.cagr_1yr.toFixed(1)}%/yr
                </span>
              )}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
              For {storeBedrooms ?? '2'}-bed {snapshot.meta.dwelling_type.toLowerCase()} · {rentBand.baseline.bond_count} recent bonds in {snapshot.meta.sa2_name}.
            </p>
          </div>
        )}

        {/* Area profile */}
        {areaProfile && (
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)' }}>
              About {snapshot.meta.sa2_name}
            </h4>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ws-ink-soft)', lineHeight: 1.6 }}>
              {areaProfile}
            </p>
          </div>
        )}

        {/* Estate description */}
        {estateDesc && (
          <details style={{ fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>Title &amp; estate details</summary>
            <p style={{ margin: '6px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, monospace', lineHeight: 1.55, wordBreak: 'break-word' }}>
              {estateDesc}
            </p>
          </details>
        )}
      </div>
    </Card>
  );
}

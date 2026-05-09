'use client';

import { Building2, Map, Activity, Wind, Eye, Tag, FileText, TreePine, Trees } from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import { Card, CardHead, LayerRow, type PillTone } from '@/components/new/ui/primitives';

interface Row {
  icon: React.ReactNode;
  name: string;
  source: string;
  tone: PillTone;
  label: string;
}

/**
 * Risk + planning layers ledger. Derives 8-12 rows from the transformed
 * shapes (HazardData, PlanningData, LiveabilityData, EnvironmentData).
 */
export function DataLayersNew({ report }: { report: PropertyReport }) {
  const haz = report.hazards;
  const plan = report.planning;
  const live = report.liveability;
  const cov = report.coverage;

  const rows: Row[] = [];

  if (typeof haz.epb_count === 'number') {
    rows.push({
      icon: <Building2 size={14} />,
      name: 'EPB register, 300 m',
      source: `MBIE EPB · ${haz.epb_count} within 300 m`,
      tone: haz.epb_count >= 5 ? 'crit' : haz.epb_count > 0 ? 'high' : 'low',
      label: haz.epb_count >= 5 ? 'Cluster' : haz.epb_count > 0 ? 'Some' : 'Clear',
    });
  }

  if (haz.flood_zone) {
    rows.push({
      icon: <Map size={14} />,
      name: 'Flood overlay',
      source: `Council Stormwater · ${haz.flood_zone}`,
      tone: 'high',
      label: 'Applies',
    });
  }

  if (haz.liquefaction_zone) {
    rows.push({
      icon: <Activity size={14} />,
      name: 'Liquefaction',
      source: `GNS Science · ${haz.liquefaction_zone}`,
      tone: /high/i.test(haz.liquefaction_zone) ? 'high' : 'mod',
      label: haz.liquefaction_zone,
    });
  }

  if (haz.tsunami_zone) {
    rows.push({
      icon: <Wind size={14} />,
      name: 'Tsunami zone',
      source: `NEMA · ${haz.tsunami_zone}`,
      tone: 'mod',
      label: 'Zone',
    });
  }

  if (typeof haz.earthquake_count === 'number' && haz.earthquake_count > 0) {
    rows.push({
      icon: <Activity size={14} />,
      name: 'Earthquake activity',
      source: `GNS · ${haz.earthquake_count} within 30 km, last 10 yr${haz.earthquake_max_mag != null ? `, max M${haz.earthquake_max_mag}` : ''}`,
      tone: haz.earthquake_count >= 10 ? 'high' : 'mod',
      label: `${haz.earthquake_count} events`,
    });
  }

  if (haz.wildfire_risk) {
    rows.push({
      icon: <Wind size={14} />,
      name: 'Wildfire risk',
      source: `BRANZ / DOC · ${haz.wildfire_risk}`,
      tone: /high|extreme/i.test(haz.wildfire_risk) ? 'high' : 'mod',
      label: haz.wildfire_risk,
    });
  }

  if (typeof live.crime_rate === 'number') {
    rows.push({
      icon: <Eye size={14} />,
      name: 'Crime rate',
      source: `NZ Police · ${live.crime_rate.toFixed(1)} victimisations / 10k`,
      tone: live.crime_rate >= 200 ? 'high' : live.crime_rate >= 100 ? 'mod' : 'low',
      label: live.crime_rate >= 200 ? 'Elevated' : live.crime_rate >= 100 ? 'Mid' : 'Low',
    });
  }

  if (plan.zone_name) {
    rows.push({
      icon: <Tag size={14} />,
      name: 'Zone',
      source: `District plan · ${plan.zone_name}${plan.height_limit ? `, ${plan.height_limit} m height` : ''}`,
      tone: 'mod',
      label: plan.zone_category ?? 'Zone',
    });
  }

  if (plan.in_special_character_area) {
    rows.push({
      icon: <Tag size={14} />,
      name: 'Special character overlay',
      source: 'Council overlay · in special character zone',
      tone: 'mod',
      label: 'Applies',
    });
  }

  if (typeof plan.heritage_count === 'number') {
    rows.push({
      icon: <Tag size={14} />,
      name: 'Heritage overlays',
      source: `Council · ${plan.heritage_count} features within 500 m`,
      tone: plan.heritage_count > 0 ? 'mod' : 'low',
      label: plan.heritage_count > 0 ? 'Nearby' : 'Clear',
    });
  }

  if (typeof plan.contamination_count === 'number') {
    rows.push({
      icon: <FileText size={14} />,
      name: 'Contaminated land',
      source: `Council HAIL · ${plan.contamination_count} within 2 km`,
      tone: plan.contamination_count > 0 ? 'high' : 'low',
      label: plan.contamination_count > 0 ? `${plan.contamination_count} listed` : 'Clear',
    });
  }

  if (typeof plan.consent_count === 'number') {
    rows.push({
      icon: <FileText size={14} />,
      name: 'Resource consents 500 m / 2 yr',
      source: `Council consents · ${plan.consent_count} lodged`,
      tone: plan.consent_count > 5 ? 'mod' : 'low',
      label: plan.consent_count > 5 ? 'Active' : 'Quiet',
    });
  }

  if (plan.in_viewshaft) {
    rows.push({
      icon: <TreePine size={14} />,
      name: 'Viewshaft',
      source: `Council viewshafts · ${plan.viewshaft_name ?? 'in viewshaft'}`,
      tone: 'high',
      label: 'Applies',
    });
  }

  if (typeof plan.infrastructure_count === 'number' && plan.infrastructure_count > 0) {
    rows.push({
      icon: <Trees size={14} />,
      name: 'Infrastructure pipeline',
      source: `National Infrastructure Pipeline · ${plan.infrastructure_count} projects within 5 km`,
      tone: 'mod',
      label: `${plan.infrastructure_count} projects`,
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHead title="Risk and planning layers" />
        <div className="ws-card-body">
          <p style={{ margin: 0, color: 'var(--ws-ink-soft)' }}>
            No layer data available for this address yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHead
        title="Risk and planning layers"
        meta={cov ? `${cov.available}/${cov.total} available` : undefined}
      />
      <div className="ws-card-body">
        {rows.map((r, i) => (
          <LayerRow key={i} icon={r.icon} name={r.name} source={r.source} pillTone={r.tone} pillLabel={r.label} />
        ))}
      </div>
    </Card>
  );
}

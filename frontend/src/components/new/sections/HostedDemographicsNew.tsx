'use client';

import { Users, Home, Car, Wifi, DollarSign, Briefcase, TrendingUp } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';
import { Card, CardHead } from '@/components/new/ui/primitives';

interface Props { snapshot: ReportSnapshot; isFull?: boolean }

function pct(num: number | null | undefined, total: number | null | undefined): string {
  if (!num || !total || total === 0) return '–';
  return `${Math.round((num / total) * 100)}%`;
}
function fmt(n: number | null | undefined): string {
  if (n == null) return '–';
  return n.toLocaleString();
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderTop: '1px solid var(--ws-rule)',
    }}>
      <span style={{ fontSize: 12.5, color: 'var(--ws-ink-soft)' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ws-ink)' }}>{value}</span>
    </div>
  );
}

function Bars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--ws-ink-mute)', minWidth: 64, textAlign: 'right' }}>{label}</span>
          <div style={{ flex: 1, background: 'var(--ws-bg-2)', borderRadius: 999, height: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.max((value / max) * 100, 2)}%` }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ws-ink)', minWidth: 36 }}>{value}%</span>
        </div>
      ))}
    </div>
  );
}

export function HostedDemographicsNew({ snapshot, isFull = false }: Props) {
  const demo = snapshot.census_demographics;
  const hh = snapshot.census_households;
  const commute = snapshot.census_commute;
  const biz = (snapshot as unknown as Record<string, unknown>).business_demography as {
    employee_count_2024: number | null;
    employee_growth_pct: number | null;
    business_count_2024: number | null;
  } | null;

  if (!demo && !hh) return null;
  const areaName = demo?.sa2_name || hh?.sa2_name || 'this area';
  const popChange = demo?.population_2018 && demo?.population_2023
    ? Math.round(((demo.population_2023 - demo.population_2018) / demo.population_2018) * 100)
    : null;

  // Commute modes
  const commuteTotal = commute?.total_stated || 0;
  const commuteRaw = commuteTotal > 0 ? [
    { label: 'Drive', value: Math.round(((commute?.drive_private || 0) + (commute?.drive_company || 0)) / commuteTotal * 100), color: '#56B4E9' },
    { label: 'WFH',   value: Math.round((commute?.work_at_home || 0) / commuteTotal * 100), color: '#2D6A4F' },
    { label: 'Bus',   value: Math.round((commute?.public_bus || 0) / commuteTotal * 100), color: '#E69F00' },
    { label: 'Walk',  value: Math.round((commute?.walk_or_jog || 0) / commuteTotal * 100), color: 'oklch(0.55 0.18 290)' },
    { label: 'Train', value: Math.round((commute?.train || 0) / commuteTotal * 100), color: '#C42D2D' },
    { label: 'Cycle', value: Math.round((commute?.bicycle || 0) / commuteTotal * 100), color: '#0D7377' },
  ] : [];
  const sum = commuteRaw.reduce((a, m) => a + m.value, 0);
  const otherPct = commuteTotal > 0 ? Math.max(0, 100 - sum) : 0;
  const commuteModes = commuteRaw.filter((m) => m.value > 0);
  if (otherPct > 0) commuteModes.push({ label: 'Other', value: otherPct, color: 'var(--ws-ink-mute)' });

  // Ethnicity
  const ethTotal = demo?.ethnicity_total || 0;
  const ethnicity = ethTotal > 0 ? [
    { label: 'European', value: Math.round((demo?.ethnicity_european || 0) / ethTotal * 100), color: '#56B4E9' },
    { label: 'Maori',    value: Math.round((demo?.ethnicity_maori || 0) / ethTotal * 100),    color: '#2D6A4F' },
    { label: 'Asian',    value: Math.round((demo?.ethnicity_asian || 0) / ethTotal * 100),    color: '#D4863B' },
    { label: 'Pacific',  value: Math.round((demo?.ethnicity_pacific || 0) / ethTotal * 100),  color: 'oklch(0.55 0.18 290)' },
    { label: 'MELAA',    value: Math.round((demo?.ethnicity_melaa || 0) / ethTotal * 100),    color: '#C42D2D' },
  ].filter((e) => e.value > 0) : [];

  // Income brackets
  const incomeTotal = hh ? (
    (hh.income_under_20k || 0) + (hh.income_20k_30k || 0) + (hh.income_30k_50k || 0) +
    (hh.income_50k_70k || 0) + (hh.income_70k_100k || 0) + (hh.income_100k_150k || 0) +
    (hh.income_150k_200k || 0) + (hh.income_200k_plus || 0)
  ) : 0;
  const incomeBars = incomeTotal > 0 ? [
    { label: '<$30k',    value: Math.round(((hh?.income_under_20k || 0) + (hh?.income_20k_30k || 0)) / incomeTotal * 100), color: '#C42D2D' },
    { label: '$30-70k',  value: Math.round(((hh?.income_30k_50k || 0) + (hh?.income_50k_70k || 0)) / incomeTotal * 100),    color: '#E69F00' },
    { label: '$70-150k', value: Math.round(((hh?.income_70k_100k || 0) + (hh?.income_100k_150k || 0)) / incomeTotal * 100), color: '#2D6A4F' },
    { label: '$150k+',   value: Math.round(((hh?.income_150k_200k || 0) + (hh?.income_200k_plus || 0)) / incomeTotal * 100), color: '#0D7377' },
  ] : [];

  return (
    <Card>
      <CardHead title="Area demographics" meta={`Census 2023 · ${areaName}`} />
      <div className="ws-card-body" style={{ display: 'grid', gap: 16 }}>
        {/* Population & age */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Stat fg="oklch(0.45 0.16 290)" bg="rgba(99,89,233,.08)" value={fmt(demo?.population_2023)} label="Population" sub={popChange != null ? `${popChange >= 0 ? '+' : ''}${popChange}% since 2018` : undefined} subColor={popChange != null ? (popChange >= 0 ? 'var(--ws-success)' : 'var(--ws-r-vhigh)') : undefined} />
          <Stat fg="oklch(0.45 0.13 75)"  bg="rgba(212,134,59,.10)" value={demo?.median_age?.toString() ?? '–'} label="Median age" sub={demo?.population_2023 && demo.age_65_plus != null ? `${pct(demo.age_65_plus, demo.population_2023)} aged 65+` : undefined} />
        </div>

        {commuteModes.length > 0 && (
          <div>
            <h4 style={subHeading}><Briefcase size={12} /> How people commute</h4>
            <Bars items={commuteModes} />
          </div>
        )}

        {biz && biz.employee_count_2024 != null && (
          <div>
            <h4 style={subHeading}><TrendingUp size={12} /> Local economy</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <Stat fg="var(--ws-r-low)" bg="rgba(86,180,233,.10)" value={fmt(biz.employee_count_2024)} label="Jobs in area" />
              <Stat fg="oklch(0.50 0.16 290)" bg="rgba(99,89,233,.08)" value={fmt(biz.business_count_2024)} label="Businesses" />
              <Stat
                fg={(biz.employee_growth_pct ?? 0) >= 0 ? 'var(--ws-success)' : 'var(--ws-r-vhigh)'}
                bg={(biz.employee_growth_pct ?? 0) >= 0 ? 'rgba(45,106,79,.08)' : 'rgba(196,45,45,.06)'}
                value={`${(biz.employee_growth_pct ?? 0) >= 0 ? '+' : ''}${biz.employee_growth_pct?.toFixed(1) ?? '–'}%`}
                label="Job growth/yr"
              />
            </div>
          </div>
        )}

        {isFull && hh?.income_median && (
          <div>
            <h4 style={subHeading}><DollarSign size={12} /> Household income</h4>
            <div style={{
              background: 'rgba(45,106,79,.08)', borderRadius: 'var(--ws-radius-sm)',
              padding: '10px 12px', textAlign: 'center', marginBottom: 10,
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ws-success)', fontVariantNumeric: 'tabular-nums' }}>
                ${fmt(hh.income_median)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ws-success)', opacity: 0.85 }}>Median household income</div>
            </div>
            {incomeBars.length > 0 && <Bars items={incomeBars} />}
          </div>
        )}

        {isFull && hh && (
          <div>
            <h4 style={subHeading}><Home size={12} /> Housing &amp; tenure</h4>
            <div>
              <StatRow label="Homeownership rate" value={pct(hh.tenure_owned, hh.tenure_total)} />
              <StatRow label="Renting" value={pct(hh.tenure_not_owned, hh.tenure_total)} />
              <StatRow label="Family trust" value={pct(hh.tenure_family_trust, hh.tenure_total)} />
              {hh.rent_median && <StatRow label="Census median (2023)" value={`$${hh.rent_median}/wk`} />}
              {hh.hh_crowded != null && hh.hh_total && <StatRow label="Crowded households" value={pct(hh.hh_crowded, hh.hh_total)} />}
              <StatRow label="Single-person households" value={pct(hh.hh_one_person, hh.hh_total)} />
              {hh.landlord_total && hh.landlord_kainga_ora != null && (
                <StatRow label="Kainga Ora tenants" value={pct(hh.landlord_kainga_ora, hh.landlord_total)} />
              )}
            </div>
          </div>
        )}

        {isFull && hh && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {hh.internet_access != null && hh.internet_total && (
              <div style={connectivityBox} className="">
                <Wifi size={14} style={{ color: 'var(--ws-r-low)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ws-r-low)' }}>{pct(hh.internet_access, hh.internet_total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ws-r-low)', opacity: 0.85 }}>Internet access</div>
                </div>
              </div>
            )}
            {hh.vehicles_none != null && hh.vehicles_total && (
              <div style={{ ...connectivityBox, background: 'var(--ws-bg-2)' }}>
                <Car size={14} style={{ color: 'var(--ws-ink-mute)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ws-ink)' }}>{pct(hh.vehicles_none, hh.vehicles_total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ws-ink-mute)' }}>No vehicle</div>
                </div>
              </div>
            )}
          </div>
        )}

        {isFull && ethnicity.length > 0 && (
          <div>
            <h4 style={subHeading}>Ethnic composition</h4>
            <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>People may identify with multiple ethnicities.</p>
            <Bars items={ethnicity} />
            {demo?.born_overseas != null && demo?.born_nz != null && (
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
                {pct(demo.born_overseas, demo.born_nz + demo.born_overseas)} born overseas.
              </p>
            )}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ws-ink-mute)' }}>
          Source: Stats NZ Census 2023 (latest available). CC BY 4.0.
        </p>
      </div>
    </Card>
  );
}

function Stat({ fg, bg, value, label, sub, subColor }: {
  fg: string; bg: string; value: string; label: string; sub?: string; subColor?: string;
}) {
  return (
    <div style={{
      background: bg, borderRadius: 'var(--ws-radius-sm)',
      padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: fg, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11, color: fg, opacity: 0.85 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 2, color: subColor ?? 'var(--ws-ink-mute)' }}>{sub}</div>}
    </div>
  );
}

const subHeading: React.CSSProperties = {
  margin: '0 0 8px', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ws-ink-mute)',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const connectivityBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(86,180,233,.08)', borderRadius: 'var(--ws-radius-sm)',
  padding: '8px 12px', flex: 1, minWidth: 140,
};

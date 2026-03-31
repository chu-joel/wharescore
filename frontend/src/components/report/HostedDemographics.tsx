'use client';

import { Users, Home, Car, Wifi, DollarSign, Briefcase, TrendingUp } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
  isFull?: boolean;
}

function pct(num: number | null, total: number | null): string {
  if (!num || !total || total === 0) return '-';
  return `${Math.round((num / total) * 100)}%`;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '-';
  return n.toLocaleString();
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">
        {value}
        {sub && <span className="text-xs text-muted-foreground/70 ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function BarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-1.5">
      {items.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{label}</span>
          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-foreground w-10 shrink-0">{value}%</span>
        </div>
      ))}
    </div>
  );
}

export function HostedDemographics({ snapshot, isFull = false }: Props) {
  const demo = snapshot.census_demographics;
  const hh = snapshot.census_households;
  const commute = snapshot.census_commute;
  const biz = (snapshot as unknown as Record<string, unknown>).business_demography as {
    employee_count_2024: number | null;
    employee_count_2019: number | null;
    employee_growth_pct: number | null;
    business_count_2024: number | null;
    business_growth_pct: number | null;
  } | null;

  if (!demo && !hh) return null;

  const areaName = demo?.sa2_name || hh?.sa2_name || 'this area';
  const popChange = demo?.population_2018 && demo?.population_2023
    ? Math.round(((demo.population_2023 - demo.population_2018) / demo.population_2018) * 100)
    : null;

  // Commute mode percentages
  const commuteTotal = commute?.total_stated || 0;
  const commuteModes = commuteTotal > 0 ? [
    { label: 'Drive', value: Math.round(((commute?.drive_private || 0) + (commute?.drive_company || 0)) / commuteTotal * 100), color: 'bg-blue-400' },
    { label: 'WFH', value: Math.round((commute?.work_at_home || 0) / commuteTotal * 100), color: 'bg-green-400' },
    { label: 'Bus', value: Math.round((commute?.public_bus || 0) / commuteTotal * 100), color: 'bg-yellow-400' },
    { label: 'Walk', value: Math.round((commute?.walk_or_jog || 0) / commuteTotal * 100), color: 'bg-purple-400' },
    { label: 'Train', value: Math.round((commute?.train || 0) / commuteTotal * 100), color: 'bg-red-400' },
    { label: 'Cycle', value: Math.round((commute?.bicycle || 0) / commuteTotal * 100), color: 'bg-teal-400' },
  ].filter(m => m.value > 0) : [];

  // Ethnicity breakdown
  const ethTotal = demo?.ethnicity_total || 0;
  const ethnicityBars = ethTotal > 0 ? [
    { label: 'European', value: Math.round((demo?.ethnicity_european || 0) / ethTotal * 100), color: 'bg-blue-300' },
    { label: 'Maori', value: Math.round((demo?.ethnicity_maori || 0) / ethTotal * 100), color: 'bg-emerald-400' },
    { label: 'Asian', value: Math.round((demo?.ethnicity_asian || 0) / ethTotal * 100), color: 'bg-amber-400' },
    { label: 'Pacific', value: Math.round((demo?.ethnicity_pacific || 0) / ethTotal * 100), color: 'bg-violet-400' },
    { label: 'MELAA', value: Math.round((demo?.ethnicity_melaa || 0) / ethTotal * 100), color: 'bg-rose-300' },
  ].filter(e => e.value > 0) : [];

  // Income brackets for bar chart
  const incomeTotal = hh ? (
    (hh.income_under_20k || 0) + (hh.income_20k_30k || 0) + (hh.income_30k_50k || 0) +
    (hh.income_50k_70k || 0) + (hh.income_70k_100k || 0) + (hh.income_100k_150k || 0) +
    (hh.income_150k_200k || 0) + (hh.income_200k_plus || 0)
  ) : 0;
  const incomeBars = incomeTotal > 0 ? [
    { label: '<$30k', value: Math.round(((hh?.income_under_20k || 0) + (hh?.income_20k_30k || 0)) / incomeTotal * 100), color: 'bg-red-300' },
    { label: '$30-70k', value: Math.round(((hh?.income_30k_50k || 0) + (hh?.income_50k_70k || 0)) / incomeTotal * 100), color: 'bg-amber-300' },
    { label: '$70-150k', value: Math.round(((hh?.income_70k_100k || 0) + (hh?.income_100k_150k || 0)) / incomeTotal * 100), color: 'bg-green-300' },
    { label: '$150k+', value: Math.round(((hh?.income_150k_200k || 0) + (hh?.income_200k_plus || 0)) / incomeTotal * 100), color: 'bg-emerald-400' },
  ] : [];

  return (
    <section id="demographics" className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/50">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          Area Demographics
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Census 2023 data for {areaName}</p>
      </div>

      <div className="p-5 space-y-6">
        {/* Population & Age — always shown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{fmt(demo?.population_2023)}</div>
            <div className="text-xs text-indigo-600">Population</div>
            {popChange !== null && (
              <div className={`text-xs mt-0.5 ${popChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {popChange >= 0 ? '+' : ''}{popChange}% since 2018
              </div>
            )}
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{demo?.median_age ?? '-'}</div>
            <div className="text-xs text-amber-600">Median Age</div>
            {demo?.population_2023 && demo.age_65_plus != null && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {pct(demo.age_65_plus, demo.population_2023)} aged 65+
              </div>
            )}
          </div>
        </div>

        {/* Commute — always shown (good hook) */}
        {commuteModes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-muted-foreground/70" />
              How People Commute
            </h3>
            <BarChart items={commuteModes} />
          </div>
        )}

        {/* Local Economy — always shown */}
        {biz && biz.employee_count_2024 != null && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-muted-foreground/70" />
              Local Economy
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-blue-700">{fmt(biz.employee_count_2024)}</div>
                <div className="text-[10px] text-blue-500">Jobs in area</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2.5 text-center">
                <div className="text-lg font-bold text-purple-700">{fmt(biz.business_count_2024)}</div>
                <div className="text-[10px] text-purple-500">Businesses</div>
              </div>
              <div className={`rounded-lg p-2.5 text-center ${(biz.employee_growth_pct ?? 0) >= 0 ? 'bg-green-50 dark:bg-green-950/30 dark:bg-green-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                <div className={`text-lg font-bold ${(biz.employee_growth_pct ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {(biz.employee_growth_pct ?? 0) >= 0 ? '+' : ''}{biz.employee_growth_pct?.toFixed(1) ?? '-'}%
                </div>
                <div className="text-[10px] text-muted-foreground">Job growth/yr</div>
              </div>
            </div>
          </div>
        )}

        {/* Household income — Full only */}
        {isFull && hh?.income_median && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-muted-foreground/70" />
              Household Income
            </h3>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center mb-3">
              <div className="text-2xl font-bold text-green-700">${fmt(hh.income_median)}</div>
              <div className="text-xs text-green-600">Median Household Income</div>
            </div>
            {incomeBars.length > 0 && <BarChart items={incomeBars} />}
          </div>
        )}

        {/* Tenure & Housing — Full only */}
        {isFull && hh && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-muted-foreground/70" />
              Housing & Tenure
            </h3>
            <div className="space-y-0">
              <StatRow label="Homeownership rate" value={pct(hh.tenure_owned, hh.tenure_total)} />
              <StatRow label="Renting" value={pct(hh.tenure_not_owned, hh.tenure_total)} />
              <StatRow label="Family trust" value={pct(hh.tenure_family_trust, hh.tenure_total)} />
              {hh.rent_median && <StatRow label="Census median rent" value={`$${hh.rent_median}/wk`} />}
              {hh.hh_crowded != null && hh.hh_total && (
                <StatRow label="Crowded households" value={pct(hh.hh_crowded, hh.hh_total)} />
              )}
              <StatRow label="Single-person households" value={pct(hh.hh_one_person, hh.hh_total)} />
              {hh.landlord_total && hh.landlord_kainga_ora != null && (
                <StatRow label="Kainga Ora tenants" value={pct(hh.landlord_kainga_ora, hh.landlord_total)} />
              )}
            </div>
          </div>
        )}

        {/* Connectivity — Full only */}
        {isFull && hh && (
          <div className="flex gap-4">
            {hh.internet_access != null && hh.internet_total && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2 flex-1">
                <Wifi className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-sm font-medium text-blue-700">{pct(hh.internet_access, hh.internet_total)}</div>
                  <div className="text-xs text-blue-600">Internet access</div>
                </div>
              </div>
            )}
            {hh.vehicles_none != null && hh.vehicles_total && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 flex-1">
                <Car className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">{pct(hh.vehicles_none, hh.vehicles_total)}</div>
                  <div className="text-xs text-muted-foreground">No vehicle</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ethnicity — Full only */}
        {isFull && ethnicityBars.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Ethnic Composition</h3>
            <p className="text-xs text-muted-foreground/70 mb-2">People may identify with multiple ethnicities</p>
            <BarChart items={ethnicityBars} />
            {demo?.born_overseas != null && demo?.born_nz != null && (
              <div className="text-xs text-muted-foreground mt-2">
                {pct(demo.born_overseas, demo.born_nz + demo.born_overseas)} born overseas
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-2 bg-muted/50 border-t border-border">
        <p className="text-[10px] text-muted-foreground/70">Source: Stats NZ Census 2023. CC BY 4.0.</p>
      </div>
    </section>
  );
}

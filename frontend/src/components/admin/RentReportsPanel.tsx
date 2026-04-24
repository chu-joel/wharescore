'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminRentReports } from '@/hooks/useAdminRentReports';
import {
  HandCoins, MapPin, Bed, Bath, Home, Layers, AlertTriangle, Users,
} from 'lucide-react';

/**
 * Rent-reports admin panel. Three purposes:
 *
 *   1. Data-volume view. How many reports total, growth over 7/30 days,
 *      distinct contributors and addresses. Tells us whether the flow
 *      is working at the funnel level — if submissions are flat after a
 *      UX change, that's visible here.
 *
 *   2. Coverage view. Which cities / bedrooms / bathrooms / dwelling
 *      types have enough data to surface community medians (>= 3
 *      non-outlier reports per cell) and which are still thin. Medians
 *      per cell give a sanity check that we're not capturing garbage.
 *
 *   3. Form-quality view. How often users fill in the richer fields
 *      (bathrooms, finish, parking, etc.) vs just submitting the core
 *      trio. If the rich fields are rarely populated the RentAdvisorCard
 *      UX probably needs attention.
 */

function Stat({ label, value, icon: Icon, sub }: {
  label: string; value: number | string; icon: React.ElementType; sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md p-2 bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

export function RentReportsPanel() {
  const { data, isLoading } = useAdminRentReports();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Compute completeness percentages relative to the total.
  const comp = data.completeness;
  const completenessRows: { label: string; value: number; pct: number }[] = comp.total > 0
    ? [
        { label: 'Bathrooms', value: comp.has_bathrooms, pct: Math.round(100 * comp.has_bathrooms / comp.total) },
        { label: 'Finish tier', value: comp.has_finish_tier, pct: Math.round(100 * comp.has_finish_tier / comp.total) },
        { label: 'Parking noted', value: comp.has_parking, pct: Math.round(100 * comp.has_parking / comp.total) },
        { label: 'Furnishing noted', value: comp.has_furnished, pct: Math.round(100 * comp.has_furnished / comp.total) },
        { label: 'Outdoor space', value: comp.has_outdoor_space, pct: Math.round(100 * comp.has_outdoor_space / comp.total) },
        { label: 'Character property', value: comp.has_character, pct: Math.round(100 * comp.has_character / comp.total) },
        { label: 'Utilities', value: comp.has_utilities, pct: Math.round(100 * comp.has_utilities / comp.total) },
        { label: 'Insulation noted', value: comp.has_insulation_note, pct: Math.round(100 * comp.has_insulation_note / comp.total) },
      ]
    : [];

  const outlierPct = data.total > 0 ? Math.round(100 * data.outliers / data.total) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HandCoins className="h-5 w-5" /> Rent reports
        </h2>
        <p className="text-sm text-muted-foreground">
          Crowd-sourced rent submissions from the RentComparisonFlow and
          RentAdvisorCard on property reports.
        </p>
      </div>

      {/* Volume stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total reports" value={data.total.toLocaleString()} icon={HandCoins} />
        <Stat label="Last 7 days" value={data.last_7d.toLocaleString()} icon={HandCoins} />
        <Stat label="Last 30 days" value={data.last_30d.toLocaleString()} icon={HandCoins} />
        <Stat
          label="Outliers"
          value={`${data.outliers} (${outlierPct}%)`}
          icon={AlertTriangle}
          sub={outlierPct > 10 ? 'High — investigate validation' : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Distinct addresses" value={data.distinct_addresses.toLocaleString()} icon={MapPin} />
        <Stat label="Distinct SA2s" value={data.distinct_sa2s.toLocaleString()} icon={MapPin} />
        <Stat label="Distinct contributors" value={data.distinct_contributors.toLocaleString()} icon={Users} sub="by hashed IP" />
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* By city */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Reports by city</h3>
            <span className="ml-auto text-xs text-muted-foreground">excl. outliers · top 20</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">City</th>
                <th className="pb-1 font-medium text-right">Reports</th>
                <th className="pb-1 font-medium text-right">Addresses</th>
                <th className="pb-1 font-medium text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {data.by_city.length > 0 ? data.by_city.map((c) => (
                <tr key={c.city} className="border-t border-border">
                  <td className="py-1.5">{c.city}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.reports}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{c.distinct_addresses}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.median_rent ? `$${c.median_rent}` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* By bedrooms */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By bedrooms</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Bedrooms</th>
                <th className="pb-1 font-medium text-right">Reports</th>
                <th className="pb-1 font-medium text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {data.by_bedrooms.length > 0 ? data.by_bedrooms.map((b) => (
                <tr key={b.bedrooms} className="border-t border-border">
                  <td className="py-1.5">{b.bedrooms}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.median_rent ? `$${b.median_rent}` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* By dwelling type */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Home className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By dwelling type</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Type</th>
                <th className="pb-1 font-medium text-right">Reports</th>
                <th className="pb-1 font-medium text-right">Median</th>
              </tr>
            </thead>
            <tbody>
              {data.by_dwelling_type.length > 0 ? data.by_dwelling_type.map((d) => (
                <tr key={d.dwelling_type} className="border-t border-border">
                  <td className="py-1.5">{d.dwelling_type}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.median_rent ? `$${d.median_rent}` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By bathrooms */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By bathrooms</h3>
            <span className="ml-auto text-xs text-muted-foreground">when filled in</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Bathrooms</th>
                <th className="pb-1 font-medium text-right">Reports</th>
                <th className="pb-1 font-medium text-right">Median rent</th>
              </tr>
            </thead>
            <tbody>
              {data.by_bathrooms.length > 0 ? data.by_bathrooms.map((b) => (
                <tr key={b.bathrooms} className="border-t border-border">
                  <td className="py-1.5">{b.bathrooms}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.median_rent ? `$${b.median_rent}` : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No bathroom data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Source breakdown */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Submissions by source</h3>
            <span className="ml-auto text-xs text-muted-foreground">which flow</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Source</th>
                <th className="pb-1 font-medium text-right">Rows</th>
                <th className="pb-1 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {data.by_source.length > 0 ? data.by_source.map((s) => {
                const pct = data.total > 0 ? Math.round(100 * s.count / data.total) : 0;
                return (
                  <tr key={s.source} className="border-t border-border">
                    <td className="py-1.5 font-mono text-xs">{s.source}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.count}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">{pct}%</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Completeness */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Rich-field completeness</h3>
          <span className="text-xs text-muted-foreground">
            how often users fill in details beyond the core trio
          </span>
        </div>
        {completenessRows.length > 0 ? (
          <div className="space-y-2">
            {completenessRows.map((r) => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.value.toLocaleString()} / {comp.total.toLocaleString()} · {r.pct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(r.pct, 0.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data yet.</p>
        )}
      </Card>
    </div>
  );
}

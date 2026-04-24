'use client';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminBuyerInputs } from '@/hooks/useAdminBuyerInputs';
import {
  Wallet, MapPin, Bed, Bath, Sparkles, Layers, DollarSign, Users,
} from 'lucide-react';

/**
 * Buyer-side mirror of RentReportsPanel. Shows how much crowd-sourced
 * buyer data we have, where it's coming from, and which inputs users
 * actually fill in vs skip. Driven by /admin/analytics/buyer-inputs
 * which aggregates persona='buyer' rows from user_budget_inputs (post
 * migration 0060).
 */

function Stat({
  label, value, icon: Icon, sub,
}: {
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

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '-' : v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : `$${Math.round(v / 1000)}k`;

export function BuyerInputsPanel() {
  const { data, isLoading } = useAdminBuyerInputs();

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

  const comp = data.completeness;
  const completenessRows: { label: string; value: number; pct: number }[] = comp.total > 0
    ? [
        { label: 'Asking price',     value: comp.has_asking_price,    pct: Math.round(100 * comp.has_asking_price / comp.total) },
        { label: 'Purchase price',   value: comp.has_purchase_price,  pct: Math.round(100 * comp.has_purchase_price / comp.total) },
        { label: 'Bedrooms',         value: comp.has_bedrooms,        pct: Math.round(100 * comp.has_bedrooms / comp.total) },
        { label: 'Bathrooms',        value: comp.has_bathrooms,       pct: Math.round(100 * comp.has_bathrooms / comp.total) },
        { label: 'Finish tier',      value: comp.has_finish_tier,     pct: Math.round(100 * comp.has_finish_tier / comp.total) },
        { label: 'Parking noted',    value: comp.has_parking_noted,   pct: Math.round(100 * comp.has_parking_noted / comp.total) },
        { label: 'Deposit',          value: comp.has_deposit,         pct: Math.round(100 * comp.has_deposit / comp.total) },
        { label: 'Annual income',    value: comp.has_income,          pct: Math.round(100 * comp.has_income / comp.total) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Buyer inputs
        </h2>
        <p className="text-sm text-muted-foreground">
          Crowd-sourced buyer data from PriceAdvisorCard and BuyerBudgetCalculator
          on property reports.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total submissions" value={data.total.toLocaleString()} icon={Wallet} />
        <Stat label="Last 7 days" value={data.last_7d.toLocaleString()} icon={Wallet} />
        <Stat label="Last 30 days" value={data.last_30d.toLocaleString()} icon={Wallet} />
        <Stat label="Distinct contributors" value={data.distinct_contributors.toLocaleString()} icon={Users} sub="by hashed IP" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Distinct addresses" value={data.distinct_addresses.toLocaleString()} icon={MapPin} />
        <Stat label="Distinct SA2s" value={data.distinct_sa2s.toLocaleString()} icon={MapPin} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* By city */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Submissions by city</h3>
            <span className="ml-auto text-xs text-muted-foreground">top 20</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">City</th>
                <th className="pb-1 font-medium text-right">Subs</th>
                <th className="pb-1 font-medium text-right">Addresses</th>
                <th className="pb-1 font-medium text-right">Median ask</th>
              </tr>
            </thead>
            <tbody>
              {data.by_city.length > 0 ? data.by_city.map((c) => (
                <tr key={c.city} className="border-t border-border">
                  <td className="py-1.5">{c.city}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.submissions}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{c.distinct_addresses}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPrice(c.median_asking)}</td>
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
                <th className="pb-1 font-medium text-right">Submissions</th>
                <th className="pb-1 font-medium text-right">Median ask</th>
              </tr>
            </thead>
            <tbody>
              {data.by_bedrooms.length > 0 ? data.by_bedrooms.map((b) => (
                <tr key={b.bedrooms} className="border-t border-border">
                  <td className="py-1.5">{b.bedrooms}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPrice(b.median_asking)}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* By finish tier */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By finish tier</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Tier</th>
                <th className="pb-1 font-medium text-right">Submissions</th>
                <th className="pb-1 font-medium text-right">Median ask</th>
              </tr>
            </thead>
            <tbody>
              {data.by_finish_tier.length > 0 ? data.by_finish_tier.map((t) => (
                <tr key={t.finish_tier} className="border-t border-border">
                  <td className="py-1.5 capitalize">{t.finish_tier}</td>
                  <td className="py-1.5 text-right tabular-nums">{t.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPrice(t.median_asking)}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* By bathrooms */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By bathrooms</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Bathrooms</th>
                <th className="pb-1 font-medium text-right">Submissions</th>
                <th className="pb-1 font-medium text-right">Median ask</th>
              </tr>
            </thead>
            <tbody>
              {data.by_bathrooms.length > 0 ? data.by_bathrooms.map((b) => (
                <tr key={b.bathrooms} className="border-t border-border">
                  <td className="py-1.5">{b.bathrooms}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPrice(b.median_asking)}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* By price band */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By asking price band</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground text-left">
              <tr>
                <th className="pb-1 font-medium">Band</th>
                <th className="pb-1 font-medium text-right">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {data.by_price_band.length > 0 ? data.by_price_band.map((b) => (
                <tr key={b.band} className="border-t border-border">
                  <td className="py-1.5">{b.band}</td>
                  <td className="py-1.5 text-right tabular-nums">{b.count}</td>
                </tr>
              )) : (
                <tr><td colSpan={2} className="py-3 text-center text-muted-foreground text-xs">No data yet</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Source breakdown */}
        <Card className="p-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">By source</h3>
            <span className="ml-auto text-xs text-muted-foreground">which form</span>
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
          <h3 className="text-sm font-semibold">Field completeness</h3>
          <span className="text-xs text-muted-foreground">
            how often buyers fill in each input
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

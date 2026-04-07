'use client';

import { useSuburbReport } from '@/hooks/useSuburbReport';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MapPin, Home, Ruler, TrendingUp, TrendingDown, Minus, Search } from 'lucide-react';
import type { SuburbRental, SuburbRentalTrend } from '@/lib/types';

interface Props {
  sa2Code: string;
}

export function SuburbSummaryPage({ sa2Code }: Props) {
  const { data, isLoading, isError } = useSuburbReport(sa2Code);
  const router = useRouter();

  if (isLoading) return <SuburbSkeleton />;
  if (isError || !data) return <ErrorState variant="suburb-not-found" />;

  const areaKm2 = data.area_hectares ? (data.area_hectares / 100).toFixed(1) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{data.sa2_name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3.5 w-3.5" />
          <span>{data.ta_name}</span>
          {areaKm2 && (
            <>
              <span className="text-border">|</span>
              <Ruler className="h-3.5 w-3.5" />
              <span>{areaKm2} km²</span>
            </>
          )}
          <span className="text-border">|</span>
          <Home className="h-3.5 w-3.5" />
          <span>{data.property_count.toLocaleString()} properties</span>
        </div>
      </div>

      {/* Key stats pills */}
      <div className="flex flex-wrap gap-2">
        {data.comparisons?.avg_nzdep != null && (
          <Badge variant="secondary">NZDep: {Math.round(data.comparisons.avg_nzdep)}</Badge>
        )}
        {data.comparisons?.school_count_1500m != null && (
          <Badge variant="secondary">{Math.round(data.comparisons.school_count_1500m)} schools nearby</Badge>
        )}
        {data.comparisons?.transit_count_400m != null && (
          <Badge variant="secondary">{Math.round(data.comparisons.transit_count_400m)} transit stops</Badge>
        )}
        {data.crime && (
          <Badge variant="secondary">Crime: {Math.round(data.crime.offence_rate_per_10k)}/10k</Badge>
        )}
      </div>

      {/* Area profile */}
      {data.area_profile && (
        <div className="rounded-xl border border-border bg-card p-5 card-elevated">
          <h2 className="text-sm font-bold mb-2">Area Profile</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.area_profile}</p>
        </div>
      )}

      {/* Rental market */}
      {data.rental_overview.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 card-elevated">
          <h2 className="text-sm font-bold mb-3">Rental Market</h2>
          <div className="space-y-2">
            {data.rental_overview.map((r) => (
              <RentalRow
                key={`${r.dwelling_type}-${r.bedrooms}`}
                rental={r}
                trend={data.rental_trends.find(
                  (t) => t.dwelling_type === r.dwelling_type && t.bedrooms === r.bedrooms
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suburb vs City comparison */}
      {data.comparisons && data.city_averages && (
        <div className="rounded-xl border border-border bg-card p-5 card-elevated">
          <h2 className="text-sm font-bold mb-1">Suburb vs City</h2>
          <p className="text-xs text-muted-foreground mb-4">
            How {data.sa2_name} compares to {data.ta_name} averages.
          </p>
          <div className="space-y-4">
            <ComparisonRow
              label="Deprivation (NZDep)"
              suburbValue={data.comparisons.avg_nzdep}
              cityValue={data.city_averages.avg_nzdep}
              lowerIsBetter
            />
            <ComparisonRow
              label="Schools (1.5km)"
              suburbValue={data.comparisons.school_count_1500m}
              cityValue={data.city_averages.school_count_1500m}
            />
            <ComparisonRow
              label="Transit stops (400m)"
              suburbValue={data.comparisons.transit_count_400m}
              cityValue={data.city_averages.transit_count_400m}
            />
            <ComparisonRow
              label="Max noise (dB)"
              suburbValue={data.comparisons.max_noise_db}
              cityValue={data.city_averages.max_noise_db}
              lowerIsBetter
            />
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => router.push(`/?q=${encodeURIComponent(data.sa2_name)}`)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-piq-primary text-white font-semibold hover:bg-piq-primary/90 transition-colors"
      >
        <Search className="h-4 w-4" />
        Search properties in {data.sa2_name}
      </button>
    </div>
  );
}

function RentalRow({ rental, trend }: { rental: SuburbRental; trend?: SuburbRentalTrend }) {
  const trendIcon = trend?.cagr_1yr != null
    ? trend.cagr_1yr > 0.01
      ? <TrendingUp className="h-3 w-3 text-red-500" />
      : trend.cagr_1yr < -0.01
        ? <TrendingDown className="h-3 w-3 text-green-500" />
        : <Minus className="h-3 w-3 text-muted-foreground" />
    : null;

  const trendPct = trend?.cagr_1yr != null ? `${(trend.cagr_1yr * 100).toFixed(1)}%/yr` : null;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <div className="text-sm">
        <span className="font-medium">{rental.dwelling_type}</span>
        <span className="text-muted-foreground"> · {rental.bedrooms} bed</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tabular-nums">${rental.median_rent}/wk</span>
        {trendIcon && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {trendIcon}
            {trendPct}
          </span>
        )}
        <span className="text-xs text-muted-foreground">({rental.bond_count} bonds)</span>
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  suburbValue,
  cityValue,
  lowerIsBetter = false,
}: {
  label: string;
  suburbValue: number | null;
  cityValue: number | null;
  lowerIsBetter?: boolean;
}) {
  if (suburbValue == null && cityValue == null) return null;
  const fmt = (v: number) => (Number.isInteger(v) ? v.toString() : v.toFixed(1));

  let diff = '';
  let diffColor = 'text-muted-foreground';
  if (suburbValue != null && cityValue != null && cityValue > 0) {
    const pct = ((suburbValue - cityValue) / cityValue) * 100;
    const absPct = Math.abs(pct);
    if (absPct > 5) {
      diff = `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;
      const isGood = lowerIsBetter ? pct < 0 : pct > 0;
      diffColor = isGood ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
    }
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {suburbValue != null && (
          <span className="text-xs tabular-nums">
            <span className="text-muted-foreground mr-1">Suburb:</span>
            <span className="font-semibold">{fmt(suburbValue)}</span>
          </span>
        )}
        {cityValue != null && (
          <span className="text-xs tabular-nums">
            <span className="text-muted-foreground mr-1">City:</span>
            <span className="font-semibold">{fmt(cityValue)}</span>
          </span>
        )}
        {diff && <span className={`text-xs font-medium ${diffColor}`}>{diff}</span>}
      </div>
    </div>
  );
}

function SuburbSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

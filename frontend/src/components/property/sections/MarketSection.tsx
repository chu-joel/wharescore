'use client';

import { Badge } from '@/components/ui/badge';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { RentComparisonFlow } from '@/components/property/RentComparisonFlow';
import { RentAdvisorCard } from '@/components/property/RentAdvisorCard';
import { RentHistoryChart } from '@/components/property/RentHistoryChart';
import { HPITrendChart } from '@/components/property/HPITrendChart';
import { PremiumGate } from '@/components/property/PremiumGate';
import { UnitComparisonTable } from '@/components/property/UnitComparisonTable';
import { MarketHeatBadge } from '@/components/property/MarketHeatBadge';
import { formatCurrency, formatPercentChange } from '@/lib/format';
import type { CategoryScore, MarketData, PropertyInfo, PropertyDetection } from '@/lib/types';

interface MarketSectionProps {
  addressId: number;
  category: CategoryScore;
  market: MarketData;
  property: PropertyInfo;
  detection: PropertyDetection | null;
}

export function MarketSection({ addressId, category, market, property, detection }: MarketSectionProps) {
  const isMultiUnit = detection?.is_multi_unit ?? false;
  const hasSiblings = (detection?.sibling_valuations?.length ?? 0) >= 2;

  return (
    <div className="space-y-4">
      {/* Market Heat Badge */}
      {market.market_heat && <MarketHeatBadge heat={market.market_heat} />}

      {/* Council Valuation */}
      {property.capital_value && (
        <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-sm font-semibold">Council Valuation</span>
            {isMultiUnit && (
              <Badge variant="secondary" className="text-[10px]">Unit valuation</Badge>
            )}
          </div>
          <dl className="space-y-1">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Capital Value</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(property.capital_value)}</dd>
            </div>
            {property.land_value && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Land Value</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(property.land_value)}</dd>
              </div>
            )}
            {property.improvement_value && (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Improvements</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(property.improvement_value)}</dd>
              </div>
            )}
          </dl>
          <p className="text-[10px] text-muted-foreground mt-2">
            Rateable value, not market value.
          </p>
        </div>
      )}

      {/* Unit Comparison Table (multi-unit only) */}
      {hasSiblings && detection?.sibling_valuations && (
        <UnitComparisonTable
          siblingValuations={detection.sibling_valuations}
          currentValuationId={property.cv_valuation_id}
          currentProperty={{
            cv_address: property.cv_address,
            capital_value: property.capital_value,
            land_value: property.land_value,
            cv_valuation_id: property.cv_valuation_id,
          }}
        />
      )}

      {/* Rent Comparison Flow (3-state) */}
      <RentComparisonFlow
        addressId={addressId}
        market={market}
        detection={detection}
      />

      {/* Rent Advisor (personalised advice) */}
      <RentAdvisorCard addressId={addressId} />

      {/* Trend data */}
      {market.trend && (
        <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
          <span className="text-sm font-semibold">Rent Trends</span>
          <div className="flex gap-4 mt-2">
            {market.trend.cagr_1yr !== null && (
              <div className="text-center">
                <p className={`text-sm font-semibold tabular-nums ${market.trend.cagr_1yr >= 0 ? 'text-risk-high' : 'text-piq-success'}`}>
                  {formatPercentChange(market.trend.cagr_1yr)}
                </p>
                <p className="text-[10px] text-muted-foreground">1yr</p>
              </div>
            )}
            {market.trend.cagr_5yr !== null && (
              <div className="text-center">
                <p className={`text-sm font-semibold tabular-nums ${market.trend.cagr_5yr >= 0 ? 'text-risk-high' : 'text-piq-success'}`}>
                  {formatPercentChange(market.trend.cagr_5yr)}
                </p>
                <p className="text-[10px] text-muted-foreground">5yr</p>
              </div>
            )}
            {market.trend.cagr_10yr !== null && (
              <div className="text-center">
                <p className={`text-sm font-semibold tabular-nums ${market.trend.cagr_10yr >= 0 ? 'text-risk-high' : 'text-piq-success'}`}>
                  {formatPercentChange(market.trend.cagr_10yr)}
                </p>
                <p className="text-[10px] text-muted-foreground">10yr</p>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">CAGR = compound annual growth rate</p>
        </div>
      )}

      {/* Rent History — free (the hook for renters) */}
      <RentHistoryChart addressId={addressId} />

      {/* HPI — gated (national context, low individual value) */}
      <PremiumGate label="NZ House Price Index trend" trigger="market">
        <HPITrendChart />
      </PremiumGate>

      {/* Indicator cards */}
      {category.indicators.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {category.indicators.map((indicator) => (
            <IndicatorCard key={indicator.name} indicator={indicator} />
          ))}
        </div>
      )}

      {!market.rent_assessment && !property.capital_value && category.indicators.length === 0 && (
        <EmptyState
          variant="no-data"
          title="No market data available"
          description="Market data is not available for this location yet."
        />
      )}

      <DataSourceBadge source="MBIE, WCC, RBNZ, CoreLogic" />
    </div>
  );
}

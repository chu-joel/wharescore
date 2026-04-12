'use client';

import { Badge } from '@/components/ui/badge';
import { IndicatorCard } from '@/components/common/IndicatorCard';
import { EmptyState } from '@/components/common/EmptyState';
import { DataSourceBadge } from '@/components/common/DataSourceBadge';
import { RentComparisonFlow } from '@/components/property/RentComparisonFlow';
import { RentAdvisorCard } from '@/components/property/RentAdvisorCard';
import { RentHistoryChart } from '@/components/property/RentHistoryChart';
import { usePersonaStore } from '@/stores/personaStore';
import { HPITrendChart } from '@/components/property/HPITrendChart';
import { useHostedReport } from '@/components/report/HostedReportContext';
import { PremiumGate } from '@/components/property/PremiumGate';
import { UnitComparisonTable } from '@/components/property/UnitComparisonTable';
import { MarketHeatBadge } from '@/components/property/MarketHeatBadge';
import { formatCurrency, formatPercentChange, effectivePerUnitCv } from '@/lib/format';
import type { CategoryScore, MarketData, PropertyInfo, PropertyDetection } from '@/lib/types';

interface MarketSectionProps {
  addressId: number;
  category: CategoryScore;
  market: MarketData;
  property: PropertyInfo;
  detection: PropertyDetection | null;
}

export function MarketSection({ addressId, category, market, property, detection }: MarketSectionProps) {
  const hosted = useHostedReport();
  const persona = usePersonaStore((s) => s.persona);
  const isMultiUnit = detection?.is_multi_unit ?? false;
  const hasSiblings = (detection?.sibling_valuations?.length ?? 0) >= 2;

  return (
    <div className="space-y-4">
      {/* Market Heat Badge */}
      {market.market_heat && <MarketHeatBadge heat={market.market_heat} />}

      {/* Council Valuation — buyers only. Renters see CV in the hero
          pill already and the breakdown (land + improvements) is not
          relevant to a tenancy decision. */}
      {persona === 'buyer' && (() => {
        const effectiveCv = effectivePerUnitCv(property.capital_value, {
          isMultiUnit: !!detection?.is_multi_unit,
          unitCount: detection?.unit_count,
        });
        const isEstimatedPerUnit =
          !!detection?.is_multi_unit &&
          (detection?.unit_count ?? 1) > 1 &&
          effectiveCv !== property.capital_value;
        const hideBuildingTotals =
          !!detection?.is_multi_unit && (detection?.unit_count ?? 1) > 1 && isEstimatedPerUnit;
        return effectiveCv ? (
          <div className="rounded-xl border border-border bg-card p-3.5 card-elevated">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-sm font-semibold">Council Valuation</span>
              {isMultiUnit && (
                <Badge variant="secondary" className="text-xs">
                  {isEstimatedPerUnit ? 'Per-unit estimate' : 'Unit valuation'}
                </Badge>
              )}
            </div>
            <dl className="space-y-1">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">
                  {isEstimatedPerUnit ? 'Capital Value (est.)' : 'Capital Value'}
                </dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(effectiveCv)}</dd>
              </div>
              {property.land_value && !hideBuildingTotals && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Land Value</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(property.land_value)}</dd>
                </div>
              )}
              {property.improvement_value && !hideBuildingTotals && (
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">Improvements</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(property.improvement_value)}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted-foreground mt-2">
              {isEstimatedPerUnit
                ? 'Rateable value estimated per unit — council record is building-level.'
                : 'Rateable value, not market value.'}
            </p>
          </div>
        ) : null;
      })()}

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

      {/* Renter-only advisor section — buyers get PriceAdvisorCard in
          the dedicated `true-cost` accordion so we don't render it twice. */}
      {!hosted && persona === 'renter' && (
        <>
          <RentComparisonFlow
            addressId={addressId}
            market={market}
            detection={detection}
          />
          <RentAdvisorCard addressId={addressId} />
        </>
      )}

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
                <p className="text-xs text-muted-foreground">1yr</p>
              </div>
            )}
            {market.trend.cagr_5yr !== null && (
              <div className="text-center">
                <p className={`text-sm font-semibold tabular-nums ${market.trend.cagr_5yr >= 0 ? 'text-risk-high' : 'text-piq-success'}`}>
                  {formatPercentChange(market.trend.cagr_5yr)}
                </p>
                <p className="text-xs text-muted-foreground">5yr</p>
              </div>
            )}
            {market.trend.cagr_10yr !== null && (
              <div className="text-center">
                <p className={`text-sm font-semibold tabular-nums ${market.trend.cagr_10yr >= 0 ? 'text-risk-high' : 'text-piq-success'}`}>
                  {formatPercentChange(market.trend.cagr_10yr)}
                </p>
                <p className="text-xs text-muted-foreground">10yr</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">CAGR = compound annual growth rate</p>
        </div>
      )}

      {/* Rent History — skip in hosted mode (calls API) */}
      {!hosted && <RentHistoryChart addressId={addressId} />}

      {/* HPI — buyer-only. A national house price index has no bearing
          on a rental decision, so renters don't see it. */}
      {!hosted && persona === 'buyer' && (
        <PremiumGate label="NZ House Price Index trend" trigger="market">
          <HPITrendChart />
        </PremiumGate>
      )}

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

      <DataSourceBadge source="MBIE, Council Valuations, RBNZ, CoreLogic" />
    </div>
  );
}

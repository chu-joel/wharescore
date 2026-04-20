'use client';

import { TrendingUp } from 'lucide-react';
import { ContextBadge } from '@/components/common/ContextBadge';
import { formatCurrency, effectivePerUnitCv } from '@/lib/format';
import type { PropertyReport } from '@/lib/types';

interface InvestmentMetricsProps {
  report: PropertyReport;
}

interface MetricCard {
  label: string;
  value: string;
  context?: { text: string; sentiment: 'positive' | 'neutral' | 'negative' };
}

export function InvestmentMetrics({ report }: InvestmentMetricsProps) {
  const { market, property } = report;
  const metrics: MetricCard[] = [];

  // Use per-unit CV when the raw value looks building-level so yield
  // calculations don't divide $27k annual rent by an $80M CV and print
  // "0.0% Below average" on every apartment in a multi-unit tower.
  const effectiveCv = effectivePerUnitCv(property.capital_value, {
    isMultiUnit: !!report.property_detection?.is_multi_unit,
    unitCount: report.property_detection?.unit_count,
  });

  // Gross yield
  if (market.rent_assessment?.median && effectiveCv) {
    const annualRent = market.rent_assessment.median * 52;
    const grossYield = (annualRent / effectiveCv) * 100;
    if (grossYield >= 0.5 && grossYield <= 20) {
      const sentiment = grossYield >= 5 ? 'positive' : grossYield >= 3.5 ? 'neutral' : 'negative';
      metrics.push({
        label: 'Gross Yield',
        value: `${grossYield.toFixed(1)}%`,
        context: {
          text: grossYield >= 5 ? 'Strong yield' : grossYield >= 3.5 ? 'Average yield' : 'Below average',
          sentiment,
        },
      });
    }
  }

  // Rent CAGR 1yr
  if (market.trend?.cagr_1yr != null) {
    const v = market.trend.cagr_1yr;
    metrics.push({
      label: 'Rent Growth (1yr)',
      value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
      context: {
        text: v > 3 ? 'Growing fast' : v > 0 ? 'Steady growth' : 'Declining',
        sentiment: v > 0 ? 'positive' : v < -2 ? 'negative' : 'neutral',
      },
    });
  }

  // Rent CAGR 5yr
  if (market.trend?.cagr_5yr != null) {
    const v = market.trend.cagr_5yr;
    metrics.push({
      label: 'Rent Growth (5yr)',
      value: `${v >= 0 ? '+' : ''}${v.toFixed(1)}%/yr`,
      context: {
        text: v > 3 ? 'Strong long-term' : v > 0 ? 'Moderate' : 'Stagnant',
        sentiment: v > 2 ? 'positive' : v < 0 ? 'negative' : 'neutral',
      },
    });
  }

  // Market heat
  if (market.market_heat && market.market_heat !== 'neutral') {
    const heatLabels: Record<string, string> = { cold: 'Cold', cool: 'Cool', warm: 'Warm', hot: 'Hot' };
    const heatSentiment = market.market_heat === 'hot' || market.market_heat === 'warm' ? 'positive' : 'negative';
    metrics.push({
      label: 'Market Heat',
      value: heatLabels[market.market_heat] ?? market.market_heat,
      context: {
        text: market.market_heat === 'hot' ? 'High demand' : market.market_heat === 'warm' ? 'Good demand' : 'Low demand',
        sentiment: heatSentiment as 'positive' | 'negative',
      },
    });
  }

  // CV. show the effective (per-unit where applicable) value.
  if (effectiveCv) {
    const isEstimated =
      !!report.property_detection?.is_multi_unit &&
      (report.property_detection?.unit_count ?? 1) > 1 &&
      property.capital_value !== effectiveCv;
    metrics.push({
      label: isEstimated ? 'Capital Value (est. per unit)' : 'Capital Value',
      value: formatCurrency(effectiveCv),
    });
  }

  if (metrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 card-elevated space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-piq-primary" />
        <span className="text-sm font-bold">Investment Metrics</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
            <p className="text-lg font-bold tabular-nums">{m.value}</p>
            {m.context && (
              <div className="mt-1.5">
                <ContextBadge text={m.context.text} sentiment={m.context.sentiment} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

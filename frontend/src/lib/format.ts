// lib/format.ts — display formatting utilities

/** "$1,250,000" — NZD currency with commas, no decimals */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(value);
}

/** "$580/week" — weekly rent display */
export function formatRent(weeklyRent: number): string {
  return `$${weeklyRent.toLocaleString('en-NZ')}/week`;
}

/** "42" — score with no decimals */
export function formatScore(score: number): string {
  return Number.isFinite(score) ? Math.round(score).toString() : '—';
}

/** "1.2km" or "350m" — distance display */
export function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)}km`
    : `${Math.round(metres)}m`;
}

/** "+2.4%" or "-1.1%" — percentage change with sign */
export function formatPercentChange(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** "23 of 27" — coverage display */
export function formatCoverage(available: number, total: number): string {
  return `${available} of ${total}`;
}

/** "Jan 2026" — month + year for data source dates */
export function formatDataDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' });
}

/** "2,403,583" — large number with commas */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-NZ');
}

/** "4.5 M" — abbreviated magnitude for earthquake display */
export function formatMagnitude(mag: number): string {
  return `${mag.toFixed(1)} M`;
}

/** "64 dB" — noise level display */
export function formatDecibels(db: number): string {
  return `${Math.round(db)} dB`;
}

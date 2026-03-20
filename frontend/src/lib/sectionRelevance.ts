import type { PropertyReport } from '@/lib/types';
import type { Persona } from '@/stores/personaStore';

export interface SectionRelevance {
  section: 'risk' | 'liveability' | 'market' | 'transport' | 'planning';
  score: number;
}

/** Persona boosts: extra weight for sections most relevant to each persona */
const PERSONA_BOOSTS: Record<Persona, Partial<Record<SectionRelevance['section'], number>>> = {
  renter: { risk: 15, market: 10, liveability: 5 },
  buyer: { risk: 10, planning: 15, market: 10 },
};

/**
 * Scores each accordion section 0–100 based on how "interesting" the
 * property's data is for that category. Sections with higher scores
 * contain more noteworthy information and should be shown first.
 * Optionally accepts a persona to boost relevant sections.
 */
export function scoreSectionRelevance(report: PropertyReport, persona?: Persona): SectionRelevance[] {
  const boosts = persona ? PERSONA_BOOSTS[persona] : {};

  const results: SectionRelevance[] = [
    { section: 'risk', score: Math.min(100, scoreRisk(report) + (boosts.risk ?? 0)) },
    { section: 'liveability', score: Math.min(100, scoreLiveability(report) + (boosts.liveability ?? 0)) },
    { section: 'market', score: Math.min(100, scoreMarket(report) + (boosts.market ?? 0)) },
    { section: 'transport', score: Math.min(100, scoreTransport(report) + (boosts.transport ?? 0)) },
    { section: 'planning', score: Math.min(100, scorePlanning(report) + (boosts.planning ?? 0)) },
  ];

  return results.sort((a, b) => b.score - a.score);
}

function scoreRisk(report: PropertyReport): number {
  const h = report.hazards;
  let score = 0;

  if (h.flood_zone) score += 30;
  if (h.tsunami_zone) score += 25;
  if (containsHighOrVery(h.liquefaction_zone)) score += 20;
  if (containsHighOrVery(h.slope_failure)) score += 15;
  if (h.epb_count != null && h.epb_count >= 3) score += 15;
  if (containsHighOrSevere(h.coastal_erosion)) score += 10;
  if (h.contamination_count != null && h.contamination_count >= 5) score += 10;

  return Math.min(score, 100);
}

function scoreLiveability(report: PropertyReport): number {
  const l = report.liveability;
  let score = 0;

  if (l.nzdep_score != null) {
    if (l.nzdep_score >= 8) score += 35;
    else if (l.nzdep_score >= 6) score += 20;
  }
  if (l.crime_rate != null && l.crime_rate > 0) score += 15;
  if (l.school_count != null && l.school_count >= 5) score += 10;

  return Math.min(score, 100);
}

function scoreMarket(report: PropertyReport): number {
  const m = report.market;
  let score = 0;

  if (m.rent_assessment && m.rent_assessment.confidence_stars >= 4) score += 25;
  if (m.trend?.cagr_5yr != null && Math.abs(m.trend.cagr_5yr) > 3) score += 20;
  if (m.rent_assessment?.is_outlier) score += 10;

  return Math.min(score, 100);
}

function scoreTransport(report: PropertyReport): number {
  const l = report.liveability;
  let score = 0;

  if (l.transit_count != null && l.transit_count >= 10) score += 25;
  if (l.nearest_train_m != null && l.nearest_train_m <= 800) score += 20;
  if (l.cbd_distance_m != null && l.cbd_distance_m <= 2000) score += 15;
  if (l.transit_count === 0) score -= 10;

  return Math.max(0, Math.min(score, 100));
}

function scorePlanning(report: PropertyReport): number {
  const p = report.planning;
  let score = 0;

  if (p.epb_listed) score += 35;
  if (p.consent_count != null && p.consent_count >= 10) score += 20;
  if (p.infrastructure_count != null && p.infrastructure_count >= 3) score += 15;
  if (p.heritage_count != null && p.heritage_count >= 3) score += 15;

  return Math.min(score, 100);
}

// --- helpers ---

function containsHighOrVery(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('high') || lower.includes('very');
}

function containsHighOrSevere(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('high') || lower.includes('severe');
}

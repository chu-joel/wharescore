// Runtime configuration. API_BASE is pinned to wharescore.co.nz in this build;
// change it here if Phase 2 needs a staging environment split.
export const API_BASE = "https://wharescore.co.nz";
export const BADGE_PATH = "/api/v1/extension/badge";
export const STATUS_PATH = "/api/v1/extension/status";
export const TOKEN_PATH = "/api/auth/token";

export const EXTENSION_VERSION = "0.1.0";

// Tier names match the backend exactly (EXTENSION-BRIEF.md § User Value Ladder).
export type Tier = "anon" | "free" | "pro";

export type Severity = "critical" | "warning" | "info" | "positive";

export interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface Capabilities {
  save: boolean;
  watchlist: boolean;
  alerts: boolean;
  pdf_export: boolean;
}

export interface PriceBand {
  low: number;
  high: number;
}

export interface PriceEstimate {
  low: number | null;
  median: number | null;
  high: number | null;
  confidence: number | null;
  comps: Array<{ address: string; sale_price: number; sale_date: string }>;
}

export interface RentEstimate {
  low: number | null;
  median: number | null;
  high: number | null;
  yield_percent: number | null;
}

export interface SchoolRow {
  name: string | null;
  decile: number | null;
  zone: "in-zone" | "out-of-zone" | null;
}

export interface BadgeResponse {
  matched: boolean;
  ambiguous?: boolean;
  address_id?: number;
  full_address?: string;
  tier?: Tier;
  persona?: string | null;
  score?: number | null;
  score_band?: string | null;
  findings?: Finding[];
  capabilities?: Capabilities;
  price_band?: PriceBand;          // free + pro
  price_estimate?: PriceEstimate;  // pro only
  rent_estimate?: RentEstimate;    // pro only
  walk_score?: number | null;      // pro only
  schools?: SchoolRow[];           // pro only
  report_url?: string;
}

export interface StatusResponse {
  min_version: string;
  latest_version: string;
  sites: Record<string, { badge_enabled: boolean }>;
  message: string | null;
}

export type SourceSite =
  | "homes.co.nz"
  | "oneroof.co.nz"
  | "trademe.co.nz"
  | "realestate.co.nz";

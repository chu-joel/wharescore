// Seeded BadgeResponse payloads per (tier × persona).
//
// Same property (12345 — 42 Queen Street, Auckland Central) across all
// fixtures so visual diffs are purely tier/persona/state.
//
// The copy here is what the judge will scrutinise against the feature's
// rules (NZ English, relative-to-SA2 for free/pro, register matched to
// persona, no jargon). Intentionally realistic — including some likely-
// weak spots we want the judge to surface.
import type { BadgeResponse } from "../../src/lib/constants";

const baseline = {
  address_id: 12345,
  full_address: "42 Queen Street, Auckland Central",
  score: 58,
  score_band: "moderate risk",
  report_url: "https://wharescore.co.nz/property/12345",
  matched: true as const,
};

export const fx_anon: BadgeResponse = {
  ...baseline,
  tier: "anon",
  // Per brief: generic, no persona weighting, no relative-to-baseline filter.
  // So absolute framings are allowed here (rule exempt).
  findings: [
    {
      severity: "warning",
      title: "Flood-prone area — 12% of this suburb is in a flood zone",
      detail: "Part of the Wai Horotiu catchment. Check for overland flow risk during heavy rain.",
    },
    {
      severity: "info",
      title: "6 schools within 1km",
      detail: "Auckland CBD catchment includes zoned primary and secondary schools.",
    },
  ],
  capabilities: { save: false, watchlist: false, alerts: false, pdf_export: false },
};

export const fx_free_renter: BadgeResponse = {
  ...baseline,
  tier: "free",
  persona: "renter",
  findings: [
    {
      severity: "warning",
      title: "Rent about 12% above the suburb median for a 2-bed unit",
      detail: "Similar units nearby are $595/wk on average.",
    },
    {
      severity: "warning",
      title: "Built before 1978 — Healthy Homes compliance not verified",
      detail: "Ask the landlord for an HH compliance statement before signing.",
    },
  ],
  capabilities: { save: true, watchlist: true, alerts: false, pdf_export: false },
  price_band: { low: 870000, high: 940000 },
};

export const fx_free_buyer: BadgeResponse = {
  ...baseline,
  tier: "free",
  persona: "buyer",
  findings: [
    {
      severity: "warning",
      title: "CV sits $45k above the median for similar homes nearby",
      detail: "Worth comparing recent comps before offering at CV.",
    },
    {
      severity: "warning",
      title: "Steep section — steeper than 80% of Auckland sections",
      detail: "Retaining-wall maintenance and foundation complexity are likely.",
    },
  ],
  capabilities: { save: true, watchlist: true, alerts: false, pdf_export: false },
  price_band: { low: 870000, high: 940000 },
};

export const fx_pro_renter: BadgeResponse = {
  ...baseline,
  tier: "pro",
  persona: "renter",
  findings: [
    {
      severity: "warning",
      title: "Rent about 12% above the suburb median for a 2-bed unit",
      detail: "$595/wk is typical for this suburb + bedroom count.",
    },
    {
      severity: "warning",
      title: "Built before 1978 — Healthy Homes compliance not verified",
      detail: "Pre-1978 builds need retrofitted insulation and heating.",
    },
    {
      severity: "info",
      title: "Noise-affected: within 50m of a bus route — 40% higher noise than suburb average",
      detail: "AT bus route 110 runs weekdays 5am–11pm.",
    },
    {
      severity: "positive",
      title: "8-minute walk to CBD — top-5% of Auckland properties for commute",
      detail: "Close proximity to Britomart station.",
    },
  ],
  capabilities: { save: true, watchlist: true, alerts: true, pdf_export: true },
  price_band: { low: 870000, high: 940000 },
  price_estimate: {
    low: 820000, median: 880000, high: 920000,
    confidence: 0.78,
    comps: [
      { address: "38 Queen Street, Auckland Central", sale_price: 875000, sale_date: "2025-11-14" },
      { address: "51 Queen Street, Auckland Central", sale_price: 910000, sale_date: "2025-09-03" },
    ],
  },
  rent_estimate: { low: 620, median: 680, high: 740, yield_percent: 4.2 },
  walk_score: 92,
  schools: [
    { name: "Auckland Girls' Grammar", decile: 8, zone: "in-zone" },
    { name: "Freemans Bay Primary", decile: 7, zone: "in-zone" },
  ],
};

export const fx_pro_buyer: BadgeResponse = {
  ...baseline,
  tier: "pro",
  persona: "buyer",
  findings: [
    {
      severity: "warning",
      title: "CV sits $45k above the median for similar homes nearby",
      detail: "Recent comps suggest $820k–$920k market range.",
    },
    {
      severity: "warning",
      title: "Steep section — steeper than 80% of Auckland sections",
      detail: "Higher maintenance cost; review retaining-wall consents.",
    },
    {
      severity: "warning",
      title: "Active fault trace within 500m — closer than 98% of Auckland properties",
      detail: "Wairoa North fault — factor into insurance premium.",
    },
    {
      severity: "info",
      title: "Zoned for up to 6 storeys — neighbours could redevelop",
      detail: "Up to 6 storeys permitted without resource consent.",
    },
    {
      severity: "positive",
      title: "8-minute walk to CBD — top-5% of Auckland properties for commute",
      detail: "Desirable for renters if bought as an investment.",
    },
  ],
  capabilities: { save: true, watchlist: true, alerts: true, pdf_export: true },
  price_band: { low: 870000, high: 940000 },
  price_estimate: {
    low: 820000, median: 880000, high: 920000,
    confidence: 0.78,
    comps: [
      { address: "38 Queen Street, Auckland Central", sale_price: 875000, sale_date: "2025-11-14" },
      { address: "51 Queen Street, Auckland Central", sale_price: 910000, sale_date: "2025-09-03" },
    ],
  },
  rent_estimate: { low: 620, median: 680, high: 740, yield_percent: 4.2 },
  walk_score: 92,
  schools: [
    { name: "Auckland Girls' Grammar", decile: 8, zone: "in-zone" },
    { name: "Freemans Bay Primary", decile: 7, zone: "in-zone" },
  ],
};

// Special fixtures for state-specific shots
export const fx_ambiguous: BadgeResponse = {
  ...fx_free_buyer,
  ambiguous: true,
};

export const fx_unmatched: BadgeResponse = {
  matched: false,
};

export const FIXTURES: Record<string, BadgeResponse> = {
  anon: fx_anon,
  free_renter: fx_free_renter,
  free_buyer: fx_free_buyer,
  pro_renter: fx_pro_renter,
  pro_buyer: fx_pro_buyer,
  ambiguous: fx_ambiguous,
  unmatched: fx_unmatched,
};

export type FixtureId = keyof typeof FIXTURES;

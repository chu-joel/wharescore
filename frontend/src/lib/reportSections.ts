// lib/reportSections.ts — Question-based section definitions per persona
//
// Each "question" maps to existing report data sections.
// The frontend renders these as accordion items with natural-language triggers.

import type { Persona } from '@/stores/personaStore';

export type QuestionId =
  | 'safety'
  | 'rent-fair'
  | 'daily-life'
  | 'renter-checklist'
  | 'deal-breakers'
  | 'true-cost'
  | 'investment'
  | 'neighbourhood'
  | 'restrictions'
  | 'buyer-checklist';

export interface QuestionSection {
  id: QuestionId;
  question: string;
  /** Which data categories this question pulls from */
  dataSources: ('hazards' | 'environment' | 'liveability' | 'planning' | 'market')[];
  /** Lucide icon name */
  icon: string;
  iconColor: string;
  iconBg: string;
  /**
   * One section per persona is the primary reason the user came — rent
   * fairness for renters, deal-breakers for buyers. QuestionAccordion
   * renders these with a piq-primary accent + "Most useful" badge so
   * they stand out among the collapsed list.
   */
  featured?: boolean;
  /**
   * Short tease shown in the collapsed trigger telling the user what
   * they'll find inside. Kept to ~60 chars. Complements the preview
   * chips (data-driven) with a "what's in here" hint (content-driven).
   */
  teaser?: string;
}

const RENTER_QUESTIONS: QuestionSection[] = [
  {
    id: 'rent-fair',
    question: 'Is the rent fair?',
    dataSources: ['market'],
    icon: 'DollarSign',
    iconColor: 'text-piq-primary',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    featured: true,
    teaser: 'See how this rent compares to the SA2 median, recent trends, and market heat.',
  },
  {
    id: 'safety',
    question: 'Is it safe?',
    dataSources: ['hazards', 'liveability'],
    icon: 'ShieldAlert',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    teaser: 'Hazard risk by indicator + crime context for the area.',
  },
  {
    id: 'daily-life',
    question: "What's daily life like?",
    dataSources: ['liveability', 'environment'],
    icon: 'Coffee',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    teaser: 'Transit, noise, schools, supermarkets, commute times.',
  },
  {
    // Previously split across "Is the neighbourhood improving?" and
    // "What's the neighbourhood like?". Two near-identical accordions
    // bloated the report and users didn't know which to read first, so
    // trajectory + area snapshot now live under one question.
    id: 'neighbourhood',
    question: "What's the neighbourhood like?",
    dataSources: ['liveability', 'environment', 'planning', 'market'],
    icon: 'TreePine',
    iconColor: 'text-piq-success',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    teaser: 'Deprivation, amenities, demographics, recent development activity.',
  },
  {
    id: 'renter-checklist',
    question: 'What should I check?',
    dataSources: ['hazards', 'planning'],
    icon: 'ClipboardCheck',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    teaser: 'Healthy Homes + property-specific questions to ask at viewing.',
  },
];

const BUYER_QUESTIONS: QuestionSection[] = [
  {
    id: 'deal-breakers',
    question: 'Are there deal-breakers?',
    dataSources: ['hazards', 'environment'],
    icon: 'ShieldAlert',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    featured: true,
    teaser: 'Critical hazard + insurance flags that can kill a sale — read first.',
  },
  {
    id: 'investment',
    question: 'Is it a good investment?',
    dataSources: ['market'],
    icon: 'TrendingUp',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    teaser: 'Capital value history, HPI trend, gross yield and market heat.',
  },
  {
    id: 'true-cost',
    question: 'What will it really cost?',
    dataSources: ['market'],
    icon: 'Calculator',
    iconColor: 'text-piq-primary',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    teaser: 'Mortgage + rates + insurance + body corp — the full monthly number.',
  },
  {
    id: 'daily-life',
    question: "What's daily life like?",
    dataSources: ['liveability', 'environment'],
    icon: 'Coffee',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    teaser: 'Transit, noise, schools, supermarkets, commute times.',
  },
  {
    id: 'neighbourhood',
    question: "What's the neighbourhood like?",
    dataSources: ['liveability', 'environment'],
    icon: 'TreePine',
    iconColor: 'text-piq-success',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    teaser: 'Crime, deprivation, demographics, nearby amenities.',
  },
  {
    id: 'restrictions',
    question: 'What restrictions exist?',
    dataSources: ['planning'],
    icon: 'Landmark',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    teaser: 'Zoning, heritage overlays, height limits, consent activity.',
  },
  {
    id: 'buyer-checklist',
    question: 'What due diligence do I need?',
    dataSources: ['hazards', 'planning'],
    icon: 'ClipboardCheck',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
  },
];

export function getQuestionsForPersona(persona: Persona): QuestionSection[] {
  return persona === 'renter' ? RENTER_QUESTIONS : BUYER_QUESTIONS;
}

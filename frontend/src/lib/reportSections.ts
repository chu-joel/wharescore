// lib/reportSections.ts — Question-based section definitions per persona
//
// Each "question" maps to existing report data sections.
// The frontend renders these as accordion items with natural-language triggers.

import type { Persona } from '@/stores/personaStore';

export type QuestionId =
  | 'safety'
  | 'rent-fair'
  | 'daily-life'
  | 'neighbourhood-improving'
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
}

const RENTER_QUESTIONS: QuestionSection[] = [
  {
    id: 'safety',
    question: 'Is it safe?',
    dataSources: ['hazards', 'liveability'],
    icon: 'ShieldAlert',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    id: 'rent-fair',
    question: 'Is the rent fair?',
    dataSources: ['market'],
    icon: 'DollarSign',
    iconColor: 'text-piq-primary',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
  },
  {
    id: 'daily-life',
    question: "What's daily life like?",
    dataSources: ['liveability', 'environment'],
    icon: 'Coffee',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    id: 'neighbourhood-improving',
    question: 'Is the neighbourhood improving?',
    dataSources: ['liveability', 'planning', 'market'],
    icon: 'TrendingUp',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    id: 'renter-checklist',
    question: 'What should I check?',
    dataSources: ['hazards', 'planning'],
    icon: 'ClipboardCheck',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
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
  },
  {
    id: 'true-cost',
    question: 'What will it really cost?',
    dataSources: ['market'],
    icon: 'Calculator',
    iconColor: 'text-piq-primary',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
  },
  {
    id: 'investment',
    question: 'Is it a good investment?',
    dataSources: ['market'],
    icon: 'TrendingUp',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    id: 'neighbourhood',
    question: "What's the neighbourhood like?",
    dataSources: ['liveability', 'environment'],
    icon: 'TreePine',
    iconColor: 'text-piq-success',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    id: 'restrictions',
    question: 'What restrictions exist?',
    dataSources: ['planning'],
    icon: 'Landmark',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
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

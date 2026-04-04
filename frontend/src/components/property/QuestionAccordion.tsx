'use client';

import { useMemo } from 'react';
import {
  ShieldAlert,
  DollarSign,
  Coffee,
  TrendingUp,
  ClipboardCheck,
  Calculator,
  TreePine,
  Landmark,
  Lock,
} from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { PropertyReport } from '@/lib/types';
import type { QuestionSection, QuestionId } from '@/lib/reportSections';

/** Questions expanded by default — the ones each persona cares about most */
const DEFAULT_EXPANDED: QuestionId[] = ['rent-fair', 'daily-life', 'deal-breakers', 'true-cost'];
import { getQuestionSummary, getPreviewChips, type PreviewChip } from './QuestionSummary';
import { QuestionContent } from './QuestionContent';

interface QuestionAccordionProps {
  report: PropertyReport;
  questions: QuestionSection[];
  /** If true, section content is partially gated */
  locked?: boolean;
}

const ICON_MAP: Record<string, typeof ShieldAlert> = {
  ShieldAlert,
  DollarSign,
  Coffee,
  TrendingUp,
  ClipboardCheck,
  Calculator,
  TreePine,
  Landmark,
};

const CHIP_STYLES: Record<PreviewChip['variant'], string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  neutral: 'bg-muted text-muted-foreground',
};

export function QuestionAccordion({ report, questions, locked = false }: QuestionAccordionProps) {
  const summaries = useMemo(() => {
    const map: Partial<Record<QuestionId, { text: string; chips: PreviewChip[] }>> = {};
    for (const q of questions) {
      map[q.id] = {
        text: getQuestionSummary(q.id, report),
        chips: getPreviewChips(q.id, report),
      };
    }
    return map;
  }, [questions, report]);

  return (
    <Accordion className="space-y-2" multiple defaultValue={questions.filter(q => DEFAULT_EXPANDED.includes(q.id)).map(q => q.id)}>
      {questions.map((q) => {
        const Icon = ICON_MAP[q.icon] ?? ShieldAlert;
        const { text: summaryText, chips } = summaries[q.id] ?? { text: '', chips: [] };

        return (
          <AccordionItem
            key={q.id}
            value={q.id}
            className="rounded-xl border border-border bg-card card-elevated overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-start gap-3 flex-1 min-w-0 text-left">
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${q.iconBg} shrink-0 mt-0.5`}>
                  <Icon className={`h-4 w-4 ${q.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{q.question}</span>
                    {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </div>
                  {summaryText && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {summaryText}
                    </p>
                  )}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {chips.map((chip) => (
                        <span
                          key={chip.label}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CHIP_STYLES[chip.variant]}`}
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <QuestionContent questionId={q.id} report={report} locked={locked} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

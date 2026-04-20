'use client';

import {
  ShieldAlert,
  DollarSign,
  Coffee,
  TrendingUp,
  ClipboardCheck,
  Calculator,
  TreePine,
  Landmark,
} from 'lucide-react';
import type { PropertyReport } from '@/lib/types';
import type { QuestionSection } from '@/lib/reportSections';
import { getQuestionSummary } from './QuestionSummary';
import { QuestionContent } from './QuestionContent';

interface HeroQuestionProps {
  question: QuestionSection;
  report: PropertyReport;
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

export function HeroQuestion({ question, report }: HeroQuestionProps) {
  const Icon = ICON_MAP[question.icon] ?? ShieldAlert;
  const summary = getQuestionSummary(question.id, report);

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${question.iconBg} shrink-0`}>
            <Icon className={`h-5 w-5 ${question.iconColor}`} />
          </div>
          <div>
            <h3 className="text-base font-bold">{question.question}</h3>
            {summary && (
              <p className="text-sm text-muted-foreground mt-0.5">{summary}</p>
            )}
          </div>
        </div>
      </div>
      {/* Content. always expanded */}
      <div className="px-4 pb-4">
        <QuestionContent questionId={question.id} report={report} />
      </div>
    </div>
  );
}

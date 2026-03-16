'use client';

import { Lock, Download, Loader2, TrendingUp, Brain, ClipboardCheck, BarChart3, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfExport } from '@/hooks/usePdfExport';

interface ReportUpsellProps {
  addressId: number;
  /** What's being hidden */
  feature: 'findings' | 'ai-summary' | 'comparisons' | 'checklist' | 'section-detail';
  /** Specific teaser counts to show */
  hiddenCount?: number;
  criticalCount?: number;
  warningCount?: number;
}

const FEATURE_CONFIG = {
  'findings': {
    icon: ShieldAlert,
    iconColor: 'text-red-500',
    bgGradient: 'from-red-50 to-transparent dark:from-red-950/20 dark:to-transparent',
    borderColor: 'border-red-200 dark:border-red-900/30',
  },
  'ai-summary': {
    icon: Brain,
    iconColor: 'text-blue-500',
    bgGradient: 'from-blue-50 to-transparent dark:from-blue-950/20 dark:to-transparent',
    borderColor: 'border-blue-200 dark:border-blue-900/30',
  },
  'comparisons': {
    icon: BarChart3,
    iconColor: 'text-piq-primary',
    bgGradient: 'from-teal-50 to-transparent dark:from-teal-950/20 dark:to-transparent',
    borderColor: 'border-teal-200 dark:border-teal-900/30',
  },
  'checklist': {
    icon: ClipboardCheck,
    iconColor: 'text-amber-500',
    bgGradient: 'from-amber-50 to-transparent dark:from-amber-950/20 dark:to-transparent',
    borderColor: 'border-amber-200 dark:border-amber-900/30',
  },
  'section-detail': {
    icon: TrendingUp,
    iconColor: 'text-piq-primary',
    bgGradient: 'from-teal-50 to-transparent dark:from-teal-950/20 dark:to-transparent',
    borderColor: 'border-teal-200 dark:border-teal-900/30',
  },
};

function getTeaser(feature: ReportUpsellProps['feature'], hiddenCount?: number, criticalCount?: number, warningCount?: number): { headline: string; detail: string } {
  switch (feature) {
    case 'findings': {
      const parts: string[] = [];
      if (criticalCount && criticalCount > 0) parts.push(`${criticalCount} critical`);
      if (warningCount && warningCount > 0) parts.push(`${warningCount} to watch`);
      const suffix = parts.length > 0 ? ` — including ${parts.join(', ')}` : '';
      return {
        headline: `${hiddenCount ?? 0} more issue${(hiddenCount ?? 0) !== 1 ? 's' : ''} found${suffix}`,
        detail: 'The full report includes detailed analysis, actionable recommendations, and risk interpretation for every finding.',
      };
    }
    case 'ai-summary':
      return {
        headline: 'AI-powered property analysis',
        detail: 'Get a plain-English summary of this property\'s key risks, opportunities, and neighbourhood character — written by AI.',
      };
    case 'comparisons':
      return {
        headline: 'How this property compares',
        detail: 'See how this property\'s noise, schools, transit, deprivation, and earthquake risk stack up against suburb and city averages.',
      };
    case 'checklist':
      return {
        headline: 'Personalised due diligence checklist',
        detail: 'Get a prioritised action plan with the specific checks, reports, and inspections you should do before making an offer.',
      };
    case 'section-detail': {
      const parts: string[] = [];
      if (criticalCount && criticalCount > 0) parts.push(`${criticalCount} high-risk`);
      const countText = hiddenCount ? `${hiddenCount} more indicator${hiddenCount !== 1 ? 's' : ''}` : 'More indicators';
      const suffix = parts.length > 0 ? ` — including ${parts.join(', ')} flagged for attention` : '';
      return {
        headline: `${countText} in this section${suffix}`,
        detail: 'The full report includes detailed scores, data sources, and risk analysis for every indicator.',
      };
    }
  }
}

export function ReportUpsell({ addressId, feature, hiddenCount, criticalCount, warningCount }: ReportUpsellProps) {
  const config = FEATURE_CONFIG[feature];
  const teaser = getTeaser(feature, hiddenCount, criticalCount, warningCount);
  const Icon = config.icon;
  const pdf = usePdfExport(addressId);

  return (
    <div className={`rounded-xl border ${config.borderColor} bg-gradient-to-br ${config.bgGradient} p-4 space-y-3`}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-sm shrink-0">
          <Icon className={`h-4.5 w-4.5 ${config.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Lock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">In the full report</span>
          </div>
          <p className="text-sm font-bold leading-snug">{teaser.headline}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{teaser.detail}</p>
        </div>
      </div>
      <Button
        size="sm"
        className="w-full font-semibold text-xs"
        onClick={pdf.startExport}
        disabled={pdf.isGenerating}
      >
        {pdf.isGenerating ? (
          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating...</>
        ) : (
          <><Download className="h-3.5 w-3.5 mr-1.5" /> Get Full Report</>
        )}
      </Button>

    </div>
  );
}

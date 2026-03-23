'use client';

import { Sparkles } from 'lucide-react';
import type { ReportSnapshot } from '@/lib/types';

interface Props {
  snapshot: ReportSnapshot;
}

export function HostedAISummary({ snapshot }: Props) {
  const ai = snapshot.ai_insights as Record<string, unknown> | null;
  if (!ai) return null;

  const summary = ai.executive_summary as string;
  const bottomLine = ai.bottom_line as string;
  const takeaways = (ai.key_takeaways ?? []) as string[];

  if (!summary && !bottomLine && takeaways.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card card-elevated overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-piq-primary" />
        <h3 className="text-lg font-bold">AI Analysis</h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        )}

        {bottomLine && (
          <div className="rounded-lg bg-gradient-to-r from-piq-primary/5 to-piq-primary/10 border border-piq-primary/20 p-4">
            <p className="text-sm font-medium text-foreground">{bottomLine}</p>
          </div>
        )}

        {takeaways.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Key Takeaways</h4>
            <div className="space-y-2">
              {takeaways.slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-piq-primary/10 text-piq-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

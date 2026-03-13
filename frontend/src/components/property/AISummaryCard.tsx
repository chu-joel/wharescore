'use client';

import { useState } from 'react';
import { Sparkles, MapPin, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PREVIEW_LENGTH = 200;

interface AISummaryCardProps {
  summary: string | null;
  areaProfile: string | null;
  suburbName?: string | null;
  loading?: boolean;
}

export function AISummaryCard({ summary, areaProfile, suburbName, loading }: AISummaryCardProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-piq-primary/5 p-4 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="rounded-xl bg-piq-primary/5 p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    );
  }

  if (!summary && !areaProfile) return null;

  return (
    <div className="space-y-3">
      {/* Suburb / Area Profile */}
      {areaProfile && (
        <ExpandableCard
          icon={<MapPin className="h-4 w-4 text-piq-primary" />}
          label={suburbName ? `${suburbName} — Suburb information` : 'Suburb information'}
          text={areaProfile}
          expanded={profileExpanded}
          onToggle={() => setProfileExpanded(!profileExpanded)}
        />
      )}

      {/* AI Property Summary */}
      {summary && (
        <ExpandableCard
          icon={<Sparkles className="h-4 w-4 text-piq-primary" />}
          label="AI Summary"
          text={summary}
          expanded={summaryExpanded}
          onToggle={() => setSummaryExpanded(!summaryExpanded)}
        />
      )}
    </div>
  );
}

function ExpandableCard({
  icon,
  label,
  text,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const needsTruncation = text.length > PREVIEW_LENGTH;
  const displayText = !needsTruncation || expanded
    ? text
    : text.slice(0, PREVIEW_LENGTH).replace(/\s+\S*$/, '') + '…';

  return (
    <div className="rounded-xl bg-piq-primary/5 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm leading-relaxed">{displayText}</p>
      {needsTruncation && (
        <button
          onClick={onToggle}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-piq-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}

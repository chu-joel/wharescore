'use client';

interface DataSourceBadgeProps {
  source: string;
  updated?: string;
}

export function DataSourceBadge({ source, updated }: DataSourceBadgeProps) {
  return (
    <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border">
      Source: {source}
      {updated && <> | Updated: {updated}</>}
    </p>
  );
}

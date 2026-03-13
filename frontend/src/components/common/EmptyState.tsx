'use client';

import { CheckCircle2, HelpCircle, Search } from 'lucide-react';

type EmptyVariant = 'no-risk' | 'no-data' | 'no-results';

interface EmptyStateProps {
  variant: EmptyVariant;
  title: string;
  description?: string;
}

const icons: Record<EmptyVariant, { icon: typeof CheckCircle2; className: string }> = {
  'no-risk': { icon: CheckCircle2, className: 'text-piq-success' },
  'no-data': { icon: HelpCircle, className: 'text-muted-foreground' },
  'no-results': { icon: Search, className: 'text-muted-foreground' },
};

export function EmptyState({ variant, title, description }: EmptyStateProps) {
  const { icon: Icon, className: iconClass } = icons[variant];
  const borderClass = variant === 'no-data' ? 'border-dashed' : '';

  return (
    <div className={`rounded-lg border ${borderClass} border-border p-4 text-center`}>
      <Icon className={`h-8 w-8 mx-auto mb-2 ${iconClass}`} />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

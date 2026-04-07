'use client';

import { WifiOff, Clock, AlertTriangle, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorVariant = 'network' | 'timeout' | 'section' | 'not-found' | 'suburb-not-found' | 'rate-limit';

interface ErrorStateProps {
  variant: ErrorVariant;
  message?: string;
  onRetry?: () => void;
}

const errorConfig: Record<ErrorVariant, { icon: typeof WifiOff; title: string; defaultMessage: string }> = {
  'network': { icon: WifiOff, title: 'Connection issue', defaultMessage: 'We\'re having trouble loading this. Please check your connection and try again.' },
  'timeout': { icon: Clock, title: 'Taking too long', defaultMessage: 'The server is slow. Try again or search a different address.' },
  'section': { icon: AlertTriangle, title: 'Could not load this section', defaultMessage: 'Some data is temporarily unavailable.' },
  'not-found': { icon: SearchX, title: 'Property not found', defaultMessage: 'We couldn\'t find data for this address.' },
  'suburb-not-found': { icon: SearchX, title: 'Suburb not found', defaultMessage: 'We couldn\'t find data for this suburb. It may not be in our coverage area yet.' },
  'rate-limit': { icon: Clock, title: 'Too many requests', defaultMessage: 'Please wait a moment before trying again.' },
};

export function ErrorState({ variant, message, onRetry }: ErrorStateProps) {
  const config = errorConfig[variant];
  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm font-medium">{config.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{message ?? config.defaultMessage}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

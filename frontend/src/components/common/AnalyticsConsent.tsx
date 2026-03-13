'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { readJSON, writeJSON } from '@/lib/storage';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = readJSON<boolean>('analytics_consent', false);
    if (!dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    writeJSON('analytics_consent', true);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
      <p className="text-xs text-muted-foreground">
        We use anonymous analytics to improve WhareScore. No personal data is collected.{' '}
        <a href="/privacy" className="text-piq-primary hover:underline">
          Privacy policy
        </a>
      </p>
      <Button size="sm" variant="outline" onClick={handleDismiss} className="shrink-0">
        OK, got it
      </Button>
    </div>
  );
}

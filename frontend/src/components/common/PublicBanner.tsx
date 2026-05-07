'use client';

import { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePublicBanner, type BannerType } from '@/hooks/usePublicBanner';

const STORAGE_PREFIX = 'ws-banner-dismissed:';

function bannerHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

const TYPE_STYLES: Record<BannerType, { bg: string; border: string; text: string; iconColor: string; Icon: typeof Info }> = {
  info: {
    bg: 'bg-piq-primary/8',
    border: 'border-piq-primary/20',
    text: 'text-foreground',
    iconColor: 'text-piq-primary',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-foreground',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-foreground',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
};

export function PublicBanner() {
  const { data: banner } = usePublicBanner();
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hash = banner ? bannerHash(banner.text) : null;

  useEffect(() => {
    setMounted(true);
    if (!hash) return;
    try {
      setDismissed(localStorage.getItem(STORAGE_PREFIX + hash) === '1');
    } catch {
      // localStorage may be unavailable (private mode, SSR) — show banner anyway
    }
  }, [hash]);

  if (!mounted || !banner || !hash || dismissed) return null;

  const { Icon, bg, border, text, iconColor } = TYPE_STYLES[banner.type] ?? TYPE_STYLES.info;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + hash, '1');
    } catch {
      // ignore — still hide for this session
    }
    setDismissed(true);
  };

  return (
    <div className={`w-full border-b ${border} ${bg}`} role="status">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
        <p className={`flex-1 text-xs sm:text-sm ${text}`}>{banner.text}</p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-piq-primary"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Sparkles, Shield, BarChart3, MapPin, Home, Loader2, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';
import { safeRedirect } from '@/lib/utils';

interface Props {
  token: string;
}

const UPGRADE_BENEFITS = [
  { icon: Shield, text: 'Full hazard intelligence with timeline, severity mapping, and advice' },
  { icon: BarChart3, text: 'Rent & price advisor with methodology, adjustable inputs, and confidence bands' },
  { icon: MapPin, text: 'Terrain analysis — elevation, slope, flood proximity, walking isochrone' },
  { icon: Home, text: 'Neighbourhood deep-dive — noise, air quality, crime trends, infrastructure' },
];

export function QuickUpgradeBanner({ token }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuthToken();

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const authToken = await getToken();
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await apiFetch<{ checkout_url: string }>(
        `/api/v1/report/${token}/upgrade`,
        { method: 'POST', headers },
      );
      if (res.checkout_url) {
        safeRedirect(res.checkout_url);
      }
    } catch {
      setError('Failed to start upgrade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-piq-primary/30 bg-gradient-to-br from-piq-primary/5 via-white to-piq-primary/10 dark:via-neutral-950 p-6 space-y-5">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="h-10 w-10 rounded-full bg-piq-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-piq-primary" />
          </div>
        </div>
        <h3 className="text-lg font-bold">Unlock the Full Report</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your Quick Report covers the essentials. The Full Report gives you everything
          you need to make a confident decision — 25+ sections of detailed analysis.
        </p>
      </div>

      <div className="grid gap-2.5 max-w-md mx-auto">
        {UPGRADE_BENEFITS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-2.5">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-piq-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-3 w-3 text-piq-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <div className="text-center space-y-2">
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-piq-primary text-white text-sm font-semibold hover:bg-piq-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Upgrade to Full Report — $9.99
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">
          One-time payment · 25+ sections unlocked · Instant access
        </p>
      </div>
    </div>
  );
}

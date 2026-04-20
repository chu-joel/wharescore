'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { FileText, ExternalLink, CreditCard, Crown, Loader2, AlertCircle, ArrowLeft, Sparkles, Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { UpgradeModal } from '@/components/property/UpgradeModal';
import { toast } from 'sonner';
import { safeRedirect } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  single: 'Full Report',
  pack3: '3-Pack',
  promo: 'Promo',
  pro: 'Pro',
  quick_single: 'Quick (Free)',
  full_single: 'Full Report',
};

interface SavedReport {
  id: number;
  address_id: number;
  full_address: string;
  persona: string;
  generated_at: string;
  share_token?: string | null;
  report_tier?: 'quick' | 'full' | null;
  expires_at?: string | null;
}

export default function AccountPage() {
  const { getToken } = useAuthToken();
  const { data: session, status } = useSession();
  const user = session?.user;
  const credits = useDownloadGateStore((s) => s.credits);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [savedProperties, setSavedProperties] = useState<{
    address_id: number;
    full_address: string;
    saved_at: string;
  }[]>([]);
  const [loadingSavedProperties, setLoadingSavedProperties] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setLoading(false);
      setLoadingSavedProperties(false);
      return;
    }
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('/api/v1/account/saved-reports', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports);
        } else {
          setLoadError(true);
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();

    // Load saved properties in parallel. Failure is silent — the
    // Saved Reports path above is the critical one.
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch('/api/v1/account/saved-properties', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSavedProperties(data.items ?? []);
        }
      } catch {
        // Non-critical
      } finally {
        setLoadingSavedProperties(false);
      }
    })();
  }, [getToken, status]);

  const handleRemoveSavedProperty = async (addressId: number) => {
    const previous = savedProperties;
    // Optimistic UI — remove locally first
    setSavedProperties((prev) => prev.filter((p) => p.address_id !== addressId));
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const res = await fetch(`/api/v1/account/saved-properties/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      // Restore on failure
      setSavedProperties(previous);
      toast.error('Could not remove that save. Try again.');
    }
  };

  const handleManageSubscription = async () => {
    setManagingSubscription(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/v1/account/manage-subscription', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { portal_url } = await res.json();
        safeRedirect(portal_url);
      } else {
        toast.error('Failed to open subscription management. Try again.');
      }
    } catch {
      toast.error('Something went wrong. Check your connection and try again.');
    } finally {
      setManagingSubscription(false);
    }
  };

  const handleViewReport = (shareToken?: string | null) => {
    if (shareToken) {
      window.open(`/report/${shareToken}`, '_blank', 'noopener,noreferrer');
    }
  };

  const [upgrading, setUpgrading] = useState<string | null>(null);
  const handleUpgrade = async (shareToken: string) => {
    setUpgrading(shareToken);
    try {
      const authToken = await getToken();
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await apiFetch<{ checkout_url?: string; upgraded?: boolean }>(
        `/api/v1/report/${shareToken}/upgrade`,
        { method: 'POST', headers },
      );
      if (res.upgraded) {
        toast.success('Report upgraded to Full! Credit used.');
        // Refresh the reports list to show updated tier
        const token = await getToken();
        if (token) {
          const refreshRes = await fetch('/api/v1/account/saved-reports', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            setReports(data.reports);
          }
        }
      } else if (res.checkout_url) {
        safeRedirect(res.checkout_url);
      }
    } catch {
      toast.error('Failed to start upgrade. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  // Credit balance display
  const renderCreditBalance = () => {
    if (!credits) return null;

    const isPro = credits.plan === 'pro';
    const gradientClass = isPro
      ? 'from-amber-500/10 to-orange-500/10 border-amber-500/20'
      : 'from-piq-primary/10 to-blue-500/10 border-piq-primary/20';

    return (
      <div className={`rounded-xl border bg-gradient-to-br ${gradientClass} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isPro ? (
              <Crown className="h-5 w-5 text-amber-500" />
            ) : (
              <CreditCard className="h-5 w-5 text-piq-primary" />
            )}
            <h2 className="text-lg font-semibold">
              {PLAN_LABELS[credits.plan] ?? credits.plan} Plan
            </h2>
          </div>
          {isPro && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
              PRO
            </span>
          )}
        </div>

        {isPro ? (
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Today</span>
                <span className="font-medium">{credits.downloadsToday} / {credits.dailyLimit ?? 10}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, (credits.downloadsToday / (credits.dailyLimit ?? 10)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Last 30 days</span>
                <span className="font-medium">{credits.downloadsThisMonth} / {credits.monthlyLimit ?? 30}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, (credits.downloadsThisMonth / (credits.monthlyLimit ?? 30)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ) : credits.plan !== 'free' ? (
          <div className="space-y-2">
            <div>
              <p className="text-3xl font-bold">{credits.creditsRemaining ?? 0}</p>
              <p className="text-sm text-muted-foreground">credit{credits.creditsRemaining === 1 ? '' : 's'} remaining</p>
            </div>
            {((credits.quickCredits ?? 0) > 0 || (credits.fullCredits ?? 0) > 0) && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                {(credits.quickCredits ?? 0) > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {credits.quickCredits} quick
                  </span>
                )}
                {(credits.fullCredits ?? 0) > 0 && (
                  <span className="rounded-full bg-piq-primary/10 text-piq-primary px-2 py-0.5 font-medium">
                    {credits.fullCredits} full
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Purchase credits to download premium property reports.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button onClick={() => setShowUpgradeModal(true)} size="sm">
            {credits.plan === 'free' ? 'Get started' : 'Buy more credits'}
          </Button>
          {isPro && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={managingSubscription}
            >
              {managingSubscription ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Manage subscription'
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Auth loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background pt-14 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated state
  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-14 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Sign in to view your account</h1>
          <p className="text-sm text-muted-foreground mb-4">
            View your credits, saved reports, and manage your subscription.
          </p>
          <a
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
    <UpgradeModal />
    <div className="min-h-screen bg-background pt-14">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-muted-foreground">
            {user.name || user.email}
          </p>
        </div>

        {/* Credit Balance */}
        {renderCreditBalance()}

        {/* Saved Properties (bookmarks — distinct from Saved Reports) */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Saved Properties</h2>
          {loadingSavedProperties ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : savedProperties.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Heart className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Click the heart button on any property page to save it here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {savedProperties.map((p) => (
                <li
                  key={p.address_id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <Heart className="h-4 w-4 text-red-500 fill-red-500 shrink-0" />
                  <a
                    href={`/?address=${p.address_id}`}
                    className="flex-1 text-sm font-medium hover:text-piq-primary transition-colors truncate"
                  >
                    {p.full_address || `Saved property #${p.address_id}`}
                  </a>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                    {new Date(p.saved_at).toLocaleDateString('en-NZ')}
                  </span>
                  <button
                    onClick={() => handleRemoveSavedProperty(p.address_id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
                    aria-label="Remove saved property"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Saved Reports */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Saved Reports</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Failed to load your reports. Check your connection and refresh the page.
              </p>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">
                Your reports will appear here after your first download.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const isQuick = report.report_tier === 'quick';
                const isFull = report.report_tier === 'full';
                return (
                  <div
                    key={report.id}
                    className="rounded-lg border border-border overflow-hidden hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{report.full_address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Generated {new Date(report.generated_at).toLocaleDateString('en-NZ', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                            {report.persona}
                          </span>
                          {isQuick && (
                            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-xs font-semibold">
                              Quick
                            </span>
                          )}
                          {isFull && (
                            <span className="rounded-full bg-piq-primary/10 text-piq-primary px-2 py-0.5 text-xs font-semibold">
                              Full
                            </span>
                          )}
                        </div>
                      </div>
                      {report.share_token ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(report.share_token)}
                          className="shrink-0 ml-2"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 ml-2 animate-pulse">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generating…
                        </span>
                      )}
                    </div>
                    {isQuick && report.share_token && (() => {
                      const daysLeft = report.expires_at
                        ? Math.ceil((new Date(report.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;
                      const isExpiring = daysLeft !== null && daysLeft <= 7;
                      return (
                        <div className={`border-t px-4 py-3 flex items-center justify-between gap-3 ${isExpiring ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20' : 'border-border bg-gradient-to-r from-piq-primary/5 to-transparent'}`}>
                          <p className="text-xs text-muted-foreground">
                            {isExpiring
                              ? `Expires in ${daysLeft! <= 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`} — upgrade to keep permanently with 25+ sections.`
                              : 'Upgrade to Full for hazard analysis, rent/price advisor, terrain data, and 25+ sections.'}
                          </p>
                          <button
                            onClick={() => handleUpgrade(report.share_token!)}
                            disabled={upgrading === report.share_token}
                            className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-md bg-piq-primary text-white text-xs font-semibold hover:bg-piq-primary/90 transition-colors disabled:opacity-50"
                          >
                            {upgrading === report.share_token ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {(credits?.fullCredits ?? 0) > 0 || credits?.plan === 'pro'
                              ? 'Upgrade (use credit)'
                              : 'Upgrade $9.99'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}

          {reports.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Reports reflect data at time of generation.
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

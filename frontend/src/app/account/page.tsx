'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { FileText, Download, ExternalLink, CreditCard, Crown, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDownloadGateStore } from '@/stores/downloadGateStore';
import { toast } from 'sonner';
import { safeRedirect } from '@/lib/utils';

interface SavedReport {
  id: number;
  address_id: number;
  full_address: string;
  persona: string;
  generated_at: string;
  share_token?: string | null;
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

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setLoading(false);
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
  }, [getToken, status]);

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

  const handleViewReport = async (reportId: number, shareToken?: string | null) => {
    // Prefer hosted interactive report if share_token exists
    if (shareToken) {
      window.open(`/report/${shareToken}`, '_blank', 'noopener,noreferrer');
      return;
    }
    // Fallback to old HTML blob for legacy reports
    const token = await getToken();
    try {
      const res = await fetch(`/api/v1/account/saved-reports/${reportId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load report');
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Failed to view report:', err);
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
            <h2 className="text-lg font-semibold capitalize">
              {credits.plan === 'free' ? 'Free' : credits.plan} Plan
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
                <span className="text-muted-foreground">This month</span>
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
          <div>
            <p className="text-3xl font-bold">{credits.creditsRemaining ?? 0}</p>
            <p className="text-sm text-muted-foreground">credit{credits.creditsRemaining === 1 ? '' : 's'} remaining</p>
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
    <div className="min-h-screen bg-background pt-14">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-muted-foreground">
            {user.name || user.email}
          </p>
        </div>

        {/* Credit Balance */}
        {renderCreditBalance()}

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
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{report.full_address}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Generated {new Date(report.generated_at).toLocaleDateString('en-NZ', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                        {report.persona}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewReport(report.id, report.share_token)}
                    className="shrink-0 ml-2"
                  >
                    {report.share_token ? <ExternalLink className="h-4 w-4 mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                    View
                  </Button>
                </div>
              ))}
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
  );
}

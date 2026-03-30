'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Minus, CreditCard, Crown, User, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  plan: string;
  created_at: string;
  quick_credits: number;
  full_credits: number;
  total_reports: number;
}

export function UsersPanel() {
  const { getToken } = useAuthToken();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [creditModal, setCreditModal] = useState<{ userId: string; email: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState(1);
  const [creditTier, setCreditTier] = useState<'quick' | 'full'>('full');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: async () => {
      const token = await getToken();
      const params = new URLSearchParams({ page: String(page), per_page: '25' });
      if (search) params.set('q', search);
      return apiFetch<UserRow[]>(`/api/v1/admin/users?${params}`, { token: token ?? undefined });
    },
  });

  const adjustCredits = useMutation({
    mutationFn: async ({ userId, amount, tier }: { userId: string; amount: number; tier: string }) => {
      const token = await getToken();
      return apiFetch(`/api/v1/admin/users/${encodeURIComponent(userId)}/credits?amount=${amount}&tier=${tier}`, {
        method: 'POST',
        token: token ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(`Credits updated`);
      setCreditModal(null);
    },
    onError: () => {
      toast.error('Failed to update credits');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Users</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by email or name..."
              className="h-9 w-64 rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <Card className="p-8 text-center">
          <User className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No users found matching your search.' : 'No users yet.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Credits</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Reports</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[200px]">{user.display_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        user.plan === 'pro'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : user.plan === 'free'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-piq-primary/10 text-piq-primary'
                      }`}>
                        {user.plan === 'pro' && <Crown className="h-3 w-3" />}
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        {user.full_credits > 0 && (
                          <span className="rounded-full bg-piq-primary/10 text-piq-primary px-2 py-0.5 font-medium">
                            {user.full_credits} full
                          </span>
                        )}
                        {user.quick_credits > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                            {user.quick_credits} quick
                          </span>
                        )}
                        {user.full_credits === 0 && user.quick_credits === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {user.total_reports}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCreditModal({ userId: user.user_id, email: user.email })}
                        className="h-7 text-xs"
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Credits
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} · {users.length} users shown
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="h-7"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={users.length < 25}
                onClick={() => setPage(page + 1)}
                className="h-7"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Credit adjustment modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Adjust Credits</h3>
              <p className="text-xs text-muted-foreground truncate">{creditModal.email}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tier</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setCreditTier('full')}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
                      creditTier === 'full' ? 'border-piq-primary bg-piq-primary/5' : 'border-border'
                    }`}
                  >
                    Full Report
                  </button>
                  <button
                    onClick={() => setCreditTier('quick')}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
                      creditTier === 'quick' ? 'border-piq-primary bg-piq-primary/5' : 'border-border'
                    }`}
                  >
                    Quick Report
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount</label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreditAmount(Math.max(-10, creditAmount - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                    className="h-8 w-16 rounded-lg border border-border bg-background text-center text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCreditAmount(Math.min(50, creditAmount + 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Positive = add credits, negative = remove credits
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setCreditModal(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={creditAmount === 0 || adjustCredits.isPending}
                onClick={() => adjustCredits.mutate({
                  userId: creditModal.userId,
                  amount: creditAmount,
                  tier: creditTier,
                })}
              >
                {adjustCredits.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : creditAmount > 0 ? (
                  `Add ${creditAmount} ${creditTier} credit${creditAmount !== 1 ? 's' : ''}`
                ) : creditAmount < 0 ? (
                  `Remove ${Math.abs(creditAmount)} credit${Math.abs(creditAmount) !== 1 ? 's' : ''}`
                ) : (
                  'Enter amount'
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

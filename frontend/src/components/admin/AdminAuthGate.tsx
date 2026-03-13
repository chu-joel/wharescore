'use client';

import { useState, useCallback } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Lock } from 'lucide-react';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, login } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLocked = lockoutEnd !== null && Date.now() < lockoutEnd;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim() || login.isPending || isLocked) return;

      setError(null);
      try {
        await login.mutateAsync(password);
      } catch {
        const next = failCount + 1;
        setFailCount(next);
        if (next >= MAX_ATTEMPTS) {
          setLockoutEnd(Date.now() + LOCKOUT_SECONDS * 1000);
          setError(`Too many attempts. Wait ${LOCKOUT_SECONDS}s.`);
          setTimeout(() => {
            setLockoutEnd(null);
            setFailCount(0);
            setError(null);
          }, LOCKOUT_SECONDS * 1000);
        } else {
          setError('Incorrect password');
        }
      }
    },
    [password, login, failCount, isLocked],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-muted/50">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Admin Access</h1>
          <p className="text-sm text-muted-foreground">WhareScore Dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLocked || login.isPending}
            autoFocus
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={!password.trim() || isLocked || login.isPending}
          >
            {login.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}

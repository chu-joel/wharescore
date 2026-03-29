'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Lock, ShieldX } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading, error } = useAdminAuth();
  const { data: session, status } = useSession();
  const isSignedIn = status === 'authenticated';

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/50">
        <Card className="w-full max-w-sm p-6">
          <div className="mb-6 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Admin Access</h1>
            <p className="text-sm text-muted-foreground">Sign in to continue</p>
          </div>
          <Button className="w-full" onClick={() => signIn('google')}>
            Sign in with Google
          </Button>
        </Card>
      </div>
    );
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  // Signed in but not an admin
  return (
    <div className="flex h-screen items-center justify-center bg-muted/50">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center">
          <ShieldX className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <h1 className="text-lg font-semibold">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.user?.email} doesn&apos;t have admin access.
          </p>
        </div>
      </Card>
    </div>
  );
}

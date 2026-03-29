import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';

export function useAdminAuth() {
  const { status } = useSession();
  const { getToken } = useAuthToken();
  const isSignedIn = status === 'authenticated';

  const check = useQuery({
    queryKey: ['admin', 'check'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/v1/admin/check', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Not admin');
      return res.json();
    },
    enabled: isSignedIn,
    retry: false,
    staleTime: 60_000,
  });

  return {
    isAdmin: check.isSuccess,
    isLoading: isSignedIn && check.isLoading,
    error: check.error,
  };
}

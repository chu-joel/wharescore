import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuthToken } from '@/hooks/useAuthToken';

export interface EmailSignup {
  id: number;
  email: string;
  requested_region: string;
  created_at: string;
}

interface EmailListResponse {
  items: EmailSignup[];
  total: number;
  page: number;
  limit: number;
}

export function useAdminEmails(page: number) {
  const { getToken } = useAuthToken();
  return useQuery({
    queryKey: ['admin', 'emails', page],
    queryFn: async () => {
      const token = await getToken();
      return apiFetch<EmailListResponse>(
        `/api/v1/admin/emails?page=${page}&limit=50`,
        { token: token ?? undefined },
      );
    },
  });
}

export async function exportEmailsCsv() {
  // Fetch token for auth. uses the same token endpoint
  let token: string | null = null;
  try {
    const tokenRes = await fetch('/api/auth/token');
    if (tokenRes.ok) {
      const data = await tokenRes.json();
      token = data.token;
    }
  } catch { /* proceed without */ }

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/v1/admin/emails?format=csv', {
    credentials: 'include',
    headers,
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `email-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

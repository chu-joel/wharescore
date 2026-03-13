import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

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
  return useQuery({
    queryKey: ['admin', 'emails', page],
    queryFn: () =>
      apiFetch<EmailListResponse>(
        `/api/v1/admin/emails?page=${page}&limit=50`,
      ),
  });
}

export async function exportEmailsCsv() {
  const res = await fetch('/api/v1/admin/emails?format=csv', {
    credentials: 'include',
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

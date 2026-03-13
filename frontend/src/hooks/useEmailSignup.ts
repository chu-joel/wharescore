import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { EmailSignupCreate } from '@/lib/types';

interface SignupResponse {
  status: 'subscribed' | 'already_subscribed';
}

export function useEmailSignup() {
  return useMutation({
    mutationFn: async (data: EmailSignupCreate) => {
      return apiFetch<SignupResponse>('/api/v1/email-signups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  });
}

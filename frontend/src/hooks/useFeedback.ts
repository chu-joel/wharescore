import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { FeedbackCreate } from '@/lib/types';

export function useFeedback() {
  return useMutation({
    mutationFn: async (data: FeedbackCreate) => {
      return apiFetch('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  });
}

'use client';

import { toast } from 'sonner';

type ToastType =
  | 'payment_success'
  | 'report_generated'
  | 'last_credit'
  | 'daily_limit'
  | 'monthly_limit'
  | 'signed_out';

export function showPaymentToast(type: ToastType, credits?: number, resetDate?: string) {
  switch (type) {
    case 'payment_success':
      toast.success(`Payment successful! You have ${credits ?? 0} credit${credits === 1 ? '' : 's'}`);
      break;
    case 'report_generated':
      if (credits !== undefined && credits > 0) {
        toast.success(`Your report is ready! ${credits} credit${credits === 1 ? '' : 's'} remaining`);
      } else {
        toast.success('Your report is ready!');
      }
      break;
    case 'last_credit':
      toast.warning('Report generated! That was your last credit');
      break;
    case 'daily_limit':
      toast.info('Daily limit reached. resets at midnight');
      break;
    case 'monthly_limit':
      toast.info(`Monthly limit reached. resets ${resetDate ?? 'next month'}`);
      break;
    case 'signed_out':
      toast('Signed out successfully');
      break;
  }
}

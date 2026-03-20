'use client';

import { Shield, TrendingUp, Users } from 'lucide-react';
import { usePersonaStore } from '@/stores/personaStore';

const BUYER_MESSAGES = [
  { icon: Shield, text: 'This report analyses 40+ risk factors that agents don\'t disclose.' },
  { icon: TrendingUp, text: 'Properties in hazard zones sell for 8–15% less — know before you offer.' },
  { icon: Users, text: 'Over 100 data sources checked for every address in NZ.' },
];

const RENTER_MESSAGES = [
  { icon: Shield, text: 'This report checks 40+ factors your landlord won\'t mention.' },
  { icon: TrendingUp, text: 'Know if your rent is fair — median rents vary 30% within the same suburb.' },
  { icon: Users, text: 'Over 100 data sources checked for every address in NZ.' },
];

export function BetaBanner() {
  const persona = usePersonaStore((s) => s.persona);
  const messages = persona === 'renter' ? RENTER_MESSAGES : BUYER_MESSAGES;

  // Rotate message based on time (changes every 30s)
  const idx = Math.floor(Date.now() / 30000) % messages.length;
  const { icon: Icon, text } = messages[idx];

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-piq-primary/15 bg-piq-primary/5 dark:bg-piq-primary/10 px-4 py-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-piq-primary/10 shrink-0">
        <Icon className="h-3.5 w-3.5 text-piq-primary" />
      </div>
      <p className="text-xs">
        <span className="font-semibold text-piq-primary">{text}</span>
      </p>
    </div>
  );
}

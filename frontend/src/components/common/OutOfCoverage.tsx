'use client';

import { useState } from 'react';
import { MapPinOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmailSignup } from '@/hooks/useEmailSignup';

interface OutOfCoverageProps {
  detectedCity: string;
}

const SUPPORTED_CITIES = ['Wellington'];

export function OutOfCoverage({ detectedCity }: OutOfCoverageProps) {
  const [email, setEmail] = useState('');
  const { mutate, isPending, data, error, isSuccess } = useEmailSignup();

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    mutate({ email, requested_region: detectedCity });
  };

  return (
    <div className="p-6 text-center space-y-4">
      <MapPinOff className="h-12 w-12 mx-auto text-muted-foreground" />
      <h2 className="text-lg font-semibold">We&apos;re not in {detectedCity} yet</h2>
      <p className="text-sm text-muted-foreground">
        WhareScore is currently available in Wellington. Sign up to be notified when we expand.
      </p>

      {isSuccess ? (
        <div className="flex items-center justify-center gap-2 text-piq-success">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm font-medium">
            {data?.status === 'already_subscribed'
              ? "You're already signed up. We'll be in touch!"
              : `Thanks! We'll notify you when we expand to ${detectedCity}.`}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            maxLength={254}
            className="flex-1"
          />
          <Button type="submit" disabled={!emailValid || isPending}>
            {isPending ? 'Signing up...' : 'Notify me'}
          </Button>
        </form>
      )}

      {error && (
        <p className="text-xs text-destructive">
          Something went wrong. Please try again.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Currently available:{' '}
        {SUPPORTED_CITIES.map((city) => (
          <span key={city} className="font-medium">{city}</span>
        ))}
      </p>
    </div>
  );
}

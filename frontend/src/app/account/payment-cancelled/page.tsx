'use client';

import { XCircle, ArrowLeft } from 'lucide-react';
export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-background pt-14 flex items-center justify-center">
      <div className="mx-auto max-w-md px-4 text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <XCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment cancelled</h1>
          <p className="text-muted-foreground">
            No worries — you haven&apos;t been charged. You can try again whenever you&apos;re ready.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="/"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to browsing
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackDrawer } from './FeedbackDrawer';

/**
 * Floating action button. Desktop only — on mobile the MobileDrawer
 * for a selected property sits at z-50/bottom-0/full-width and
 * covers this FAB (z-40). Mobile users reach feedback through the
 * Help (?) menu in AppHeader which mounts its own FeedbackDrawer.
 */
export function FeedbackFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex fixed bottom-4 right-4 z-40 items-center gap-1.5 rounded-full bg-background/90 supports-[backdrop-filter]:backdrop-blur border border-piq-primary/40 px-3 py-1.5 text-xs font-medium text-piq-primary shadow-sm transition-all hover:bg-piq-primary/5 hover:border-piq-primary hover:shadow-md active:scale-[0.98]"
        aria-label="Send feedback"
        title="Send feedback or report a bug"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Feedback
      </button>
      <FeedbackDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

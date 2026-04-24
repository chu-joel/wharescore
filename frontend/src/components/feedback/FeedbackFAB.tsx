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
        className="hidden md:inline-flex fixed bottom-4 right-4 z-40 items-center gap-2 rounded-full bg-piq-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
        aria-label="Send feedback"
        title="Send feedback or report a bug"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </button>
      <FeedbackDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

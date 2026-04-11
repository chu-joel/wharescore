'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackDrawer } from './FeedbackDrawer';

export function FeedbackFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
        aria-label="Send feedback"
        title="Send feedback or report a bug"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Button>
      <FeedbackDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

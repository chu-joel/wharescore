'use client';

import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Frown, Meh, Smile, Laugh, Heart, Send, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { stripHtml } from '@/lib/utils';
import type { FeedbackCreate } from '@/lib/types';

interface FeedbackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FeedbackTab = 'bug' | 'feature' | 'general';

const TABS: { value: FeedbackTab; label: string; emoji: string }[] = [
  { value: 'bug', label: 'Bug', emoji: '🐛' },
  { value: 'feature', label: 'Feature', emoji: '✨' },
  { value: 'general', label: 'General', emoji: '💬' },
];

const SATISFACTION_ICONS = [
  { value: 1 as const, Icon: Frown, label: 'Very unhappy', color: 'text-red-500' },
  { value: 2 as const, Icon: Meh, label: 'Unhappy', color: 'text-orange-400' },
  { value: 3 as const, Icon: Smile, label: 'Neutral', color: 'text-yellow-500' },
  { value: 4 as const, Icon: Laugh, label: 'Happy', color: 'text-emerald-500' },
  { value: 5 as const, Icon: Heart, label: 'Very happy', color: 'text-pink-500' },
];

const IMPORTANCE = ['low', 'medium', 'high', 'critical'] as const;
const IMPORTANCE_COLORS: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  high: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
};
const IMPORTANCE_ACTIVE: Record<string, string> = {
  low: 'bg-emerald-500 text-white border-emerald-500',
  medium: 'bg-yellow-500 text-white border-yellow-500',
  high: 'bg-orange-500 text-white border-orange-500',
  critical: 'bg-red-500 text-white border-red-500',
};

export function FeedbackDrawer({ open, onOpenChange }: FeedbackDrawerProps) {
  const [tab, setTab] = useState<FeedbackTab>('general');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [satisfaction, setSatisfaction] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  const [importance, setImportance] = useState<typeof IMPORTANCE[number]>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const descriptionValid = description.trim().length >= 10 && description.trim().length <= 2000;
  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const reset = useCallback(() => {
    setDescription('');
    setEmail('');
    setSatisfaction(undefined);
    setImportance('medium');
    setSubmitted(false);
    setError(null);
  }, []);

  const handleSubmit = async () => {
    if (!descriptionValid || !emailValid || cooldown) return;
    setSubmitting(true);
    setError(null);

    const payload: FeedbackCreate = {
      type: tab,
      description: stripHtml(description.trim()),
      ...(email && { email }),
      ...(satisfaction && { satisfaction }),
      importance,
      page_url: window.location.href,
      browser_info: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      },
    };

    try {
      await apiFetch('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSubmitted(true);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429) {
        setError('Please wait before submitting again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="border-b px-6 pt-6 pb-4">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg">Send Feedback</SheetTitle>
            <SheetDescription>Help us make WhareScore better.</SheetDescription>
          </SheetHeader>
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-base font-semibold">Thanks for your feedback!</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">We read every submission.</p>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
              Close
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Tab selector */}
            <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${
                    tab === t.value
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Satisfaction (general tab only) */}
            {tab === 'general' && (
              <fieldset>
                <legend className="text-xs font-medium text-muted-foreground mb-2">
                  How are you finding WhareScore?
                </legend>
                <div className="flex gap-1 justify-center">
                  {SATISFACTION_ICONS.map(({ value, Icon, label, color }) => {
                    const active = satisfaction === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setSatisfaction(value)}
                        className={`relative p-2.5 rounded-xl transition-all ${
                          active
                            ? `${color} bg-current/10 scale-110`
                            : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted'
                        }`}
                        aria-label={label}
                        title={label}
                      >
                        <Icon className={`h-7 w-7 ${active ? color : ''}`} />
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {tab === 'bug' ? 'What went wrong?' : tab === 'feature' ? 'What would you like to see?' : 'Your feedback'}
                <span className="text-destructive ml-0.5">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  tab === 'bug'
                    ? 'Describe the issue — what did you expect vs. what happened?'
                    : tab === 'feature'
                      ? 'Describe the feature and why it would help...'
                      : 'Share your thoughts...'
                }
                rows={4}
                maxLength={2000}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm leading-relaxed resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-colors"
              />
              <div className="flex justify-between mt-1 px-0.5">
                {description.length > 0 && description.trim().length < 10 ? (
                  <p className="text-xs text-destructive">At least 10 characters</p>
                ) : <span />}
                <p className="text-xs text-muted-foreground tabular-nums">{description.length}/2000</p>
              </div>
            </div>

            {/* Importance (bug/feature only) */}
            {(tab === 'bug' || tab === 'feature') && (
              <fieldset>
                <legend className="text-xs font-medium text-muted-foreground mb-2">Importance</legend>
                <div className="flex gap-2">
                  {IMPORTANCE.map((level) => (
                    <button
                      key={level}
                      onClick={() => setImportance(level)}
                      className={`flex-1 rounded-lg h-9 text-xs font-semibold border transition-all capitalize ${
                        importance === level
                          ? IMPORTANCE_ACTIVE[level]
                          : IMPORTANCE_COLORS[level]
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Email <span className="font-normal">(optional — for follow-up)</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1.5 rounded-xl"
              />
              {email && !emailValid && (
                <p className="text-xs text-destructive mt-1 px-0.5">Invalid email format</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5">
                <p className="text-xs text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={!descriptionValid || !emailValid || submitting || cooldown}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {submitting ? (
                'Sending...'
              ) : cooldown ? (
                'Sent — wait 30s'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Feedback
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

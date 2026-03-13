'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminContent, useUpdateContent } from '@/hooks/useAdminContent';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface BannerConfig {
  text: string;
  type: 'info' | 'warning' | 'success';
  active: boolean;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

let faqIdCounter = 0;
function nextFaqId() {
  return `faq-${++faqIdCounter}`;
}

export function ContentPanel() {
  const { data, isLoading } = useAdminContent();
  const updateContent = useUpdateContent();

  // Banner state
  const [banner, setBanner] = useState<BannerConfig>({
    text: '',
    type: 'info',
    active: false,
  });

  // Demo address state
  const [demoAddressId, setDemoAddressId] = useState('');

  // FAQ state
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);

  // Sync from server only on initial load
  const hasSynced = useRef(false);
  useEffect(() => {
    if (!data || hasSynced.current) return;
    hasSynced.current = true;
    const b = data.banner as BannerConfig | undefined;
    if (b) setBanner(b);
    const demo = data.demo_addresses as { address_id?: number } | undefined;
    if (demo?.address_id) setDemoAddressId(String(demo.address_id));
    const faq = data.faq as { items?: Omit<FAQItem, 'id'>[] } | undefined;
    if (faq?.items) setFaqItems(faq.items.map((f) => ({ ...f, id: nextFaqId() })));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Announcement Banner */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Announcement Banner</h3>
        <Card className="space-y-3 p-4">
          <Input
            placeholder="Banner text..."
            value={banner.text}
            onChange={(e) => setBanner({ ...banner, text: e.target.value })}
            maxLength={200}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(['info', 'warning', 'success'] as const).map((t) => (
                <Button
                  key={t}
                  variant={banner.type === t ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setBanner({ ...banner, type: t })}
                >
                  {t}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setBanner({ ...banner, active: !banner.active })}
            >
              {banner.active ? 'Active' : 'Inactive'}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={updateContent.isPending}
              onClick={() => updateContent.mutate({ key: 'banner', body: banner })}
            >
              {updateContent.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              Save Banner
            </Button>
          </div>
        </Card>
      </section>

      {/* Demo Address */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Demo Address</h3>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="Address ID (e.g. 1753062)"
              value={demoAddressId}
              onChange={(e) => setDemoAddressId(e.target.value)}
              className="max-w-xs"
            />
            <Button
              size="sm"
              disabled={!demoAddressId || updateContent.isPending}
              onClick={() =>
                updateContent.mutate({
                  key: 'demo_addresses',
                  body: { address_id: parseInt(demoAddressId, 10) },
                })
              }
            >
              Update
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The address loaded on first visit (default: 162 Cuba Street = 1753062)
          </p>
        </Card>
      </section>

      {/* FAQ Management */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            FAQ{' '}
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {faqItems.length}
            </Badge>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFaqItems([...faqItems, { id: nextFaqId(), question: '', answer: '' }])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Question
          </Button>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <Card key={item.id} className="space-y-2 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 text-xs text-muted-foreground">Q{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Question"
                    value={item.question}
                    onChange={(e) => {
                      const next = [...faqItems];
                      next[i] = { ...next[i], question: e.target.value };
                      setFaqItems(next);
                    }}
                  />
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Answer"
                    rows={2}
                    value={item.answer}
                    onChange={(e) => {
                      const next = [...faqItems];
                      next[i] = { ...next[i], answer: e.target.value };
                      setFaqItems(next);
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setFaqItems(faqItems.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {faqItems.length > 0 && (
          <Button
            disabled={updateContent.isPending}
            onClick={() =>
              updateContent.mutate({
                key: 'faq',
                body: { items: faqItems.map(({ question, answer }) => ({ question, answer })) },
              })
            }
          >
            {updateContent.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save All FAQ
          </Button>
        )}
      </section>
    </div>
  );
}

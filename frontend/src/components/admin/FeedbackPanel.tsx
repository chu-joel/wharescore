'use client';

import { useState } from 'react';
import {
  useAdminFeedback,
  useUpdateFeedbackStatus,
  type FeedbackItem,
} from '@/hooks/useAdminFeedback';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_OPTIONS = ['new', 'reviewed', 'resolved', 'wontfix'] as const;

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  reviewed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  wontfix: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const TYPE_FILTERS = ['All', 'bug', 'feature', 'general'] as const;
const STATUS_FILTERS = ['All', ...STATUS_OPTIONS] as const;

function FeedbackRow({
  item,
  onUpdateStatus,
  isUpdating,
}: {
  item: FeedbackItem;
  onUpdateStatus: (id: number, status: string) => void;
  isUpdating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <Badge variant="outline" className="text-[10px] shrink-0">
          {item.type}
        </Badge>
        <span className="flex-1 truncate text-sm">{item.description}</span>
        <Badge variant="secondary" className={`shrink-0 text-[10px] ${STATUS_COLORS[item.status] ?? ''}`}>
          {item.status}
        </Badge>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
          <p className="text-sm whitespace-pre-wrap">{item.description}</p>

          {item.context && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Context:</span>
              <p className="text-sm">{item.context}</p>
            </div>
          )}
          {item.page_url && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Page:</span>
              <p className="text-sm break-all">{item.page_url}</p>
            </div>
          )}
          {item.property_address && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Property:</span>
              <p className="text-sm">{item.property_address}</p>
            </div>
          )}
          {item.email && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Email:</span>
              <p className="text-sm">{item.email}</p>
            </div>
          )}
          {item.satisfaction !== null && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Satisfaction: {item.satisfaction}/5
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Status:</span>
            {STATUS_OPTIONS.map((s) => (
              <Button
                key={s}
                variant={item.status === s ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(item.id, s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FeedbackPanel() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const updateStatus = useUpdateFeedbackStatus();

  const { data, isLoading } = useAdminFeedback(
    page,
    typeFilter === 'All' ? undefined : typeFilter,
    statusFilter === 'All' ? undefined : statusFilter,
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          {TYPE_FILTERS.map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setTypeFilter(t); setPage(1); }}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No feedback found
          </p>
        ) : (
          data.items.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
              isUpdating={updateStatus.isPending}
            />
          ))
        )}
      </Card>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data.total} total &middot; Page {data.page}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

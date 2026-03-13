'use client';

import { useAdminDataHealth } from '@/hooks/useAdminDataHealth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Database, Server } from 'lucide-react';

function formatCount(n: number | 'error'): string {
  if (n === 'error') return 'Error';
  return n.toLocaleString();
}

export function DataHealthPanel() {
  const { data, isLoading } = useAdminDataHealth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const tables = Object.entries(data.tables).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      {/* Service Status */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(data.services).map(([name, ok]) => (
          <Card key={name} className="flex items-center gap-2 px-4 py-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium capitalize">{name}</span>
            {ok ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">Offline</Badge>
            )}
          </Card>
        ))}
      </div>

      {/* Table Stats */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Table</th>
                <th className="px-4 py-2 text-right font-medium">Records</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tables.map(([name, count]) => (
                <tr key={name} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <code className="text-xs">{name}</code>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCount(count)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {count === 'error' ? (
                      <XCircle className="mx-auto h-4 w-4 text-destructive" />
                    ) : count === 0 ? (
                      <span className="text-xs text-muted-foreground">Empty</span>
                    ) : (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        {tables.length} tables &middot;{' '}
        {tables.filter(([, c]) => typeof c === 'number' && c > 0).length} with data &middot;{' '}
        {tables.filter(([, c]) => c === 'error').length} errors
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database, Download, CheckCircle2, XCircle, Loader2, Clock,
} from 'lucide-react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { apiFetch } from '@/lib/api';

interface DataSourceInfo {
  key: string;
  label: string;
  tables: Record<string, number>;
  total_rows: number;
  loaded_at: string | null;
  status: 'loaded' | 'empty';
}

interface ActiveJob {
  id: string;
  source: string;
  status: 'running' | 'completed' | 'failed';
  progress?: string[];
  rows?: number;
  error?: string;
}

export function DataLoaderPanel() {
  const [sources, setSources] = useState<DataSourceInfo[]>([]);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const { getToken } = useAuthToken();

  const fetchSources = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<{ sources: DataSourceInfo[]; active_job: ActiveJob | null }>(
        '/api/v1/admin/data-sources',
        { token: token ?? undefined },
      );
      setSources(data.sources);
      setActiveJob(data.active_job);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Initial load
  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Poll when job is running
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        const data = await apiFetch<{ active_job: ActiveJob | null }>(
          '/api/v1/admin/data-sources/job',
          { token: token ?? undefined },
        );
        setActiveJob(data.active_job);
        if (data.active_job?.status !== 'running') {
          fetchSources();
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeJob, fetchSources, getToken]);

  const handleLoad = async (sourceKey: string) => {
    setTriggering(sourceKey);
    try {
      const token = await getToken();
      const data = await apiFetch<{ job_id: string; status: string }>(
        `/api/v1/admin/data-sources/${sourceKey}/load`,
        { method: 'POST', token: token ?? undefined },
      );
      setActiveJob({ id: data.job_id, source: sourceKey, status: 'running' });
    } catch (e) {
      alert(`Failed to start load: ${e}`);
    } finally {
      setTriggering(null);
    }
  };

  const handleClearJob = async () => {
    try {
      const token = await getToken();
      await apiFetch('/api/v1/admin/data-sources/job', { method: 'DELETE', token: token ?? undefined });
      setActiveJob(null);
      fetchSources();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading data sources...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Data Loader</h2>
        <p className="text-sm text-muted-foreground">
          Load Wellington-specific datasets from external APIs. Each source fetches
          data, transforms coordinates, and inserts into the database.
        </p>
      </div>

      {/* Active job banner */}
      {activeJob && (
        <Card className="p-4 border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {activeJob.status === 'running' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : activeJob.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-bold">
                  {activeJob.status === 'running' ? 'Loading...' :
                   activeJob.status === 'completed' ? 'Load Complete' : 'Load Failed'}
                </span>
                <Badge variant="secondary">{activeJob.source}</Badge>
              </div>
              {activeJob.progress && activeJob.progress.length > 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  {activeJob.progress[activeJob.progress.length - 1]}
                </p>
              )}
              {activeJob.rows != null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {activeJob.rows.toLocaleString()} rows loaded
                </p>
              )}
              {activeJob.error && (
                <p className="text-xs text-red-600 mt-1">{activeJob.error}</p>
              )}
            </div>
            {activeJob.status !== 'running' && (
              <button
                onClick={handleClearJob}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Source cards */}
      <div className="space-y-3">
        {sources.map((src) => {
          const isRunning = activeJob?.source === src.key && activeJob?.status === 'running';
          const isTriggering = triggering === src.key;
          const hasAnyJob = activeJob?.status === 'running';

          return (
            <Card key={src.key} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-bold">{src.label}</span>
                    {src.total_rows > 0 ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {src.total_rows.toLocaleString()} rows
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Empty</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {Object.entries(src.tables).map(([table, count]) => (
                      <span key={table}>
                        <code>{table}</code>: {typeof count === 'number' ? count.toLocaleString() : '?'}
                      </span>
                    ))}
                  </div>
                  {src.loaded_at && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last loaded: {new Date(src.loaded_at).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleLoad(src.key)}
                  disabled={isRunning || isTriggering || hasAnyJob}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                    bg-piq-primary text-white hover:bg-piq-primary/90
                    disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-4"
                >
                  {isRunning || isTriggering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {isRunning ? 'Loading...' : src.total_rows > 0 ? 'Reload' : 'Load'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Data is fetched from GWRC, WCC, and Metlink APIs. Loading takes 1-5 minutes per source.
        Report cache is automatically cleared after each load.
      </p>
    </div>
  );
}

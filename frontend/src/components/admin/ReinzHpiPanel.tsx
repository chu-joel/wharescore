'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { useAuthToken } from '@/hooks/useAuthToken';
import { apiFetch } from '@/lib/api';

interface MonthRow {
  month_end: string;
  total: number;
  with_cgr: number;
}

interface UploadResult {
  month_end: string;
  inserted: number;
  updated: number;
}

const EXAMPLE = `{
  "month_end": "2026-04-30",
  "rows": [
    {
      "ta_name": "Christchurch City",
      "hpi": 3795,
      "calculated": "Actual Month",
      "change_1m_pct": -0.1,
      "change_3m_pct": 2.9,
      "change_1y_pct": 4.5,
      "change_5y_cgr_pct": 4.7
    },
    { "ta_name": "Ashburton District", "hpi": 4094, "calculated": "3 month rolling" }
  ]
}`;

export function ReinzHpiPanel() {
  const { getToken } = useAuthToken();
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [jsonInput, setJsonInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<'ok' | 'err' | null>(null);

  const fetchMonths = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await apiFetch<{ months: MonthRow[] }>('/api/v1/admin/reinz-hpi', {
        token: token ?? undefined,
      });
      setMonths(data.months);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  const handleUpload = async () => {
    setUploadError(null);
    setUploadResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch (err) {
      setUploadError(`JSON parse error: ${(err as Error).message}`);
      return;
    }
    setUploading(true);
    try {
      const token = await getToken();
      const data = await apiFetch<UploadResult>('/api/v1/admin/reinz-hpi/upload', {
        method: 'POST',
        token: token ?? undefined,
        body: JSON.stringify(parsed),
      });
      setUploadResult(data);
      fetchMonths();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleFlush = async () => {
    setFlushResult(null);
    setFlushing(true);
    try {
      const token = await getToken();
      await apiFetch('/api/v1/admin/cache/flush', {
        method: 'POST',
        token: token ?? undefined,
      });
      setFlushResult('ok');
    } catch {
      setFlushResult('err');
    } finally {
      setFlushing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">REINZ HPI</h1>
        <p className="text-sm text-muted-foreground">
          Upload the monthly REINZ House Price Index by territorial authority. Used by{' '}
          <code>price_advisor</code> to back-calculate HPI from each property&apos;s reval date.
        </p>
      </div>

      {/* Loaded months */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Months loaded</h2>
          <Badge variant="outline">{months.length}</Badge>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet. Upload a month below.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2">Month</th>
                <th className="pb-2 text-right">TAs</th>
                <th className="pb-2 text-right">With 5yr CGR</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month_end} className="border-t">
                  <td className="py-1.5 tabular-nums">{m.month_end}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.total}</td>
                  <td className="py-1.5 text-right tabular-nums">{m.with_cgr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Upload */}
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Upload a new month</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Download the REINZ Monthly HPI Report PDF, drop it in a Claude chat with &ldquo;extract
          page 14 full TA table and page 6 summary-of-movements into the JSON shape below&rdquo;,
          paste the result here, and click Upload. Same shape every month. See{' '}
          <code>docs/RUNBOOK-REINZ-HPI.md</code>.
        </p>
        <details className="mb-3 text-xs">
          <summary className="cursor-pointer font-medium">Show example JSON shape</summary>
          <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">{EXAMPLE}</pre>
        </details>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"month_end": "YYYY-MM-DD", "rows": [...]}'
          className="h-64 w-full rounded-md border bg-background p-3 font-mono text-xs"
          spellCheck={false}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={handleUpload} disabled={uploading || !jsonInput.trim()}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
          {uploadResult && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {uploadResult.month_end}: {uploadResult.inserted} inserted,{' '}
              {uploadResult.updated} updated
            </span>
          )}
          {uploadError && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
              <XCircle className="h-4 w-4" />
              {uploadError}
            </span>
          )}
        </div>
      </Card>

      {/* Flush Redis */}
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Flush Redis cache</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Run this after uploading. Evicts 24h-cached reports and price-advisor responses so
          users see the new HPI immediately. Safe to run any time — next request rebuilds the
          cache.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleFlush} disabled={flushing}>
            {flushing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Flushing…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                FLUSHDB
              </>
            )}
          </Button>
          {flushResult === 'ok' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Flushed
            </span>
          )}
          {flushResult === 'err' && (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
              <XCircle className="h-4 w-4" /> Flush failed — check server logs
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAdminRecommendations,
  useUpdateRecommendations,
  type RecommendationRule,
} from '@/hooks/useAdminRecommendations';

const SEVERITY_OPTIONS = ['critical', 'important', 'advisory'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  universal: 'Universal',
  hazards: 'Hazards',
  environment: 'Environment',
  liveability: 'Liveability',
  market: 'Market',
  planning: 'Planning',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  important: 'bg-amber-100 text-amber-800',
  advisory: 'bg-blue-100 text-blue-800',
};

type Override = {
  disabled?: boolean;
  severity?: string;
  title?: string;
  actions?: string[];
};

export function RecommendationsPanel() {
  const { data, isLoading, error } = useAdminRecommendations();
  const updateMutation = useUpdateRecommendations();

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Sync from server on first load only
  useEffect(() => {
    if (data && !initializedRef.current) {
      initializedRef.current = true;
      const ovr: Record<string, Override> = {};
      for (const rule of data.rules) {
        const hasOverride =
          rule.disabled ||
          rule.severity_override ||
          rule.title_override ||
          (rule.actions_override && rule.actions_override.length > 0);
        if (hasOverride) {
          ovr[rule.id] = {
            ...(rule.disabled && { disabled: true }),
            ...(rule.severity_override && { severity: rule.severity_override }),
            ...(rule.title_override && { title: rule.title_override }),
            ...(rule.actions_override &&
              rule.actions_override.length > 0 && {
                actions: rule.actions_override,
              }),
          };
        }
      }
      setOverrides(ovr);
    }
  }, [data]);

  const getOverride = useCallback(
    (id: string): Override => overrides[id] || {},
    [overrides],
  );

  const setOverride = useCallback(
    (id: string, patch: Partial<Override>) => {
      setOverrides((prev) => {
        const existing = prev[id] || {};
        const merged = { ...existing, ...patch };
        // Clean up no-op keys
        if (!merged.disabled) delete merged.disabled;
        if (!merged.severity) delete merged.severity;
        if (!merged.title) delete merged.title;
        if (!merged.actions?.length) delete merged.actions;
        if (Object.keys(merged).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: merged };
      });
    },
    [],
  );

  const handleSave = () => {
    updateMutation.mutate(overrides);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-destructive">Failed to load recommendations.</p>
    );
  }

  // Group rules by category
  const grouped: Record<string, RecommendationRule[]> = {};
  for (const rule of data.rules) {
    const cat = rule.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rule);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Recommendation Rules</h2>
          <p className="text-sm text-muted-foreground">
            Edit action items, titles, and severity for property report
            recommendations. Use{' '}
            <code className="rounded bg-muted px-1 text-xs">
              {'{placeholder}'}
            </code>{' '}
            syntax for dynamic property values.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {updateMutation.isSuccess && (
        <p className="text-sm text-green-600">Saved successfully.</p>
      )}
      {updateMutation.isError && (
        <p className="text-sm text-destructive">
          Failed to save. Please try again.
        </p>
      )}

      {Object.entries(grouped).map(([category, rules]) => (
        <div key={category} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 px-3 py-2 text-left">On</th>
                  <th className="px-3 py-2 text-left">Rule</th>
                  <th className="w-28 px-3 py-2 text-left">Severity</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const ovr = getOverride(rule.id);
                  const isDisabled = ovr.disabled ?? false;
                  const effectiveSeverity = ovr.severity || rule.severity;
                  const effectiveTitle = ovr.title || rule.title;
                  const isExpanded = expandedId === rule.id;
                  const hasCustomActions = !!ovr.actions?.length;
                  const isModified =
                    rule.severity !== effectiveSeverity ||
                    rule.title !== effectiveTitle ||
                    hasCustomActions;

                  return (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      isDisabled={isDisabled}
                      isModified={isModified}
                      effectiveSeverity={effectiveSeverity}
                      effectiveTitle={effectiveTitle}
                      customActions={ovr.actions || null}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setOverride(rule.id, { disabled: !isDisabled })
                      }
                      onSeverityChange={(s) =>
                        setOverride(rule.id, {
                          severity: s === rule.severity ? undefined : s,
                        })
                      }
                      onTitleChange={(t) =>
                        setOverride(rule.id, {
                          title:
                            t === rule.title ? undefined : t || undefined,
                        })
                      }
                      onExpand={() =>
                        setExpandedId(isExpanded ? null : rule.id)
                      }
                      onSetCustomActions={(actions) =>
                        setOverride(rule.id, { actions })
                      }
                      onClearCustomActions={() =>
                        setOverride(rule.id, { actions: undefined })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Row sub-component ──────────────────────────────────────────────────────

interface RuleRowProps {
  rule: RecommendationRule;
  isDisabled: boolean;
  isModified: boolean;
  effectiveSeverity: string;
  effectiveTitle: string;
  customActions: string[] | null;
  isExpanded: boolean;
  onToggle: () => void;
  onSeverityChange: (s: string) => void;
  onTitleChange: (t: string) => void;
  onExpand: () => void;
  onSetCustomActions: (actions: string[]) => void;
  onClearCustomActions: () => void;
}

function RuleRow({
  rule,
  isDisabled,
  isModified,
  effectiveSeverity,
  effectiveTitle,
  customActions,
  isExpanded,
  onToggle,
  onSeverityChange,
  onTitleChange,
  onExpand,
  onSetCustomActions,
  onClearCustomActions,
}: RuleRowProps) {
  const [newAction, setNewAction] = useState('');

  // The actions currently being shown/edited
  const displayActions = customActions ?? rule.default_actions;
  const isUsingCustom = customActions !== null;

  const handleEditAction = (idx: number, value: string) => {
    const updated = [...displayActions];
    updated[idx] = value;
    onSetCustomActions(updated);
  };

  const handleRemoveAction = (idx: number) => {
    const updated = displayActions.filter((_, i) => i !== idx);
    onSetCustomActions(updated);
  };

  const handleAddAction = () => {
    if (!newAction.trim()) return;
    onSetCustomActions([...displayActions, newAction.trim()]);
    setNewAction('');
  };

  const handleMoveAction = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= displayActions.length) return;
    const updated = [...displayActions];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    onSetCustomActions(updated);
  };

  const handleStartEditing = () => {
    // Pre-fill with defaults so the admin can edit from existing text
    onSetCustomActions([...rule.default_actions]);
  };

  return (
    <>
      <tr
        className={`border-b last:border-0 transition-colors ${
          isDisabled ? 'opacity-50' : ''
        }`}
      >
        {/* Toggle */}
        <td className="px-3 py-2">
          <button
            onClick={onToggle}
            className={`h-5 w-9 rounded-full transition-colors ${
              isDisabled ? 'bg-muted' : 'bg-green-500'
            } relative`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                isDisabled ? 'left-0.5' : 'left-[18px]'
              }`}
            />
          </button>
        </td>

        {/* Title */}
        <td className="px-3 py-2">
          <span className="font-medium">{effectiveTitle}</span>
          {isModified && (
            <span className="ml-2 text-xs text-amber-600">modified</span>
          )}
          <span className="ml-2 text-xs text-muted-foreground">
            {rule.id}
          </span>
        </td>

        {/* Severity badge */}
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              SEVERITY_COLORS[effectiveSeverity] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {effectiveSeverity}
          </span>
        </td>

        {/* Expand button */}
        <td className="px-3 py-2 text-center">
          <button
            onClick={onExpand}
            className="text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? '\u25B2' : '\u25BC'}
          </button>
        </td>
      </tr>

      {/* Expanded editor */}
      {isExpanded && (
        <tr className="border-b bg-muted/30">
          <td colSpan={4} className="px-4 py-3">
            <div className="space-y-4">
              {/* Title + Severity row */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Title
                  </label>
                  <input
                    type="text"
                    value={effectiveTitle}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                  {effectiveTitle !== rule.title && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Default: {rule.title}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Severity
                  </label>
                  <select
                    value={effectiveSeverity}
                    onChange={(e) => onSeverityChange(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">
                    Action Items ({displayActions.length})
                    {isUsingCustom && (
                      <span className="ml-1 text-amber-600">(edited)</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    {!isUsingCustom && (
                      <button
                        onClick={handleStartEditing}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Edit actions
                      </button>
                    )}
                    {isUsingCustom && (
                      <button
                        onClick={onClearCustomActions}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Revert to defaults
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {displayActions.map((action, idx) => (
                    <div key={idx} className="flex gap-1.5">
                      <span className="mt-2 shrink-0 text-xs text-muted-foreground">
                        {idx + 1}.
                      </span>
                      {isUsingCustom ? (
                        <textarea
                          value={action}
                          onChange={(e) =>
                            handleEditAction(idx, e.target.value)
                          }
                          rows={2}
                          className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <p className="flex-1 py-1.5 text-sm text-muted-foreground">
                          {action}
                        </p>
                      )}
                      {isUsingCustom && (
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <button
                            onClick={() => handleMoveAction(idx, -1)}
                            disabled={idx === 0}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Move up"
                          >
                            &#9650;
                          </button>
                          <button
                            onClick={() => handleMoveAction(idx, 1)}
                            disabled={idx === displayActions.length - 1}
                            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                            title="Move down"
                          >
                            &#9660;
                          </button>
                          <button
                            onClick={() => handleRemoveAction(idx)}
                            className="text-xs text-destructive hover:underline"
                            title="Remove"
                          >
                            &#10005;
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add new action (only in edit mode) */}
                {isUsingCustom && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newAction}
                      onChange={(e) => setNewAction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAction();
                        }
                      }}
                      placeholder="Add new action item..."
                      className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={handleAddAction}
                      className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium hover:bg-muted/80"
                    >
                      Add
                    </button>
                  </div>
                )}

                {/* Placeholder hints */}
                {rule.placeholders.length > 0 && isUsingCustom && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Available placeholders:{' '}
                    {rule.placeholders.map((p) => (
                      <code
                        key={p}
                        className="mr-1 rounded bg-muted px-1"
                      >
                        {`{${p}}`}
                      </code>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

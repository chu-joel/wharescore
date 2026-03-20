'use client';

import { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '@/lib/format';

interface BudgetSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: 'currency' | 'percent' | 'years' | 'number';
  suffix?: string;
}

function formatValue(value: number, format: BudgetSliderProps['format'], suffix?: string): string {
  switch (format) {
    case 'currency':
      return formatCurrency(Math.round(value));
    case 'percent':
      return `${value % 1 === 0 ? value : value.toFixed(2)}%`;
    case 'years':
      return `${value} years`;
    case 'number':
      return `${value}${suffix ?? ''}`;
    default:
      return formatCurrency(Math.round(value));
  }
}

export function BudgetSlider({ label, value, min, max, step, onChange, format = 'currency', suffix }: BudgetSliderProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleStartEdit = () => {
    setInputVal(String(Math.round(value)));
    setEditing(true);
  };

  const handleSave = () => {
    const raw = inputVal.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      // Clamp to min/max, snap to step
      const clamped = Math.min(max, Math.max(min, parsed));
      const snapped = Math.round(clamped / step) * step;
      onChange(snapped);
    }
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={handleSave}
            className="w-24 h-6 px-2 text-xs font-medium tabular-nums text-right rounded border border-piq-primary bg-background focus:outline-none focus:ring-1 focus:ring-piq-primary"
          />
        ) : (
          <button
            onClick={handleStartEdit}
            className="text-xs font-medium tabular-nums hover:text-piq-primary hover:underline underline-offset-2 transition-colors cursor-text"
            title="Click to type a value"
          >
            {formatValue(value, format, suffix)}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted/60 accent-piq-primary cursor-pointer"
      />
    </div>
  );
}

'use client';

import { MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { getRatingBin } from '@/lib/constants';

interface RecentSearchesProps {
  /** Compact mode for mobile bottom sheet peek state */
  compact?: boolean;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentSearches({ compact = false }: RecentSearchesProps) {
  const { items, clearAll } = useRecentSearches();
  const selectAddress = useSearchStore((s) => s.selectAddress);
  const selectProperty = useMapStore((s) => s.selectProperty);

  if (items.length === 0) return null;

  const handleSelect = (item: typeof items[0]) => {
    selectAddress({
      addressId: item.addressId,
      fullAddress: item.fullAddress,
      lng: item.lng ?? 0,
      lat: item.lat ?? 0,
    });
    if (item.lng && item.lat) {
      selectProperty(item.addressId, item.lng, item.lat);
    }
  };

  // Compact mode: show max 3 items, minimal UI
  if (compact) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          Recent
        </p>
        <div className="space-y-0.5">
          {items.slice(0, 3).map((item) => (
            <button
              key={item.addressId}
              onClick={() => handleSelect(item)}
              className="flex items-center gap-2 w-full py-1.5 text-left hover:text-piq-primary transition-colors"
            >
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs truncate">{item.fullAddress}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Full mode: all items with score badges
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recent Searches
        </p>
        <button
          onClick={clearAll}
          className="text-xs text-piq-primary hover:underline"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const bin = item.score != null ? getRatingBin(item.score) : null;
          return (
            <li key={item.addressId}>
              <button
                onClick={() => handleSelect(item)}
                className="flex items-center gap-3 w-full px-3 py-2 text-left rounded-lg hover:bg-muted transition-colors"
              >
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{item.fullAddress}</span>
                {bin && (
                  <Badge
                    className="text-xs text-white shrink-0"
                    style={{ backgroundColor: bin.color }}
                  >
                    {Math.round(item.score!)}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {timeAgo(item.timestamp)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { BookmarkCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSavedProperties } from '@/hooks/useSavedProperties';
import { useSearchStore } from '@/stores/searchStore';
import { useMapStore } from '@/stores/mapStore';
import { getRatingBin } from '@/lib/constants';

export function SavedProperties() {
  const { items, remove } = useSavedProperties();
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

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Saved Properties
        </p>
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const bin = item.score != null ? getRatingBin(item.score) : null;
          return (
            <li key={item.addressId} className="flex items-center">
              <button
                onClick={() => handleSelect(item)}
                className="flex items-center gap-3 flex-1 px-3 py-2 text-left rounded-lg hover:bg-muted transition-colors min-w-0"
              >
                <BookmarkCheck className="h-4 w-4 text-piq-primary shrink-0" />
                <span className="text-sm truncate flex-1">{item.fullAddress}</span>
                {bin && (
                  <Badge
                    className="text-[10px] text-white shrink-0"
                    style={{ backgroundColor: bin.color }}
                  >
                    {Math.round(item.score!)}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => remove(item.addressId)}
                className="p-2 text-muted-foreground hover:text-foreground shrink-0 rounded-lg hover:bg-muted transition-colors"
                aria-label="Remove bookmark"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

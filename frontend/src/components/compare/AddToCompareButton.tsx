'use client';

import { GitCompare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComparisonStore, COMPARE_MAX_ANONYMOUS } from '@/stores/comparisonStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'icon' | 'menu-item' | 'mobile-action';

interface AddToCompareButtonProps {
  addressId: number;
  fullAddress: string;
  suburb: string;
  city: string;
  lat: number;
  lng: number;
  variant?: Variant;
  className?: string;
}

export function AddToCompareButton({
  addressId,
  fullAddress,
  suburb,
  city,
  lat,
  lng,
  variant = 'primary',
  className,
}: AddToCompareButtonProps) {
  const items = useComparisonStore((s) => s.items);
  const add = useComparisonStore((s) => s.add);
  const remove = useComparisonStore((s) => s.remove);
  const staged = items.some((i) => i.addressId === addressId);

  // Staging deliberately does NOT close the property panel or change the
  // URL. The user expects to stay where they are; they can navigate to
  // another property when they're ready (map click or new search).
  const handleClick = () => {
    if (staged) {
      remove(addressId);
      toast('Removed from comparison');
      return;
    }
    const result = add({ addressId, fullAddress, suburb, city, lat, lng });
    if (!result.ok) {
      if (result.reason === 'cap') {
        toast(`Comparing the maximum of ${COMPARE_MAX_ANONYMOUS} properties`, {
          description: 'Remove one from the tray to add this property.',
        });
      }
      return;
    }
    const newCount = items.length + 1;
    if (newCount === COMPARE_MAX_ANONYMOUS) {
      toast.success('Added — ready to compare', {
        description: 'Open the tray to view side-by-side.',
      });
    } else {
      toast.success('Added to comparison', {
        description: 'Pick another property to compare it with.',
      });
    }
  };

  const Icon = staged ? Check : GitCompare;
  const label = staged ? 'In comparison' : 'Add to compare';

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-pressed={staged}
        aria-label={label}
        onClick={handleClick}
        className={cn(
          'transition-colors',
          staged && 'text-piq-primary bg-piq-primary/10 hover:bg-piq-primary/15',
          className,
        )}
      >
        <Icon className="size-4" />
      </Button>
    );
  }

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={staged}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors',
          staged && 'text-piq-primary',
          className,
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'mobile-action') {
    return (
      <Button
        type="button"
        size="lg"
        variant={staged ? 'default' : 'outline'}
        aria-pressed={staged}
        onClick={handleClick}
        className={cn(
          'h-10 w-full gap-2 transition-all',
          staged
            ? 'bg-piq-primary text-white hover:bg-piq-primary-dark'
            : 'border-piq-primary text-piq-primary hover:bg-piq-primary/5',
          'active:scale-[0.98]',
          className,
        )}
      >
        <Icon className="size-4" />
        {label}
      </Button>
    );
  }

  // primary — deliberately quieter than the report-action buttons.
  // Transparent fill + teal outline + teal text so it reads as a secondary
  // action and doesn't compete with the primary "Generate Report" CTA.
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={staged}
      onClick={handleClick}
      className={cn(
        'h-8 gap-1.5 text-xs font-medium transition-all bg-transparent',
        staged
          ? 'border-piq-primary text-piq-primary bg-piq-primary/10 hover:bg-piq-primary/15'
          : 'border-piq-primary/60 text-piq-primary hover:bg-piq-primary/5 hover:border-piq-primary',
        'active:scale-[0.97]',
        className,
      )}
    >
      <Icon className="size-3.5" />
      {staged ? 'In comparison' : 'Compare'}
    </Button>
  );
}

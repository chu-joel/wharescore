'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { GitCompare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

const PENDING_PARAM = 'compareAdd';

/**
 * Add/remove the property from the compare tray.
 *
 * Auth gating: a user can stage their FIRST property anonymously (so they
 * see the tray pill appear and understand the feature exists). Adding a
 * SECOND property requires sign-in — the prompt fires at the moment the
 * user has demonstrated intent ("I want to compare these two") so signing
 * up has obvious payoff. /signin?callbackUrl=… brings them back to this
 * exact page with `?compareAdd=<id>` so the staged-on-add action
 * completes automatically post-auth (see the useEffect below).
 */
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
  const { status } = useSession();
  const isSignedIn = status === 'authenticated';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const staged = items.some((i) => i.addressId === addressId);

  // After sign-in we may land back on the property page with
  // ?compareAdd=<id>. If that id matches THIS button's addressId and the
  // user is now signed in, finish what they started: stage the property
  // and clean the URL.
  const handledRef = useRef(false);
  useEffect(() => {
    if (handledRef.current) return;
    if (!isSignedIn) return;
    const pending = parseInt(searchParams.get(PENDING_PARAM) ?? '', 10);
    if (Number.isFinite(pending) && pending === addressId && !staged) {
      handledRef.current = true;
      const result = add({ addressId, fullAddress, suburb, city, lat, lng });
      if (result.ok) {
        toast.success('Added to comparison', {
          description: 'Ready to compare side by side.',
        });
      }
      // Strip the param so a refresh doesn't try to add again.
      const params = new URLSearchParams(searchParams.toString());
      params.delete(PENDING_PARAM);
      const next = params.toString();
      router.replace(pathname + (next ? `?${next}` : ''), { scroll: false });
    }
  }, [
    isSignedIn,
    searchParams,
    addressId,
    staged,
    add,
    fullAddress,
    suburb,
    city,
    lat,
    lng,
    router,
    pathname,
  ]);

  const handleClick = () => {
    if (staged) {
      remove(addressId);
      toast('Removed from comparison');
      return;
    }

    // Anonymous gate: first item is free, second requires sign-in. The
    // user sees the tray work once before being asked to sign up.
    if (!isSignedIn && items.length >= 1) {
      const callbackPath = pathname || '/';
      const callbackParams = new URLSearchParams(searchParams.toString());
      callbackParams.set(PENDING_PARAM, String(addressId));
      const callback = `${callbackPath}?${callbackParams.toString()}`;
      toast(`Sign in to add ${fullAddress.split(',')[0]} to your comparison`, {
        description: 'Free with an account, takes about 10 seconds.',
      });
      router.push(`/signin?callbackUrl=${encodeURIComponent(callback)}`);
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
        description: isSignedIn
          ? 'Pick another property to compare it with.'
          : 'Add another to compare — sign in needed for the second.',
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

  // primary — icon-only square button with a tooltip. Earlier the labelled
  // pill was crowding the persona toggle ("I'm buying / renting") in the
  // property report header. Going icon-only makes the action discoverable
  // without competing for horizontal real estate.
  const tooltipLabel = staged ? 'Remove from comparison' : 'Add to compare';
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-pressed={staged}
              aria-label={tooltipLabel}
              onClick={handleClick}
              className={cn(
                'size-8 transition-all bg-transparent',
                staged
                  ? 'border-piq-primary text-piq-primary bg-piq-primary/10 hover:bg-piq-primary/15'
                  : 'border-piq-primary/60 text-piq-primary hover:bg-piq-primary/5 hover:border-piq-primary',
                'active:scale-[0.95]',
                className,
              )}
            >
              <Icon className="size-3.5" />
            </Button>
          }
        />
        <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

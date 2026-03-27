'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText, Check, Shield, Zap, Loader2, Gift } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { useAuthToken } from '@/hooks/useAuthToken';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useDownloadGateStore, type PlanType, type ModalTrigger } from '@/stores/downloadGateStore';
import { safeRedirect } from '@/lib/utils';
import { useRentInputStore } from '@/stores/rentInputStore';
import { useBuyerInputStore } from '@/stores/buyerInputStore';
import { useBudgetStore } from '@/stores/budgetStore';

function useInputReadiness(persona: string) {
  const rent = useRentInputStore();
  const buyer = useBuyerInputStore();

  if (persona === 'renter') {
    const required: { field: string; label: string; filled: boolean }[] = [
      { field: 'dwellingType', label: 'Property type', filled: !!rent.dwellingType },
      { field: 'bedrooms', label: 'Bedrooms', filled: !!rent.bedrooms },
      { field: 'finishTier', label: 'Finish/condition', filled: !!rent.finishTier },
      { field: 'bathrooms', label: 'Bathrooms', filled: !!rent.bathrooms },
    ];
    const optional: { field: string; label: string; filled: boolean }[] = [
      { field: 'weeklyRent', label: 'Weekly rent', filled: !!rent.weeklyRent },
    ];
    return { required, optional, allRequiredFilled: required.every(r => r.filled) };
  }

  // buyer
  const required: { field: string; label: string; filled: boolean }[] = [
    { field: 'bedrooms', label: 'Bedrooms', filled: !!buyer.bedrooms },
    { field: 'finishTier', label: 'Finish/condition', filled: !!buyer.finishTier },
    { field: 'bathrooms', label: 'Bathrooms', filled: !!buyer.bathrooms },
  ];
  const optional: { field: string; label: string; filled: boolean }[] = [
    { field: 'askingPrice', label: 'Asking price', filled: !!buyer.askingPrice },
  ];
  return { required, optional, allRequiredFilled: required.every(r => r.filled) };
}

const DWELLING_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'flat', label: 'Flat' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'room', label: 'Room' },
] as const;

const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4', '5+'] as const;

const FINISH_TIERS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'modern', label: 'Modern' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
] as const;

const BATHROOM_OPTIONS = ['1', '2', '3+'] as const;

function InputReadinessTip({ persona }: { persona: string }) {
  const { required, optional, allRequiredFilled } = useInputReadiness(persona);
  const missingRequired = required.filter(r => !r.filled);
  const missingOptional = optional.filter(r => !r.filled);

  const rentStore = useRentInputStore();
  const buyerStore = useBuyerInputStore();

  if (missingRequired.length === 0 && missingOptional.length === 0) return null;

  return (
    <div className={`rounded-lg border p-2.5 text-xs ${
      missingRequired.length > 0
        ? 'border-risk-high/30 bg-risk-high/5 text-risk-high'
        : 'border-piq-accent-warm/30 bg-piq-accent-warm/5 text-piq-accent-warm'
    }`}>
      {/* Inline inputs for missing required fields */}
      {missingRequired.length > 0 && (
        <div className="space-y-2">
          {persona === 'renter' && !rentStore.dwellingType && (
            <div>
              <p className="font-semibold mb-1">Property type</p>
              <div className="flex flex-wrap gap-1">
                {DWELLING_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => rentStore.setDwellingType(value)}
                    className="rounded-full border border-muted-foreground/30 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-piq-primary hover:text-piq-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {((persona === 'renter' && !rentStore.bedrooms) || (persona === 'buyer' && !buyerStore.bedrooms)) && (
            <div>
              <p className="font-semibold mb-1">Bedrooms</p>
              <div className="flex flex-wrap gap-1">
                {BEDROOM_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (persona === 'renter') rentStore.setBedrooms(opt);
                      else buyerStore.setBedrooms(opt);
                    }}
                    className="rounded-full border border-muted-foreground/30 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-piq-primary hover:text-piq-primary"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {((persona === 'renter' && !rentStore.finishTier) || (persona === 'buyer' && !buyerStore.finishTier)) && (
            <div>
              <p className="font-semibold mb-1">Finish / condition</p>
              <div className="flex flex-wrap gap-1">
                {FINISH_TIERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (persona === 'renter') rentStore.setFinishTier(value);
                      else buyerStore.setFinishTier(value);
                    }}
                    className="rounded-full border border-muted-foreground/30 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-piq-primary hover:text-piq-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {((persona === 'renter' && !rentStore.bathrooms) || (persona === 'buyer' && !buyerStore.bathrooms)) && (
            <div>
              <p className="font-semibold mb-1">Bathrooms</p>
              <div className="flex flex-wrap gap-1">
                {BATHROOM_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (persona === 'renter') rentStore.setBathrooms(opt);
                      else buyerStore.setBathrooms(opt);
                    }}
                    className="rounded-full border border-muted-foreground/30 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-piq-primary hover:text-piq-primary"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {missingOptional.length > 0 && (
        <p className={missingRequired.length > 0 ? 'mt-2 text-piq-accent-warm' : 'font-medium'}>
          For best results, also fill in: {missingOptional.map(r => r.label).join(', ')}
        </p>
      )}
      {missingRequired.length === 0 && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Close this and enter your details above — your report will include a personalised {persona === 'renter' ? 'rent' : 'value'} breakdown.
        </p>
      )}
    </div>
  );
}

const FEATURES = [
  'Premium PDF property report',
  'Risk & hazard analysis with maps',
  'AI-powered neighbourhood insights',
  'Rent fairness & market data',
  'School, transport & amenity breakdown',
] as const;

function getHeadline(
  credits: { plan: PlanType; creditsRemaining: number | null; dailyLimit: number | null; monthlyLimit: number | null; downloadsToday: number; downloadsThisMonth: number } | null,
  trigger: ModalTrigger,
  context: Record<string, number | string>,
) {
  // Credit/limit states take priority
  if (credits?.plan === 'pro') {
    if (credits.dailyLimit && credits.downloadsToday >= credits.dailyLimit) {
      return `You've downloaded ${credits.dailyLimit} reports today. Resets at midnight.`;
    }
    if (credits.monthlyLimit && credits.downloadsThisMonth >= credits.monthlyLimit) {
      return `You've used all ${credits.monthlyLimit} reports this month.`;
    }
  }
  if (credits?.creditsRemaining !== null && credits?.creditsRemaining !== undefined && credits.creditsRemaining <= 0 && credits.plan !== 'free' && credits.plan !== 'pro') {
    return "You've used all your credits";
  }

  // Contextual headlines based on trigger
  switch (trigger) {
    case 'risk': {
      const count = Number(context.riskCount ?? 0);
      if (count >= 3) return `${count} risk findings affect this property`;
      if (count >= 1) return `${count} finding${count > 1 ? 's' : ''} to review before deciding`;
      return 'Download your property report';
    }
    case 'market':
      return 'Is this property fairly priced?';
    case 'rent-advisor':
      return 'Get your full personalised rent analysis';
    case 'comparing':
      return 'Comparing properties? Save with a 3-pack';
    default:
      return 'Download your property report';
  }
}

function getDescription(trigger: ModalTrigger): string {
  switch (trigger) {
    case 'risk':
      return 'Get the complete hazard analysis with maps, AI insights, and personalised recommendations.';
    case 'market':
      return 'See fair rent estimates, market trends, and how this property compares to the suburb.';
    case 'rent-advisor':
      return 'Your report includes all adjustment factors, area context, negotiation advice, and insurance flags. Fill in property type, bedrooms, rent, and finish details above for the most accurate analysis.';
    case 'comparing':
      return 'The 3-pack lets you compare properties side by side. One report per property, $3.33 each.';
    default:
      return 'Everything the listing doesn\u2019t tell you \u2014 hazards, risk scores, neighbourhood insights, and more in a premium PDF.';
  }
}

export function UpgradeModal() {
  const showUpgradeModal = useDownloadGateStore((s) => s.showUpgradeModal);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const isAuthenticated = useDownloadGateStore((s) => s.isAuthenticated);
  const credits = useDownloadGateStore((s) => s.credits);
  const modalTrigger = useDownloadGateStore((s) => s.modalTrigger);
  const modalContext = useDownloadGateStore((s) => s.modalContext);
  const targetAddressId = useDownloadGateStore((s) => s.targetAddressId);
  const targetPersona = useDownloadGateStore((s) => s.targetPersona);
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;
  const { getToken } = useAuthToken();
  const [loading, setLoading] = useState<string | null>(null);
  const [canClose, setCanClose] = useState(false);

  // Delayed close button — force 3s look at modal (research: improves conversion)
  useEffect(() => {
    if (showUpgradeModal) {
      setCanClose(false);
      const t = setTimeout(() => setCanClose(true), 3000);
      return () => clearTimeout(t);
    }
  }, [showUpgradeModal]);

  const handlePurchase = async (plan: 'single' | 'pack3' | 'pro') => {
    // If not signed in, redirect to Google sign-in
    if (!isSignedIn) {
      setShowUpgradeModal(false);
      signIn('google');
      return;
    }

    // Signed in — create Stripe checkout session
    setLoading(plan);
    try {
      const token = await getToken();
      const res = await fetch('/api/v1/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, address_id: targetAddressId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create checkout' }));
        throw new Error(err.detail || 'Checkout failed');
      }

      const { checkout_url } = await res.json();
      // Persist target address across Stripe redirect (Zustand store is wiped)
      if (targetAddressId) {
        try {
          localStorage.setItem('wharescore-checkout-target', JSON.stringify({
            addressId: targetAddressId,
            persona: targetPersona,
          }));
        } catch { /* non-critical */ }
      }
      safeRedirect(checkout_url);
    } catch (err) {
      console.error('Checkout error:', err);
      setLoading(null);
    }
  };

  const handleGuestCheckout = async () => {
    if (!targetAddressId) return;
    setLoading('guest');
    try {
      const res = await fetch('/api/v1/checkout/guest-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address_id: targetAddressId, persona: targetPersona }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create checkout' }));
        throw new Error(err.detail || 'Checkout failed');
      }
      const { checkout_url } = await res.json();
      // Save user inputs to localStorage so guest download page can include them in PDF
      try {
        const rentInput = useRentInputStore.getState();
        const buyerInput = useBuyerInputStore.getState();
        const budgetEntry = useBudgetStore.getState().entries[targetAddressId];
        localStorage.setItem('wharescore-guest-inputs', JSON.stringify({
          persona: targetPersona,
          rent_inputs: rentInput.dwellingType ? {
            dwelling_type: rentInput.dwellingType,
            bedrooms: rentInput.bedrooms,
            weekly_rent: rentInput.weeklyRent,
            finish_tier: rentInput.finishTier,
            bathrooms: rentInput.bathrooms,
            has_parking: rentInput.hasParking,
            has_insulation: rentInput.notInsulated ? false : undefined,
            is_furnished: rentInput.isFurnished,
            shared_kitchen: rentInput.sharedKitchen,
            utilities_included: rentInput.utilitiesIncluded,
          } : undefined,
          buyer_inputs: targetPersona === 'buyer' ? {
            asking_price: buyerInput.askingPrice,
            bedrooms: buyerInput.bedrooms,
            finish_tier: buyerInput.finishTier,
            bathrooms: buyerInput.bathrooms,
            has_parking: buyerInput.hasParking,
          } : undefined,
          budget_inputs: budgetEntry?.hasInteracted ? {
            persona: targetPersona,
            ...(targetPersona === 'buyer' ? budgetEntry.buyer : budgetEntry.renter),
          } : undefined,
        }));
      } catch { /* non-critical */ }
      safeRedirect(checkout_url);
    } catch (err) {
      console.error('Guest checkout error:', err);
      setLoading(null);
    }
  };

  const headline = getHeadline(credits, modalTrigger, modalContext);
  const description = getDescription(modalTrigger);

  return (
    <Dialog open={showUpgradeModal} onOpenChange={(open) => setShowUpgradeModal(open)}>
      <DialogContent className="sm:max-w-md animate-in zoom-in-95 fade-in duration-200 gap-2 sm:gap-4 p-3 sm:p-4" showCloseButton={canClose}>
        <DialogHeader>
          <div className="mx-auto mb-1 sm:mb-2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-piq-primary/10">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-piq-primary" />
          </div>
          {/* Personalised greeting (+17% conversion per research) */}
          {isSignedIn && session?.user?.name && (
            <p className="text-center text-xs text-muted-foreground">
              Hi {session.user.name.split(' ')[0]}
            </p>
          )}
          <DialogTitle className="text-center text-base sm:text-lg">
            {headline}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Feature list */}
        <ul className="space-y-1 sm:space-y-1.5 py-0.5 sm:py-1">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <Check className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-piq-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Pricing options */}
        <div className="grid gap-1.5 sm:gap-2">
          {/* Single report */}
          <button
            onClick={() => handlePurchase('single')}
            disabled={!!loading}
            className="flex items-center justify-between rounded-lg border-2 border-border p-2.5 sm:p-3 text-left transition-all hover:border-piq-primary hover:bg-piq-primary/5 hover:shadow-md disabled:opacity-60"
          >
            <div>
              <p className="text-xs sm:text-sm font-semibold">Single report</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">One property</p>
            </div>
            {loading === 'single' ? (
              <Loader2 className="h-5 w-5 animate-spin text-piq-primary" />
            ) : (
              <span className="text-base sm:text-lg font-bold text-piq-primary">$4.99</span>
            )}
          </button>

          {/* 3-pack */}
          <button
            onClick={() => handlePurchase('pack3')}
            disabled={!!loading}
            className="relative flex items-center justify-between rounded-lg border-2 border-piq-primary bg-piq-primary/5 p-2.5 sm:p-3 text-left transition-all hover:bg-piq-primary/10 hover:shadow-md disabled:opacity-60"
          >
            <div className="absolute -top-2.5 left-3 rounded-full bg-piq-primary px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm shadow-piq-primary/30">
              Best value
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold">3-pack</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Compare properties — $3.33 each</p>
            </div>
            {loading === 'pack3' ? (
              <Loader2 className="h-5 w-5 animate-spin text-piq-primary" />
            ) : (
              <span className="text-base sm:text-lg font-bold text-piq-primary">$9.99</span>
            )}
          </button>

          {/* Pro monthly */}
          <button
            onClick={() => handlePurchase('pro')}
            disabled={!!loading}
            className="flex items-center justify-between rounded-lg border-2 border-border p-2.5 sm:p-3 text-left transition-all hover:border-piq-primary hover:bg-piq-primary/5 hover:shadow-md disabled:opacity-60"
          >
            <div>
              <p className="text-xs sm:text-sm font-semibold">
                Pro monthly
                <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">For professionals</span>
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">30 reports/month — agents & investors</p>
            </div>
            {loading === 'pro' ? (
              <Loader2 className="h-5 w-5 animate-spin text-piq-primary" />
            ) : (
              <span className="text-base sm:text-lg font-bold text-piq-primary">$49/mo</span>
            )}
          </button>
        </div>

        {/* Guest checkout option for non-signed-in users */}
        {!isSignedIn && targetAddressId && (
          <div className="border-t border-border pt-3">
            <button
              onClick={handleGuestCheckout}
              disabled={!!loading}
              className="w-full rounded-lg border border-dashed border-muted-foreground/30 p-2.5 text-center text-sm text-muted-foreground transition-all hover:border-piq-primary hover:text-piq-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-muted-foreground/30 disabled:hover:text-muted-foreground"
            >
              {loading === 'guest' ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting...
                </span>
              ) : (
                'Continue without account — $4.99'
              )}
            </button>
          </div>
        )}

        {loading && loading !== 'guest' && (
          <p className="text-center text-xs text-muted-foreground animate-pulse">
            Redirecting to payment...
          </p>
        )}

        {!isAuthenticated && !loading && !targetAddressId && (
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll be asked to sign in before purchase.
          </p>
        )}

        {/* Promo code section */}
        <PromoCodeInput />

        <DialogFooter className="sm:flex-col">
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> Secure payment via Stripe
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Instant access
            </span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PromoCodeInput() {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const redeemPromo = useDownloadGateStore((s) => s.redeemPromo);
  const setShowUpgradeModal = useDownloadGateStore((s) => s.setShowUpgradeModal);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    const res = await redeemPromo(code);
    setResult(res);
    if (res.success) {
      // Close modal after short delay to show success
      setTimeout(() => setShowUpgradeModal(false), 1500);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <Gift className="h-3 w-3" />
        Have a promo code?
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
          placeholder="Enter promo code"
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-piq-primary/50 uppercase"
          maxLength={20}
        />
        <button
          onClick={handleRedeem}
          disabled={!code.trim()}
          className="rounded-lg bg-piq-primary px-4 py-2 text-sm font-medium text-white hover:bg-piq-primary/90 disabled:opacity-50 transition-colors"
        >
          Apply
        </button>
      </div>
      {result && (
        result.message === 'sign_in_required' ? (
          <button
            onClick={() => signIn('google')}
            className="w-full text-xs text-center font-medium text-piq-primary hover:underline"
          >
            Sign in with Google to use a promo code
          </button>
        ) : (
          <p className={`text-xs text-center font-medium ${result.success ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {result.message}
          </p>
        )
      )}
    </div>
  );
}

'use client';
import { Download, AlertTriangle, Home, DollarSign, Bus, Map, Sparkles, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfExport } from '@/hooks/usePdfExport';
import { SocialProof } from './SocialProof';
import { usePersonaStore } from '@/stores/personaStore';
import { useDownloadGateStore } from '@/stores/downloadGateStore';

interface ReportCTABannerProps {
  addressId: number;
  suburbName?: string;
  capitalValue?: number | null;
  medianRent?: number | null;
}

const BUYER_CONTENTS = [
  { icon: AlertTriangle, label: 'Flood, earthquake & tsunami risk' },
  { icon: Home,          label: 'Neighbourhood & crime score' },
  { icon: DollarSign,    label: 'Investment yield & cost analysis' },
  { icon: Bus,           label: 'Full commute times & walkability' },
  { icon: Map,           label: 'Zoning, height limits & consents' },
  { icon: Sparkles,      label: 'AI-generated property summary' },
];

const RENTER_CONTENTS = [
  { icon: AlertTriangle, label: 'Flood, earthquake & safety risks' },
  { icon: Home,          label: 'Neighbourhood & crime score' },
  { icon: DollarSign,    label: 'Fair rent check & market trends' },
  { icon: Bus,           label: 'Full commute times & walkability' },
  { icon: Map,           label: 'Healthy Homes & insulation checks' },
  { icon: Sparkles,      label: 'AI-generated property summary' },
];

function getSubheadline(persona: 'buyer' | 'renter', price: string, capitalValue?: number | null, medianRent?: number | null): string {
  if (persona === 'renter') {
    if (medianRent) {
      return `${price} before you commit to $${medianRent}/week`;
    }
    return `${price} to know before you sign the lease`;
  }
  // Buyer
  if (capitalValue && capitalValue >= 100_000) {
    const formatted = capitalValue >= 1_000_000
      ? `$${(capitalValue / 1_000_000).toFixed(1)}M`
      : `$${(capitalValue / 1_000).toFixed(0)}k`;
    return `${price} to protect a ${formatted} decision`;
  }
  return `${price} to protect your biggest investment`;
}

export function ReportCTABanner({ addressId, suburbName, capitalValue, medianRent }: ReportCTABannerProps) {
  const persona = usePersonaStore((s) => s.persona);
  const isPro = useDownloadGateStore((s) => s.credits?.plan === 'pro');
  const fullPrice = isPro ? '$4.99' : '$9.99';
  const pdf = usePdfExport(addressId, persona);
  const contents = persona === 'renter' ? RENTER_CONTENTS : BUYER_CONTENTS;

  return (
    <div className="rounded-xl border border-piq-primary/20 bg-gradient-to-br from-piq-primary/8 via-piq-primary/3 to-transparent p-5 space-y-4 card-elevated">
      <div>
        <p className="text-[10px] font-bold text-piq-primary uppercase tracking-widest mb-1">
          Full Intelligence Report
        </p>
        <p className="text-base font-bold leading-snug tracking-tight">
          {persona === 'renter'
            ? 'Everything the landlord won\u2019t tell you'
            : 'Everything the listing doesn\u2019t tell you'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {getSubheadline(persona, fullPrice, capitalValue, medianRent)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {contents.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0 text-piq-primary/70" />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Button className="w-full font-semibold" size="lg" onClick={pdf.startExport} disabled={pdf.isGenerating}>
        {pdf.isGenerating ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating Report...</>
        ) : (
          <><Download className="h-4 w-4 mr-1.5" /> Get Full Report — {fullPrice}</>
        )}
      </Button>
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3" /> Secure payment
        </span>
        <span>·</span>
        <span>27 indicators</span>
        <span>·</span>
        <span>Instant delivery</span>
      </div>
      {suburbName && (
        <div className="pt-1 border-t border-border/50">
          <SocialProof suburbName={suburbName} />
        </div>
      )}
    </div>
  );
}

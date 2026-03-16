'use client';
import { Download, AlertTriangle, Home, DollarSign, Bus, Map, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfExport } from '@/hooks/usePdfExport';

const REPORT_CONTENTS = [
  { icon: AlertTriangle, label: 'Flood, earthquake & tsunami risk' },
  { icon: Home,          label: 'Neighbourhood & crime score' },
  { icon: DollarSign,    label: 'Fair rent estimate & market trends' },
  { icon: Bus,           label: 'Transit access & walkability' },
  { icon: Map,           label: 'Zoning, height limits & consents' },
  { icon: Sparkles,      label: 'AI-generated property summary' },
];

export function ReportCTABanner({ addressId }: { addressId: number }) {
  const pdf = usePdfExport(addressId);

  return (
    <div className="rounded-xl border border-piq-primary/20 bg-gradient-to-br from-piq-primary/8 via-piq-primary/3 to-transparent p-5 space-y-4 card-elevated">
      <div>
        <p className="text-[10px] font-bold text-piq-primary uppercase tracking-widest mb-1">
          Full Intelligence Report
        </p>
        <p className="text-base font-bold leading-snug tracking-tight">
          Everything the listing doesn&apos;t tell you
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {REPORT_CONTENTS.map(({ icon: Icon, label }) => (
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
          <><Download className="h-4 w-4 mr-1.5" /> Download Full Report PDF</>
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Free during beta · 27 indicators · No signup required
      </p>

    </div>
  );
}

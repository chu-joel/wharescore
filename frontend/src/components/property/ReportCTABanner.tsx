'use client';
import { Download, AlertTriangle, Home, DollarSign, Bus, Map, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdfExport } from '@/hooks/usePdfExport';
import { PdfReadyModal } from './PdfReadyModal';

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
    <div className="rounded-xl border bg-gradient-to-br from-piq-primary/5 to-transparent p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-piq-primary uppercase tracking-widest mb-0.5">
          Full Intelligence Report
        </p>
        <p className="text-sm font-semibold leading-snug">
          Everything the listing doesn&apos;t tell you
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {REPORT_CONTENTS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0 text-piq-primary/70" />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Button className="w-full font-semibold" onClick={pdf.startExport} disabled={pdf.isGenerating}>
        {pdf.isGenerating ? (
          <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Generating Report...</>
        ) : (
          <><Download className="h-4 w-4 mr-1.5" /> Download Full Report PDF</>
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Free during beta · 27 indicators · No signup required
      </p>

      <PdfReadyModal
        show={pdf.showModal}
        isGenerating={pdf.isGenerating}
        downloadUrl={pdf.downloadUrl}
        error={pdf.error}
        onClose={pdf.closeModal}
      />
    </div>
  );
}

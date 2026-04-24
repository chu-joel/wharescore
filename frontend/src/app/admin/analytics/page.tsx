import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { RentReportsPanel } from '@/components/admin/RentReportsPanel';
import { BuyerInputsPanel } from '@/components/admin/BuyerInputsPanel';

export default function AnalyticsPage() {
  return (
    <div className="space-y-10">
      <AnalyticsPanel />
      <RentReportsPanel />
      <BuyerInputsPanel />
    </div>
  );
}

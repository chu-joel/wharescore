import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
import { RentReportsPanel } from '@/components/admin/RentReportsPanel';

export default function AnalyticsPage() {
  return (
    <div className="space-y-10">
      <AnalyticsPanel />
      <RentReportsPanel />
    </div>
  );
}

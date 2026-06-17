import { LayoutGrid } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A summary of your trips, document health, and upcoming alerts.
        </p>
      </div>

      <EmptyState
        icon={<LayoutGrid className="h-7 w-7" />}
        title="Your dashboard is empty"
        description="Once you create a trip and add documents, your health scores, expiry alerts, and document statuses will appear here."
      />
    </div>
  );
}

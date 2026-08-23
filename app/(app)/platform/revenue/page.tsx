import { TrendingUp } from "lucide-react";
import { PlatformPlaceholderView } from "@/features/platform/components/platform-placeholder-view";

export default function PlatformRevenuePage() {
  return (
    <PlatformPlaceholderView
      title="Revenue"
      description="Subscription revenue, plan mix, renewals, and churn for the Novend platform."
      icon={TrendingUp}
      emptyTitle="Revenue analytics coming next"
      emptyDescription="MRR, ARR, plan distribution, and profit trends will land here as the Super Admin console expands."
    />
  );
}

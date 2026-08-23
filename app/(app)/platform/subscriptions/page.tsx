import { CreditCard } from "lucide-react";
import { PlatformPlaceholderView } from "@/features/platform/components/platform-placeholder-view";

export default function PlatformSubscriptionsPage() {
  return (
    <PlatformPlaceholderView
      title="Subscriptions"
      description="Manage organization plans, renewals, invoices, and license status across tenants."
      icon={CreditCard}
      emptyTitle="Subscription manager coming next"
      emptyDescription="A full SaaS subscription table with plan edits, extensions, and suspend actions will live here."
    />
  );
}

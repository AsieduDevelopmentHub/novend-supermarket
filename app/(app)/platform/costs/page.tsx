import { Receipt } from "lucide-react";
import { PlatformPlaceholderView } from "@/features/platform/components/platform-placeholder-view";

export default function PlatformCostsPage() {
  return (
    <PlatformPlaceholderView
      title="Operating costs"
      description="Track hosting, Convex, Vercel, domains, SMS, email, and other platform expenses."
      icon={Receipt}
      emptyTitle="Cost tracking coming next"
      emptyDescription="Record operating costs here so the dashboard can calculate gross revenue, expenses, and net profit."
    />
  );
}

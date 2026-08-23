import { Activity } from "lucide-react";
import { PlatformPlaceholderView } from "@/features/platform/components/platform-placeholder-view";

export default function PlatformHealthPage() {
  return (
    <PlatformPlaceholderView
      title="System health"
      description="Monitor Convex, storage, sync queues, release versions, and connected devices."
      icon={Activity}
      emptyTitle="Health monitoring coming next"
      emptyDescription="Platform status, sync failures, and connected desktop or mobile devices will appear here."
    />
  );
}

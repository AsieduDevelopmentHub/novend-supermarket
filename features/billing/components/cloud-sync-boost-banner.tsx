"use client";

import { RefreshCw } from "lucide-react";
import { useLicense } from "@/hooks/use-license";

/**
 * Quiet notice while the org is in a temporary full_sync catch-up window.
 */
export function CloudSyncBoostBanner() {
  const { cloudMode, plannedCloudMode, syncBoostUntil, isLoading } = useLicense();

  if (isLoading) return null;
  if (typeof syncBoostUntil !== "number" || syncBoostUntil <= Date.now()) return null;
  if (cloudMode !== "full_sync") return null;
  if (!plannedCloudMode || plannedCloudMode === "full_sync") return null;

  const untilLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(syncBoostUntil));

  return (
    <div
      role="status"
      className="border-primary/20 bg-primary/5 text-foreground flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-xs sm:gap-3 sm:px-4 sm:py-2 sm:text-sm lg:px-8"
    >
      <RefreshCw className="text-primary h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
      <span className="min-w-0 flex-1">
        Temporary full sync is on until {untilLabel} so tills can catch up (events + catalog
        mirror), then this business returns to its cloud plan.
      </span>
    </div>
  );
}

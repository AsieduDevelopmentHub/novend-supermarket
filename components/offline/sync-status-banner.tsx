"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { describeSyncStatus } from "@/lib/offline/sync-status";
import { cn } from "@/lib/utils";

/**
 * Shell banner for sync work that needs user attention.
 * Background upload progress stays in Sync Center only.
 */
export function SyncStatusBanner() {
  const { online, pendingCount, failedCount, syncing, openSyncCenter } = useOfflineStatus();
  const view = describeSyncStatus({ online, pendingCount, failedCount, syncing });

  if (view.kind !== "conflict") {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 border-b px-4 py-2 text-sm",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        <p className="truncate">
          {failedCount} sync item{failedCount === 1 ? "" : "s"} need review
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={openSyncCenter}
      >
        Review
      </Button>
    </div>
  );
}

"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { cn } from "@/lib/utils";

/**
 * Quiet shell indicator for work that needs attention.
 * Offline status lives on the sidebar chip so it is not repeated here.
 */
export function SyncStatusBanner() {
  const { online, pendingCount, failedCount, syncing, openSyncCenter } = useOfflineStatus();

  const showSyncing = online && syncing && pendingCount > 0;
  const showConflict = online && failedCount > 0;

  if (!showSyncing && !showConflict) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 border-b px-4 py-2 text-sm",
        showConflict && "border-destructive/30 bg-destructive/10 text-destructive",
        showSyncing && !showConflict && "border-border bg-muted/50 text-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showConflict ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
        ) : (
          <RefreshCw className={cn("size-4 shrink-0", syncing && "animate-spin")} aria-hidden />
        )}
        <p className="truncate">
          {showConflict
            ? `${failedCount} sync conflict${failedCount === 1 ? "" : "s"} need review`
            : `Uploading ${pendingCount} event${pendingCount === 1 ? "" : "s"}…`}
        </p>
      </div>
      {showConflict ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={openSyncCenter}
        >
          Review
        </Button>
      ) : null}
    </div>
  );
}

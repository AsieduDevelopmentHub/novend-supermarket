"use client";

import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { cn } from "@/lib/utils";

/**
 * Quiet shell indicator.
 * Pending uploads stay in the sidebar. Surface offline mode, active sync,
 * or conflicts that need cashier attention — Review opens Sync Center.
 */
export function SyncStatusBanner() {
  const { online, pendingCount, failedCount, syncing, openSyncCenter } = useOfflineStatus();

  const showOffline = !online;
  const showSyncing = online && syncing && pendingCount > 0;
  const showConflict = online && failedCount > 0;

  if (!showOffline && !showSyncing && !showConflict) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 border-b px-4 py-2 text-sm",
        showOffline && "border-border/60 bg-muted/40 text-muted-foreground",
        showConflict && "border-destructive/30 bg-destructive/10 text-destructive",
        showSyncing && !showConflict && "border-border bg-muted/50 text-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {showOffline ? (
          <CloudOff className="size-4 shrink-0" aria-hidden />
        ) : showConflict ? (
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
        ) : (
          <RefreshCw className={cn("size-4 shrink-0", syncing && "animate-spin")} aria-hidden />
        )}
        <p className="truncate">
          {showOffline
            ? "You're offline. Novend is running from local data. Changes will synchronize when you're back online."
            : showConflict
              ? `${failedCount} sync conflict${failedCount === 1 ? "" : "s"} need review`
              : `Uploading ${pendingCount} event${pendingCount === 1 ? "" : "s"}…`}
        </p>
      </div>
      {showConflict ? (
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={openSyncCenter}>
          Review
        </Button>
      ) : null}
    </div>
  );
}

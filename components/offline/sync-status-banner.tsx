"use client";

import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { cn } from "@/lib/utils";

/**
 * Quiet shell indicator.
 * Pending sync stays in the background. Surface only offline mode, active sync
 * when there is real outbox work, or conflicts that need cashier attention.
 * Snapshot refresh alone must never flash this banner.
 */
export function SyncStatusBanner() {
  const { online, pendingCount, failedCount, syncing, flushOutbox } = useOfflineStatus();

  const showOffline = !online;
  // Only show syncing when there is something to sync — avoids boot/focus flicker.
  const showSyncing = online && syncing && pendingCount > 0;
  // Outbox failures only — transient snapshot errors must not paint the conflict strip.
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
              ? `${failedCount} sale${failedCount === 1 ? "" : "s"} need attention after sync`
              : `Syncing ${pendingCount} sale${pendingCount === 1 ? "" : "s"}…`}
        </p>
      </div>
      {showConflict ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={syncing}
          onClick={() => void flushOutbox()}
        >
          Retry sync
        </Button>
      ) : null}
    </div>
  );
}

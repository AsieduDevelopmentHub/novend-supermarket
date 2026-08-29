"use client";

import { CloudOff, CloudUpload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";

function SyncGlyph({
  online,
  syncing,
  failed,
}: {
  online: boolean;
  syncing: boolean;
  failed: boolean;
}) {
  if (!online) return <CloudOff className="size-3.5 shrink-0" aria-hidden />;
  if (syncing) return <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />;
  if (failed) return <AlertCircle className="size-3.5 shrink-0" aria-hidden />;
  return <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />;
}

/**
 * Compact sync indicator for the sidebar — always visible, non-intrusive.
 * Opens Sync Center for queue details, conflicts, and a forced upload.
 */
export function SyncStatusChip({ collapsed }: { collapsed?: boolean }) {
  const { online, pendingCount, failedCount, syncing, lastSyncAt, lastError, openSyncCenter } =
    useOfflineStatus();

  const failed = online && failedCount > 0;
  const pending = online && pendingCount > 0 && !failed;
  const activeSync = online && syncing && pendingCount > 0;
  const needsReview = pendingCount > 0 || failedCount > 0;

  const label = !online
    ? "Offline"
    : failed
      ? `${failedCount} conflict${failedCount === 1 ? "" : "s"}`
      : activeSync
        ? "Syncing…"
        : pending
          ? `${pendingCount} pending`
          : "Synced";

  const detail = !online
    ? "On this device"
    : needsReview
      ? lastError || "Tap to review queue"
      : lastSyncAt
        ? `Last sync ${formatDateTime(lastSyncAt)}`
        : "Not synced yet";

  return (
    <div
      data-tour="sync-status"
      className={cn(
        "border-sidebar-border text-sidebar-muted border-t px-3 py-2.5",
        collapsed && "px-2",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md text-left text-xs hover:bg-white/5",
          collapsed ? "justify-center px-1 py-1" : "px-1 py-0.5",
          !online && "text-sidebar-accent-foreground/80",
          failed && "text-destructive",
        )}
        aria-label={`${label}. ${detail}. Open sync center.`}
        onClick={openSyncCenter}
      >
        <SyncGlyph online={online} syncing={activeSync} failed={failed} />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{label}</p>
            <p className="truncate opacity-80">{detail}</p>
          </div>
        ) : (
          <span className="sr-only">
            {label}. {detail}
          </span>
        )}
      </button>
      {!collapsed && online && needsReview ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 h-7 w-full text-xs"
          onClick={openSyncCenter}
        >
          <CloudUpload className="mr-1.5 size-3.5" aria-hidden />
          Review sync
        </Button>
      ) : null}
    </div>
  );
}

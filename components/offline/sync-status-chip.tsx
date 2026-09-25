"use client";

import { CloudOff, CloudUpload, CheckCircle2, AlertCircle } from "lucide-react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/providers/offline-provider";
import { describeSyncStatus } from "@/lib/offline/sync-status";
import { useShowsRealtimeSyncUi } from "@/hooks/use-shows-realtime-sync-ui";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date";

function SyncGlyph({ kind }: { kind: ReturnType<typeof describeSyncStatus>["kind"] }) {
  if (kind === "offline" || kind === "disconnected") {
    return <CloudOff className="size-3.5 shrink-0" aria-hidden />;
  }
  if (kind === "conflict") return <AlertCircle className="size-3.5 shrink-0" aria-hidden />;
  if (kind === "queued") return <CloudUpload className="size-3.5 shrink-0" aria-hidden />;
  return <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />;
}

/** Compact header control so mobile web and Capacitor can highlight sync without the sidebar. */
export function SyncStatusHeaderButton() {
  const showSyncUi = useShowsRealtimeSyncUi();
  const { isAuthenticated } = useConvexAuth();
  const { online, pendingCount, failedCount, syncing, lastError, openSyncCenter } =
    useOfflineStatus();
  const view = describeSyncStatus({
    online,
    pendingCount,
    failedCount,
    syncing,
    cloudConnected: isAuthenticated,
  });

  if (!showSyncUi) return null;

  return (
    <button
      type="button"
      data-tour="sync-status"
      className={cn(
        "text-muted-foreground hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        (!online || !isAuthenticated) && "text-foreground",
        view.kind === "conflict" && "text-destructive",
      )}
      aria-label={`${view.label}${lastError ? `. ${lastError}` : ""}. Open sync center.`}
      onClick={openSyncCenter}
    >
      <SyncGlyph kind={view.kind} />
    </button>
  );
}

/**
 * Compact sync indicator for the sidebar — always visible, non-intrusive.
 * Opens Sync Center for queue details, conflicts, and a forced upload.
 * Hidden when the tenant cloud mode does not queue realtime sync.
 */
export function SyncStatusChip({ collapsed }: { collapsed?: boolean }) {
  const showSyncUi = useShowsRealtimeSyncUi();
  const { isAuthenticated } = useConvexAuth();
  const { online, pendingCount, failedCount, syncing, lastSyncAt, lastError, openSyncCenter } =
    useOfflineStatus();
  const view = describeSyncStatus({
    online,
    pendingCount,
    failedCount,
    syncing,
    cloudConnected: isAuthenticated,
  });
  const needsReview = isAuthenticated && online && (pendingCount > 0 || failedCount > 0);

  if (!showSyncUi) return null;

  const detail =
    !online || !isAuthenticated
      ? view.detail
      : failedCount > 0
        ? lastError || view.detail
        : pendingCount > 0
          ? view.detail
          : lastSyncAt
            ? `Last sync ${formatDateTime(lastSyncAt)}`
            : view.detail;

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
          (!online || !isAuthenticated) && "text-sidebar-accent-foreground/80",
          view.kind === "conflict" && "text-destructive",
        )}
        aria-label={`${view.label}. ${detail}. Open sync center.`}
        onClick={openSyncCenter}
      >
        <SyncGlyph kind={view.kind} />
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{view.label}</p>
            <p className="truncate opacity-80">{detail}</p>
          </div>
        ) : (
          <span className="sr-only">
            {view.label}. {detail}
          </span>
        )}
      </button>
      {!collapsed && needsReview ? (
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

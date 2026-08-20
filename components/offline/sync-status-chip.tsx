"use client";

import { CloudOff, CloudUpload, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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
 * Shows offline / syncing / pending / synced / failed with last sync time.
 */
export function SyncStatusChip({ collapsed }: { collapsed?: boolean }) {
  const { online, pendingCount, failedCount, syncing, lastSyncAt, pullSnapshot, flushOutbox } =
    useOfflineStatus();

  const failed = online && failedCount > 0;
  const pending = online && pendingCount > 0 && !failed;
  const activeSync = online && syncing && pendingCount > 0;

  const label = !online
    ? "Offline"
    : failed
      ? `${failedCount} failed`
      : activeSync
        ? "Syncing…"
        : pending
          ? `${pendingCount} pending`
          : "Synced";

  const detail = lastSyncAt ? `Last sync ${formatDateTime(lastSyncAt)}` : "Not synced yet";

  async function syncNow() {
    await pullSnapshot({ force: true });
    await flushOutbox();
  }

  return (
    <div
      className={cn(
        "border-sidebar-border text-sidebar-muted border-t px-3 py-2.5",
        collapsed && "px-2",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-xs",
          collapsed && "justify-center",
          !online && "text-sidebar-accent-foreground/80",
          failed && "text-destructive",
        )}
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
        {!collapsed && online ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-sidebar-muted hover:text-sidebar-accent-foreground size-7 shrink-0"
            disabled={activeSync}
            aria-label="Sync now"
            onClick={() => void syncNow()}
          >
            {activeSync ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
          </Button>
        ) : null}
      </div>
      {!collapsed && online && (pending || failed) ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2 h-7 w-full text-xs"
          disabled={activeSync}
          onClick={() => void syncNow()}
        >
          <CloudUpload className="mr-1.5 size-3.5" aria-hidden />
          Sync now
        </Button>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatRelative } from "@/lib/date";
import { listOpenOutbox, listRecentSyncedOutbox } from "@/lib/offline/outbox";
import { discardOutboxEvent, retryOutboxEvent } from "@/lib/offline/outbox-actions";
import { describeOutboxEvent, outboxStatusLabel } from "@/lib/offline/outbox-labels";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import type { OutboxRow } from "@/lib/offline/types";
import { useOfflineStatus } from "@/providers/offline-provider";

function statusVariant(status: OutboxRow["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "syncing") return "warning" as const;
  if (status === "synced") return "success" as const;
  return "secondary" as const;
}

function EventRow({
  row,
  busy,
  onRetry,
  onDiscard,
}: {
  row: OutboxRow;
  busy: boolean;
  onRetry?: (row: OutboxRow) => void;
  onDiscard?: (row: OutboxRow) => void;
}) {
  const copy = describeOutboxEvent(row);
  return (
    <li className="border-border flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{copy.title}</p>
          <Badge variant={statusVariant(row.status)}>{outboxStatusLabel(row.status)}</Badge>
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{copy.detail}</p>
        {row.lastError ? <p className="text-destructive mt-1 text-xs">{row.lastError}</p> : null}
        <p className="text-muted-foreground mt-1 text-[11px]">
          Queued {formatRelative(row.createdAt)}
          {row.attempts > 0 ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      {onRetry || onDiscard ? (
        <div className="flex shrink-0 gap-2">
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || row.status === "syncing"}
              onClick={() => onRetry(row)}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Retry
            </Button>
          ) : null}
          {onDiscard ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || row.status === "syncing"}
              onClick={() => onDiscard(row)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Discard
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>;
}

/**
 * Cashier-facing queue: waiting uploads, conflicts, and recently synced events.
 */
export function SyncCenterDialog() {
  const {
    online,
    syncing,
    pendingCount,
    failedCount,
    lastSyncAt,
    lastError,
    syncCenterOpen,
    closeSyncCenter,
    flushOutbox,
    pullSnapshot,
    refreshStatus,
  } = useOfflineStatus();

  const [waiting, setWaiting] = useState<OutboxRow[]>([]);
  const [conflicts, setConflicts] = useState<OutboxRow[]>([]);
  const [recent, setRecent] = useState<OutboxRow[]>([]);
  const [discardTarget, setDiscardTarget] = useState<OutboxRow | null>(null);
  const [discardPending, setDiscardPending] = useState(false);
  const [tab, setTab] = useState("waiting");
  const [tabSessionOpen, setTabSessionOpen] = useState(false);

  if (syncCenterOpen !== tabSessionOpen) {
    setTabSessionOpen(syncCenterOpen);
    if (syncCenterOpen) {
      setTab(failedCount > 0 ? "conflicts" : "waiting");
    }
  }

  const reload = useCallback(async () => {
    const [open, synced] = await Promise.all([listOpenOutbox(), listRecentSyncedOutbox()]);
    setWaiting(open.filter((row) => row.status === "pending" || row.status === "syncing"));
    setConflicts(open.filter((row) => row.status === "failed"));
    setRecent(synced);
    await refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!syncCenterOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    const unsub = subscribeReplicaChanged(() => {
      void reload();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [syncCenterOpen, reload]);

  async function syncNow() {
    if (!online) {
      toast.error("Connect to the internet to sync.");
      return;
    }
    await pullSnapshot({ force: true });
    await flushOutbox({ force: true });
    await reload();
  }

  async function onRetry(row: OutboxRow) {
    await retryOutboxEvent(row.id);
    toast.message("Retry queued");
    await flushOutbox({ force: true });
    await reload();
  }

  async function onDiscard() {
    if (!discardTarget) return;
    setDiscardPending(true);
    try {
      await discardOutboxEvent(discardTarget.id);
      toast.success("Event discarded");
      setDiscardTarget(null);
      await reload();
    } finally {
      setDiscardPending(false);
    }
  }

  const discardCopy = discardTarget ? describeOutboxEvent(discardTarget) : null;

  return (
    <Dialog open={syncCenterOpen} onOpenChange={(open) => !open && closeSyncCenter()}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-border space-y-1 border-b px-6 py-4 text-left">
            <DialogTitle>Sync center</DialogTitle>
            <DialogDescription>
              Review what this device still needs to upload, conflicts the server rejected, and
              recent successful syncs.
            </DialogDescription>
          </DialogHeader>

          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {pendingCount > 0
                  ? `${pendingCount} waiting to upload`
                  : failedCount > 0
                    ? `${failedCount} conflict${failedCount === 1 ? "" : "s"}`
                    : "Everything is uploaded"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {!online
                  ? "Offline — events stay on this device until you reconnect."
                  : lastSyncAt
                    ? `Last cloud refresh ${formatDateTime(lastSyncAt)}`
                    : "Not synced yet"}
              </p>
              {lastError && (pendingCount > 0 || failedCount > 0) ? (
                <p className="text-destructive mt-1 text-xs">{lastError}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!online || syncing}
              onClick={() => void syncNow()}
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : online ? (
                <RefreshCw className="size-3.5" aria-hidden />
              ) : (
                <CloudOff className="size-3.5" aria-hidden />
              )}
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-6 mt-3 grid h-auto w-auto grid-cols-3 self-start">
              <TabsTrigger value="waiting">Waiting ({waiting.length})</TabsTrigger>
              <TabsTrigger value="conflicts">
                Conflicts ({conflicts.length})
              </TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              <TabsContent value="waiting" className="mt-0">
                {waiting.length === 0 ? (
                  <EmptyState>No events waiting to upload.</EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {waiting.map((row) => (
                      <EventRow
                        key={row.id}
                        row={row}
                        busy={syncing}
                        onRetry={online ? onRetry : undefined}
                        onDiscard={() => setDiscardTarget(row)}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="conflicts" className="mt-0">
                {conflicts.length === 0 ? (
                  <EmptyState>No sync conflicts.</EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {conflicts.map((row) => (
                      <EventRow
                        key={row.id}
                        row={row}
                        busy={syncing}
                        onRetry={online ? onRetry : undefined}
                        onDiscard={() => setDiscardTarget(row)}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="recent" className="mt-0">
                {recent.length === 0 ? (
                  <EmptyState>No recently synced events on this device.</EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {recent.map((row) => (
                      <EventRow key={row.id} row={row} busy={false} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {discardCopy ? (
            <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-3 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Discard {discardCopy.title.toLowerCase()}? {discardCopy.detail} will not upload.
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={discardPending}
                  onClick={() => setDiscardTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={discardPending}
                  onClick={() => void onDiscard()}
                >
                  {discardPending ? "Discarding…" : "Discard"}
                </Button>
              </div>
            </div>
          ) : conflicts.length > 0 ? (
            <p className="text-muted-foreground flex items-start gap-2 border-t px-6 py-3 text-xs">
              <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
              Conflicts were rejected by the server. Retry after you fix stock or data, or discard
              so they stop blocking the queue.
            </p>
          ) : null}
        </DialogContent>
    </Dialog>
  );
}

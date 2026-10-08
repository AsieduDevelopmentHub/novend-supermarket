"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { AlertTriangle, CloudOff, Loader2, LogIn, Pencil, RefreshCw, Trash2 } from "lucide-react";
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
import {
  discardOutboxEvent,
  postSaleDespiteStockShortage,
  retryOutboxEvent,
} from "@/lib/offline/outbox-actions";
import {
  describeOutboxEvent,
  describeOutboxConflict,
  outboxFixPath,
  outboxStatusLabel,
} from "@/lib/offline/outbox-labels";
import { isDisplayedConflict, isOutboxAuthWait } from "@/lib/offline/outbox-display";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { useOfflineStatus } from "@/providers/offline-provider";
import { useShowsRealtimeSyncUi } from "@/hooks/use-shows-realtime-sync-ui";
import { requestCloudReconnectPrompt } from "@/features/auth/components/cloud-reconnect-banner";
import { hasOfflineSession } from "@/lib/offline/session";
import { getMeta, getOfflineDb, META_KEYS } from "@/lib/offline/db";
import { ROUTES } from "@/config/navigation";
import type { OutboxRow } from "@/lib/offline/types";

function statusVariant(row: OutboxRow) {
  if (isDisplayedConflict(row)) return "destructive" as const;
  if (row.status === "syncing") return "warning" as const;
  if (row.status === "synced") return "success" as const;
  return "secondary" as const;
}

function EventRow({
  row,
  busy,
  cloudConnected,
  onRetry,
  onDiscard,
  onPostReceipt,
  onFix,
  onSignIn,
  canPostShortage,
}: {
  row: OutboxRow;
  busy: boolean;
  cloudConnected: boolean;
  canPostShortage: boolean;
  onRetry?: (row: OutboxRow) => void;
  onDiscard?: (row: OutboxRow) => void;
  onPostReceipt?: (row: OutboxRow) => void;
  onFix?: (href: string) => void;
  onSignIn?: () => void;
}) {
  const copy = describeOutboxEvent(row);
  const conflict =
    isDisplayedConflict(row) || isOutboxAuthWait(row) || row.status === "failed" || Boolean(row.lastError)
      ? describeOutboxConflict(row, { cloudConnected })
      : null;
  const authWait = Boolean(
    !cloudConnected && conflict?.kind === "waiting" && isOutboxAuthWait(row),
  );
  const fixHref = outboxFixPath(row);
  // Business conflicts, true auth waits, and interrupted uploads (when already
  // cloud-connected) can discard — e.g. sale already in Orders.
  const showDiscard =
    Boolean(onDiscard) &&
    (!conflict ||
      conflict.kind === "business" ||
      conflict.permanent ||
      authWait ||
      (conflict.kind === "network" && cloudConnected));
  const showSignIn = authWait && Boolean(onSignIn);
  const showRetry = Boolean(onRetry) && !showSignIn;
  const showPostReceipt = Boolean(
    onPostReceipt && canPostShortage && conflict?.canPostShortage,
  );

  return (
    <li className="border-border flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{conflict?.headline ?? copy.title}</p>
          <Badge variant={statusVariant(row)}>
            {conflict
              ? conflict.kind === "network"
                ? "Retry later"
                : conflict.kind === "waiting"
                  ? "Waiting"
                  : "Needs a fix"
              : outboxStatusLabel(row.status)}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs break-words">
          {conflict?.explanation ?? copy.detail}
        </p>
        {row.lastError && !conflict ? (
          <p className="text-destructive mt-1 text-xs">{row.lastError}</p>
        ) : null}
        <p className="text-muted-foreground mt-1 text-[11px]">
          Queued {formatRelative(row.createdAt)}
          {row.attempts > 0 ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      {showRetry || showPostReceipt || showDiscard || showSignIn || (fixHref && onFix) ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {fixHref && onFix && !showSignIn ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || row.status === "syncing"}
              onClick={() => onFix(fixHref)}
            >
              <Pencil className="size-3.5" aria-hidden />
              Fix
            </Button>
          ) : null}
          {showSignIn && onSignIn ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={onSignIn}
            >
              <LogIn className="size-3.5" aria-hidden />
              Sign in
            </Button>
          ) : null}
          {showPostReceipt && onPostReceipt ? (
            <Button
              type="button"
              size="sm"
              disabled={busy || row.status === "syncing"}
              onClick={() => onPostReceipt(row)}
            >
              Post receipt
            </Button>
          ) : null}
          {showRetry && onRetry ? (
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
          {showDiscard && onDiscard ? (
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
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const showSyncUi = useShowsRealtimeSyncUi();
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

  useEffect(() => {
    if (!showSyncUi && syncCenterOpen) closeSyncCenter();
  }, [showSyncUi, syncCenterOpen, closeSyncCenter]);

  const [waiting, setWaiting] = useState<OutboxRow[]>([]);
  const [conflicts, setConflicts] = useState<OutboxRow[]>([]);
  const [recent, setRecent] = useState<OutboxRow[]>([]);
  const [discardTarget, setDiscardTarget] = useState<OutboxRow | null>(null);
  const [discardPending, setDiscardPending] = useState(false);
  const [tab, setTab] = useState("waiting");
  const [canPostShortage, setCanPostShortage] = useState(false);
  const [tabSessionOpen, setTabSessionOpen] = useState(false);

  if (syncCenterOpen !== tabSessionOpen) {
    setTabSessionOpen(syncCenterOpen);
    if (syncCenterOpen) {
      setTab(failedCount > 0 ? "conflicts" : "waiting");
    }
  }

  const reload = useCallback(async () => {
    const [open, synced] = await Promise.all([listOpenOutbox(), listRecentSyncedOutbox()]);
    const conflictRows = open.filter(isDisplayedConflict);
    const waitingRows = open.filter((row) => !isDisplayedConflict(row));
    setConflicts(conflictRows);
    setWaiting(waitingRows);
    setRecent(synced);
    if (conflictRows.length > 0 && waitingRows.length === 0) {
      setTab("conflicts");
    } else if (waitingRows.length > 0 && conflictRows.length === 0) {
      setTab("waiting");
    }
    await refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!syncCenterOpen) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void reload();
    });
    void (async () => {
      const db = await getOfflineDb();
      const role = db ? await getMeta(db, META_KEYS.profileRole) : null;
      if (!cancelled) {
        setCanPostShortage(role === "administrator" || role === "manager");
      }
    })();
    const unsub = subscribeReplicaChanged(() => {
      void reload();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [syncCenterOpen, reload]);

  function onSignIn() {
    closeSyncCenter();
    requestCloudReconnectPrompt();
    toast.message("Sign in with email and password while online, then tap Sync now.");
    // Offline shell: Connect-to-cloud banner/dialog handles password in place.
    if (hasOfflineSession()) return;
    if (!isAuthenticated) {
      router.push(ROUTES.login);
    }
  }

  async function syncNow() {
    if (!online) {
      toast.error("Connect to the internet to sync.");
      return;
    }
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    await pullSnapshot({ force: true });
    await flushOutbox({ force: true, showProgress: true });
    await reload();
  }

  async function onPostReceipt(row: OutboxRow) {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    await postSaleDespiteStockShortage(row.id);
    toast.message("Posting the receipt");
    await flushOutbox({ force: true, showProgress: true });
    await reload();
  }

  async function onRetry(row: OutboxRow) {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    await retryOutboxEvent(row.id);
    toast.message("Retry queued");
    await flushOutbox({ force: true, showProgress: true });
    await reload();
  }

  function onFix(href: string) {
    closeSyncCenter();
    router.push(href);
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
  const discardIsAuthWait = discardTarget ? isOutboxAuthWait(discardTarget) : false;
  const needsFixCount = conflicts.length;
  const authWaitingCount = waiting.filter(isOutboxAuthWait).length;

  if (!showSyncUi) return null;

  return (
    <Dialog open={syncCenterOpen} onOpenChange={(open) => !open && closeSyncCenter()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>Sync center</DialogTitle>
          <DialogDescription>
            Review what this device still needs to upload, conflicts the server rejected, and recent
            successful syncs.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {pendingCount > 0 || authWaitingCount > 0
                ? `${Math.max(pendingCount, waiting.length)} waiting to upload`
                : needsFixCount > 0
                  ? `${needsFixCount} need${needsFixCount === 1 ? "s" : ""} a fix`
                  : "Everything is uploaded"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {!online
                ? "Waiting until you're back online."
                : !isAuthenticated
                  ? "Sign in online to upload queued changes."
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
            ) : !isAuthenticated ? (
              <LogIn className="size-3.5" aria-hidden />
            ) : online ? (
              <RefreshCw className="size-3.5" aria-hidden />
            ) : (
              <CloudOff className="size-3.5" aria-hidden />
            )}
            {syncing ? "Syncing…" : !isAuthenticated ? "Sign in" : "Sync now"}
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-6 mt-3 grid h-auto w-auto grid-cols-3 self-start">
            <TabsTrigger value="waiting">Waiting ({waiting.length})</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts ({conflicts.length})</TabsTrigger>
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
                      cloudConnected={isAuthenticated}
                      canPostShortage={canPostShortage}
                      onRetry={online ? onRetry : undefined}
                      onPostReceipt={online && isAuthenticated ? onPostReceipt : undefined}
                      onDiscard={() => setDiscardTarget(row)}
                      onFix={onFix}
                      onSignIn={onSignIn}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="conflicts" className="mt-0">
              {conflicts.length === 0 ? (
                <EmptyState>No sync conflicts.</EmptyState>
              ) : (
                <div className="space-y-3">
                  <ul className="space-y-2">
                    {conflicts.map((row) => (
                      <EventRow
                        key={row.id}
                        row={row}
                        busy={syncing}
                        cloudConnected={isAuthenticated}
                        canPostShortage={canPostShortage}
                        onRetry={online && isAuthenticated ? onRetry : undefined}
                        onPostReceipt={online && isAuthenticated ? onPostReceipt : undefined}
                        onDiscard={() => setDiscardTarget(row)}
                        onFix={onFix}
                        onSignIn={onSignIn}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>
            <TabsContent value="recent" className="mt-0">
              {recent.length === 0 ? (
                <EmptyState>No recently synced events on this device.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {recent.map((row) => (
                    <EventRow
                      key={row.id}
                      row={row}
                      busy={false}
                      canPostShortage={false}
                      cloudConnected={isAuthenticated}
                    />
                  ))}
                </ul>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {discardCopy ? (
          <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-3 border-t px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              {discardIsAuthWait
                ? `Discard ${discardCopy.title.toLowerCase()}? Only do this if it already exists in the cloud or you no longer want it uploaded. This removes the local upload queue entry only.`
                : `Discard ${discardCopy.title.toLowerCase()}? ${discardCopy.detail} will not upload. Use Fix to edit the product instead if the server asked for a change.`}
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
        ) : waiting.length > 0 || conflicts.length > 0 ? (
          <p className="text-muted-foreground flex items-start gap-2 border-t px-6 py-3 text-xs">
            <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
            Sign-in waits need an online email/password session, then Sync now. Business conflicts
            need a fix (stock, expiry, permissions) or Discard. Network failures say “Retry later”
            and are not permanent rejections. Discard one row only if you do not want that local
            event uploaded (or it is already on the server).
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

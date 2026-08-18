"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatCurrency } from "@/lib/currency";
import { discardFailedLocalSale, listFailedLocalSales } from "@/lib/offline/sales-repository";
import { getOfflineDb } from "@/lib/offline/db";
import { markOutboxPending } from "@/lib/offline/outbox";
import type { LocalSale } from "@/lib/offline/types";
import { useOfflineStatus } from "@/providers/offline-provider";
import { toast } from "sonner";

/**
 * Conflict / rejection UI only.
 * Healthy pending sync stays invisible — OfflineProvider drains the outbox in the background.
 */
export function SyncConflictPanel() {
  const { online, flushOutbox, refreshStatus, failedCount } = useOfflineStatus();
  const [failed, setFailed] = useState<LocalSale[]>([]);
  const [discardTarget, setDiscardTarget] = useState<LocalSale | null>(null);
  const [discardPending, setDiscardPending] = useState(false);

  const reload = useCallback(async () => {
    const nextFailed = await listFailedLocalSales();
    setFailed(nextFailed);
    await refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!online || failedCount === 0) return;

    let cancelled = false;
    const load = () => {
      void listFailedLocalSales().then((nextFailed) => {
        if (cancelled) return;
        setFailed(nextFailed);
      });
    };

    const timeout = window.setTimeout(load, 0);
    const interval = window.setInterval(load, 8_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [online, failedCount]);

  async function onRetry(sale: LocalSale) {
    const db = await getOfflineDb();
    if (!db) return;
    const row = await db.outbox.where("clientOperationId").equals(sale.clientOperationId).first();
    if (row) {
      await markOutboxPending(db, row.id);
      await db.localSales.put({ ...sale, syncStatus: "pending", lastError: undefined });
    }
    toast.message("Retry queued");
    await flushOutbox();
    await reload();
  }

  async function onDiscard() {
    if (!discardTarget) return;
    setDiscardPending(true);
    try {
      await discardFailedLocalSale(discardTarget.id);
      toast.success("Local sale discarded");
      setDiscardTarget(null);
      await reload();
    } finally {
      setDiscardPending(false);
    }
  }

  if (!online || failedCount === 0 || (failed.length === 0 && !discardTarget)) {
    return null;
  }

  return (
    <>
      {failed.length > 0 ? (
        <div className="border-b px-4 py-3">
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="text-destructive size-4" aria-hidden />
                Sync conflicts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {failed.map((sale) => (
                <div
                  key={sale.id}
                  className="border-destructive/30 bg-destructive/5 flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{sale.invoiceNumber}</p>
                    <p className="text-destructive text-xs">{sale.lastError ?? "Sync failed"}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {sale.customerName} · {formatCurrency(sale.total)} · stock restored locally
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onRetry(sale)}
                    >
                      <RefreshCw className="size-4" />
                      Retry
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDiscardTarget(sale)}
                    >
                      <Trash2 className="size-4" />
                      Discard
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!discardTarget}
        onOpenChange={(open) => !open && setDiscardTarget(null)}
        title="Discard offline sale?"
        description={
          discardTarget
            ? `Permanently discard ${discardTarget.invoiceNumber}? It will not sync to the server.`
            : ""
        }
        confirmLabel="Discard"
        pending={discardPending}
        onConfirm={onDiscard}
      />
    </>
  );
}

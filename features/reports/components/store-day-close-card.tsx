"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import {
  adminCloseOpenSessions,
  previewStoreDayClose,
  type StoreDayClosePreview,
} from "@/lib/offline/till-sessions";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { toast } from "sonner";

/** Admin/manager: combined open tills on this device + close store day. */
export function StoreDayCloseCard() {
  const [preview, setPreview] = useState<StoreDayClosePreview | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      void previewStoreDayClose().then((row) => {
        if (!cancelled) setPreview(row);
      });
    }
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  async function onCloseAll() {
    if (!preview || preview.cashiers.length === 0) return;
    const ok = window.confirm(
      `Close ${preview.cashiers.length} open till(s) using expected counts?\n\nCombined cash expected: ${formatCurrency(preview.combined.expectedCash)}`,
    );
    if (!ok) return;
    setPending(true);
    try {
      const count = await adminCloseOpenSessions();
      toast.success(
        count === 1 ? "Closed 1 till for today" : `Closed ${count} tills for today`,
      );
      setPreview(await previewStoreDayClose());
    } catch (error) {
      showError(error, "Could not close store day");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card data-tour="store-day-close">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle>Close store day</CardTitle>
        <Button
          type="button"
          variant="default"
          disabled={pending || !preview || preview.cashiers.length === 0}
          onClick={() => void onCloseAll()}
        >
          Close all open tills
        </Button>
      </CardHeader>
      <CardContent className="max-w-full min-w-0 space-y-4 overflow-x-auto p-0 pb-4">
        {preview === null ? (
          <div className="p-6">
            <LoadingState label="Loading open tills…" />
          </div>
        ) : preview.cashiers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No open tills"
              description="Every cashier on this device has already closed today."
            />
          </div>
        ) : (
          <>
            <div className="text-muted-foreground grid gap-2 px-4 pt-2 text-sm sm:grid-cols-4">
              <div>
                Sales <span className="text-foreground font-medium">{preview.combined.saleCount}</span>
              </div>
              <div>
                Gross{" "}
                <span className="text-foreground font-medium">
                  {formatCurrency(preview.combined.grossSales)}
                </span>
              </div>
              <div>
                Cash exp.{" "}
                <span className="text-foreground font-medium">
                  {formatCurrency(preview.combined.expectedCash)}
                </span>
              </div>
              <div>
                MoMo exp.{" "}
                <span className="text-foreground font-medium">
                  {formatCurrency(preview.combined.expectedMobileMoney)}
                </span>
              </div>
            </div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cashier</th>
                  <th className="px-4 py-3 font-medium">Opened</th>
                  <th className="px-4 py-3 font-medium">Sales</th>
                  <th className="px-4 py-3 font-medium">Gross</th>
                  <th className="px-4 py-3 font-medium">Cash exp.</th>
                </tr>
              </thead>
              <tbody>
                {preview.cashiers.map((row) => (
                  <tr key={row.session.id} className="border-border border-t">
                    <td className="px-4 py-3 font-medium">
                      {row.session.cashierName}{" "}
                      <Badge variant="warning" className="ml-1">
                        Open
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDateTime(row.session.openedAt)}</td>
                    <td className="px-4 py-3">{row.saleCount}</td>
                    <td className="px-4 py-3">{formatCurrency(row.grossSales)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.expectedCash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

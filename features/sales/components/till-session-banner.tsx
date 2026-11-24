"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumericInputWithKeypad } from "@/components/ui/touch-numpad";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { showError } from "@/lib/errors";
import {
  autoCloseStaleTillSessions,
  closeToday,
  getOpenTillSession,
  previewCloseToday,
  startToday,
  type LocalTillSession,
  type TillExpectedTotals,
} from "@/lib/offline/till-sessions";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { toast } from "sonner";

type Props = {
  branchId?: string | null;
  /** Compact control for PageHeader top-right. */
  compact?: boolean;
};

export function TillSessionBanner({ branchId, compact = true }: Props) {
  const [session, setSession] = useState<LocalTillSession | null | undefined>(undefined);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [floatStr, setFloatStr] = useState("0");
  const [cashStr, setCashStr] = useState("");
  const [cardStr, setCardStr] = useState("");
  const [momoStr, setMomoStr] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<TillExpectedTotals | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      void autoCloseStaleTillSessions()
        .then((closed) => {
          if (closed > 0 && !cancelled) {
            toast.message(
              closed === 1
                ? "Yesterday's till was closed automatically at midnight"
                : `${closed} tills from yesterday were closed automatically`,
            );
          }
          return getOpenTillSession();
        })
        .then((row) => {
          if (!cancelled) setSession(row);
        });
    }
    load();
    const unsubscribe = subscribeReplicaChanged(() => {
      void getOpenTillSession().then((row) => {
        if (!cancelled) setSession(row);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!closeDialog || !session) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void previewCloseToday(session.id).then((row) => {
      if (cancelled || !row) return;
      const { session: _s, ...expected } = row;
      setPreview(expected);
    });
    return () => {
      cancelled = true;
    };
  }, [closeDialog, session]);

  if (session === undefined) {
    return (
      <div className="text-muted-foreground text-sm tabular-nums" aria-busy="true">
        Till…
      </div>
    );
  }

  async function onStart(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await startToday({
        openingFloat: Number(floatStr) || 0,
        branchId: branchId ?? undefined,
      });
      toast.success("Today started.");
      setOpenDialog(false);
      setFloatStr("0");
      setSession(await getOpenTillSession());
    } catch (error) {
      showError(error, "Could not start today.");
    } finally {
      setPending(false);
    }
  }

  async function onClose(event: FormEvent) {
    event.preventDefault();
    if (!session?.id) return;
    setPending(true);
    try {
      const result = await closeToday({
        sessionId: session.id,
        countedCash: Number(cashStr) || 0,
        countedCard: Number(cardStr) || 0,
        countedMobileMoney: Number(momoStr) || 0,
      });
      const cashVar = result.varianceCash ?? 0;
      toast.success(
        cashVar === 0
          ? "Today closed. Cash matched."
          : `Today closed. Cash variance ${formatCurrency(cashVar)}.`,
      );
      setCloseDialog(false);
      setCashStr("");
      setCardStr("");
      setMomoStr("");
      setSession(null);
    } catch (error) {
      showError(error, "Could not close today.");
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    return (
      <>
        {compact ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-amber-800 dark:text-amber-100 text-sm">Not started</span>
            <Button type="button" size="sm" className="h-9" onClick={() => setOpenDialog(true)}>
              Start today
            </Button>
          </div>
        ) : (
          <div className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-50 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
            <p>Start today before taking sales — or the till will start automatically on the first sale.</p>
            <Button type="button" size="sm" className="h-9" onClick={() => setOpenDialog(true)}>
              Start today
            </Button>
          </div>
        )}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start today</DialogTitle>
              <DialogDescription>
                Enter the opening float (cash in the drawer). Leave at 0 if you start empty — sales
                will also auto-start with float 0.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={(event) => void onStart(event)}>
              <div className="space-y-2">
                <Label htmlFor="till-float">Opening float</Label>
                <NumericInputWithKeypad
                  id="till-float"
                  value={floatStr}
                  onChange={setFloatStr}
                  placeholder="0.00"
                />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={pending}>
                {pending ? "Starting…" : "Start today"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {compact ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-muted-foreground max-w-[14rem] truncate text-sm">
            Open · float {formatCurrency(session.openingFloat)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setCloseDialog(true)}
          >
            Close today
          </Button>
        </div>
      ) : (
        <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <p>
            Open since {formatDateTime(session.openedAt)} · float{" "}
            {formatCurrency(session.openingFloat)}
            {session.autoStarted ? " · auto-started" : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => setCloseDialog(true)}
          >
            Close today
          </Button>
        </div>
      )}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close today</DialogTitle>
            <DialogDescription>
              Count cash, card, and mobile money. Expected totals use sales on this till since start
              (including opening float for cash).
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="text-muted-foreground space-y-1 text-sm">
              <p>
                Expected cash {formatCurrency(preview.expectedCash)} · card{" "}
                {formatCurrency(preview.expectedCard)} · MoMo{" "}
                {formatCurrency(preview.expectedMobileMoney)}
              </p>
              <p>
                {preview.saleCount} sales · gross {formatCurrency(preview.grossSales)}
                {preview.expectedOnAccount > 0
                  ? ` · on account ${formatCurrency(preview.expectedOnAccount)}`
                  : ""}
                {preview.returnsTotal > 0
                  ? ` · returns ${formatCurrency(preview.returnsTotal)}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Loading expected totals…</p>
          )}
          <form className="space-y-3" onSubmit={(event) => void onClose(event)}>
            <div className="space-y-2">
              <Label htmlFor="count-cash">Counted cash</Label>
              <NumericInputWithKeypad id="count-cash" value={cashStr} onChange={setCashStr} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count-card">Counted card</Label>
              <NumericInputWithKeypad id="count-card" value={cardStr} onChange={setCardStr} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count-momo">Counted mobile money</Label>
              <NumericInputWithKeypad id="count-momo" value={momoStr} onChange={setMomoStr} />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={pending || !preview}>
              {pending ? "Closing…" : "Close today"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-ui";

export type HeldSaleListItem = {
  key: string;
  label: string;
  total: number;
  heldAt: number;
  holdRef: string;
  /** Local device hold vs server-synced hold. */
  source: "local" | "remote";
};

type ResumeMode = "replace" | "merge";

type Props = {
  heldSales: HeldSaleListItem[];
  cartHasItems: boolean;
  onResume: (key: string, mode: ResumeMode) => void | Promise<void>;
  /** Compact icon button for headers; omit for a labeled toolbar control. */
  compact?: boolean;
  className?: string;
};

export function HeldSalesPanel({
  heldSales,
  cartHasItems,
  onResume,
  compact = false,
  className,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 1279px)");
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const count = heldSales.length;

  async function applyResume(key: string, mode: ResumeMode) {
    setResuming(true);
    try {
      await onResume(key, mode);
      setPendingKey(null);
      setOpen(false);
    } finally {
      setResuming(false);
    }
  }

  function requestResume(key: string) {
    if (cartHasItems) {
      setPendingKey(key);
      return;
    }
    void applyResume(key, "replace");
  }

  const trigger = (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon" : "default"}
      className={cn(
        compact
          ? "relative size-8 shrink-0"
          : // Match Sales toolbar SelectTrigger heights (min-h-10 / sm:h-9).
            "relative h-10 shrink-0 gap-1.5 px-3 sm:h-9",
        className,
      )}
      aria-label={
        count > 0
          ? `Held sales, ${count} held`
          : "Held sales, none held"
      }
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
      data-tour="held-sales-trigger"
    >
      <Clock className="h-4 w-4" aria-hidden />
      {compact ? null : <span>Held</span>}
      {count > 0 ? (
        <Badge
          variant="default"
          className={cn(
            "pointer-events-none min-w-5 justify-center px-1.5 py-0 text-[10px] leading-4",
            compact && "absolute -top-1 -right-1",
          )}
          data-tour="held-sales-badge"
          aria-hidden
        >
          {count > 99 ? "99+" : count}
        </Badge>
      ) : null}
    </Button>
  );

  const list = (
    <div className="space-y-2" data-tour="held-sales-list">
      {heldSales.length === 0 ? (
        <p className="text-muted-foreground text-sm">No held sales.</p>
      ) : (
        heldSales.map((sale) => (
          <div
            key={sale.key}
            className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {sale.label}
                <span className="text-muted-foreground font-normal"> · #{sale.holdRef}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(sale.heldAt)} · {formatCurrency(sale.total)}
                {sale.source === "local" ? " · This device" : " · Synced"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              aria-label={`Resume held sale ${sale.holdRef}`}
              onClick={() => requestResume(sale.key)}
            >
              Resume
            </Button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {trigger}

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[min(92dvh,100dvh)] w-full max-w-none flex-col gap-0 rounded-t-[22px] p-0"
            data-tour="held-sales-sheet"
          >
            <SheetHeader className="border-border shrink-0 border-b px-4 py-4 text-left">
              <SheetTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden />
                Held sales
                {count > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {count}
                  </Badge>
                ) : null}
              </SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{list}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="flex max-h-[min(80dvh,560px)] max-w-md flex-col gap-0 p-0"
            data-tour="held-sales-dialog"
          >
            <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden />
                Held sales
                {count > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {count}
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Resume a previously held sale. Newest holds appear first.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{list}</div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={pendingKey != null}
        onOpenChange={(next) => {
          if (!next) setPendingKey(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cart already has items</DialogTitle>
            <DialogDescription>
              Replace the current cart with this held sale, or merge the held items into the cart?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={resuming}
              onClick={() => setPendingKey(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={resuming || !pendingKey}
              onClick={() => {
                if (pendingKey) void applyResume(pendingKey, "merge");
              }}
            >
              {resuming ? "Working…" : "Merge"}
            </Button>
            <Button
              type="button"
              disabled={resuming || !pendingKey}
              onClick={() => {
                if (pendingKey) void applyResume(pendingKey, "replace");
              }}
            >
              {resuming ? "Working…" : "Replace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type CashTenderChangeProps = {
  total: number;
  /** Clear when cart empties after pay / hold. */
  active: boolean;
  compact?: boolean;
  className?: string;
};

/**
 * Optional cashier aid: amount paid → auto change. UI-only — never persisted
 * or printed on receipts.
 */
export function CashTenderChange({
  total,
  active,
  compact = false,
  className,
}: CashTenderChangeProps) {
  const [amountPaid, setAmountPaid] = useState("");

  useEffect(() => {
    if (!active) setAmountPaid("");
  }, [active]);

  const paid = amountPaid.trim() === "" ? null : Number(amountPaid);
  const hasPaid = paid != null && Number.isFinite(paid);
  const change =
    hasPaid && paid >= total ? Math.round((paid - total) * 100) / 100 : null;
  const short =
    hasPaid && paid < total ? Math.round((total - paid) * 100) / 100 : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "min-h-7" : "min-h-8",
        className,
      )}
    >
      <label
        htmlFor="cash-tender-paid"
        className={cn(
          "text-muted-foreground shrink-0",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        Paid
      </label>
      <Input
        id="cash-tender-paid"
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        placeholder="Optional"
        value={amountPaid}
        onChange={(e) => setAmountPaid(e.target.value)}
        className={cn(
          "min-w-0 flex-1 tabular-nums",
          compact ? "h-7 px-2 text-xs" : "h-8 px-2 text-sm",
        )}
        aria-label="Amount paid (optional)"
      />
      {change != null && change > 0 ? (
        <p
          className={cn(
            "text-success shrink-0 font-semibold tabular-nums",
            compact ? "text-xs" : "text-sm",
          )}
          aria-live="polite"
        >
          Change {formatCurrency(change)}
        </p>
      ) : short != null && short > 0 ? (
        <p
          className={cn(
            "text-destructive shrink-0 tabular-nums",
            compact ? "text-[11px]" : "text-xs",
          )}
          aria-live="polite"
        >
          Short {formatCurrency(short)}
        </p>
      ) : null}
    </div>
  );
}

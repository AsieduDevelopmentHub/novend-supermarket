"use client";

import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type CashTenderChangeProps = {
  total: number;
  /** Controlled Paid field (raw string so empty / partial entry stays editable). */
  value: string;
  onValueChange: (value: string) => void;
  compact?: boolean;
  className?: string;
};

/**
 * Cashier aid: amount paid → auto change. Value is lifted so checkout can
 * snapshot Paid / Change onto the receipt.
 */
export function CashTenderChange({
  total,
  value,
  onValueChange,
  compact = false,
  className,
}: CashTenderChangeProps) {
  const paid = value.trim() === "" ? null : Number(value);
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
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(
          "min-w-0 flex-1 tabular-nums",
          compact ? "h-7 px-2 text-xs" : "h-8 px-2 text-sm",
        )}
        aria-label="Amount paid"
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

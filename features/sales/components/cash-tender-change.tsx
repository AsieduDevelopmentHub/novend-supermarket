"use client";

import { Input } from "@/components/ui/input";
import { TouchNumpadButton } from "@/components/ui/touch-numpad";
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

/** Keep money typing keyboard-friendly (top row + numpad + locale comma). */
function sanitizeMoneyDraft(raw: string): string {
  const normalized = raw.replace(/,/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
}

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
        compact ? "min-h-7" : "min-h-9",
        className,
      )}
    >
      <label
        htmlFor="cash-tender-paid"
        className={cn(
          "text-muted-foreground shrink-0 font-medium",
          compact ? "text-[11px]" : "text-sm",
        )}
      >
        Paid
      </label>
      <Input
        id="cash-tender-paid"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="Optional"
        value={value}
        onChange={(e) => onValueChange(sanitizeMoneyDraft(e.target.value))}
        className={cn(
          "min-w-0 flex-1 font-semibold tabular-nums",
          compact ? "h-7 px-2 text-xs" : "h-9 px-2.5 text-base",
        )}
        aria-label="Amount paid"
      />
      <TouchNumpadButton
        value={value}
        onChange={onValueChange}
        className={compact ? "h-7 w-7" : "h-9 w-9"}
        label="Open paid keypad"
      />
      {change != null && change > 0 ? (
        <p
          className={cn(
            "text-success shrink-0 font-bold tabular-nums",
            compact ? "text-xs" : "text-base",
          )}
          aria-live="polite"
        >
          Change {formatCurrency(change)}
        </p>
      ) : short != null && short > 0 ? (
        <p
          className={cn(
            "text-destructive shrink-0 font-semibold tabular-nums",
            compact ? "text-[11px]" : "text-sm",
          )}
          aria-live="polite"
        >
          Short {formatCurrency(short)}
        </p>
      ) : null}
    </div>
  );
}

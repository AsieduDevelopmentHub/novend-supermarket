"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TouchNumpadButton } from "@/components/ui/touch-numpad";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payments";
import {
  evaluateSplitTender,
  newSplitDraft,
  type SplitTenderDraft,
} from "@/lib/sales/split-tender";
import { cn } from "@/lib/utils";

function sanitizeMoneyDraft(raw: string): string {
  const normalized = raw.replace(/,/g, ".");
  const cleaned = normalized.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
}

type PaymentTenderSelectorProps = {
  total: number;
  paymentMethod: PaymentMethod;
  onPaymentMethod: (method: PaymentMethod) => void;
  /** Null = single-method shortcut. An array = split tenders. */
  splitDrafts: SplitTenderDraft[] | null;
  onSplitDrafts: (drafts: SplitTenderDraft[] | null) => void;
  /** On account needs a customer and the customer_credit capability. */
  allowOnAccount: boolean;
  /** Tighter checkout footer layout. */
  compact?: boolean;
};

let draftCounter = 0;
function nextDraftId() {
  draftCounter += 1;
  return `tender-${draftCounter}`;
}

export function PaymentTenderSelector({
  total,
  paymentMethod,
  onPaymentMethod,
  splitDrafts,
  onSplitDrafts,
  allowOnAccount,
  compact = false,
}: PaymentTenderSelectorProps) {
  const options = PAYMENT_METHOD_OPTIONS.filter(
    (option) => allowOnAccount || option.value !== "on_account",
  );

  if (splitDrafts === null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-muted-foreground font-medium",
              compact ? "text-xs" : "text-sm",
            )}
          >
            Payment
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={compact ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-xs"}
            disabled={total <= 0}
            onClick={() =>
              onSplitDrafts([
                newSplitDraft(nextDraftId(), paymentMethod, null),
                newSplitDraft(
                  nextDraftId(),
                  options.find((option) => option.value !== paymentMethod)?.value ?? "cash",
                  null,
                ),
              ])
            }
          >
            Split
          </Button>
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Payment method">
          {options.map((option) => {
            const selected = paymentMethod === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                className={cn(
                  "rounded-full border font-semibold transition-colors",
                  // Keep readable type, but tighter chips so checkout stays short.
                  compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-sm",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onPaymentMethod(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const evaluation = evaluateSplitTender(splitDrafts, total, { allowOnAccount });
  const update = (id: string, patch: Partial<SplitTenderDraft>) =>
    onSplitDrafts(splitDrafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">Split payment</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onSplitDrafts(null)}
        >
          Single method
        </Button>
      </div>
      <ul className="space-y-2" aria-label="Split payment lines">
        {splitDrafts.map((draft, index) => {
          const othersAllocated = splitDrafts
            .filter((row) => row.id !== draft.id)
            .reduce((sum, row) => sum + (Number(row.amount) > 0 ? Number(row.amount) : 0), 0);
          const fill = Math.max(0, Math.round((total - othersAllocated) * 100) / 100);
          return (
            <li key={draft.id} className="flex items-center gap-2">
              <Select
                value={draft.method}
                onValueChange={(value) => update(draft.id, { method: value as PaymentMethod })}
              >
                <SelectTrigger
                  className="h-9 w-[8.5rem] shrink-0"
                  aria-label={`Payment method for line ${index + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex min-w-0 flex-1 gap-1">
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 tabular-nums"
                  value={draft.amount}
                  placeholder="0.00"
                  aria-label={`Amount for line ${index + 1}`}
                  onChange={(event) =>
                    update(draft.id, { amount: sanitizeMoneyDraft(event.target.value) })
                  }
                />
                <TouchNumpadButton
                  value={draft.amount}
                  onChange={(next) => update(draft.id, { amount: next })}
                  className="h-9 w-9"
                  label={`Keypad for line ${index + 1}`}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-2 text-xs"
                disabled={fill <= 0}
                onClick={() => update(draft.id, { amount: fill.toFixed(2) })}
              >
                Rest
              </Button>
              {splitDrafts.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label={`Remove payment line ${index + 1}`}
                  onClick={() => onSplitDrafts(splitDrafts.filter((row) => row.id !== draft.id))}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2">
        {splitDrafts.length < options.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() =>
              onSplitDrafts([
                ...splitDrafts,
                newSplitDraft(
                  nextDraftId(),
                  options.find((option) => !splitDrafts.some((row) => row.method === option.value))
                    ?.value ?? "cash",
                  evaluation.remaining > 0 ? evaluation.remaining : null,
                ),
              ])
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add tender
          </Button>
        ) : (
          <span />
        )}
        <p
          className={cn(
            "text-xs",
            evaluation.valid ? "text-muted-foreground" : "text-destructive",
          )}
          role="status"
          aria-live="polite"
        >
          {evaluation.valid
            ? `Collected ${formatCurrency(evaluation.allocated)}`
            : evaluation.remaining > 0
              ? `${formatCurrency(evaluation.remaining)} left to collect`
              : (evaluation.error ?? "Check the amounts")}
        </p>
      </div>
    </div>
  );
}

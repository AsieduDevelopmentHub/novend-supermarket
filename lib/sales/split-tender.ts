import { roundMoney } from "@/lib/currency";
import type { PaymentLine, PaymentMethod } from "@/lib/payments";
import { normalizeSalePayments } from "@/convex/shared/salePayments";

/** One editable tender row on the till (amount stays text while the cashier types). */
export type SplitTenderDraft = {
  id: string;
  method: PaymentMethod;
  amount: string;
};

export type SplitTenderEvaluation = {
  payments: PaymentLine[];
  allocated: number;
  /** Positive = still to collect, negative = over-allocated. */
  remaining: number;
  valid: boolean;
  error: string | null;
};

function parseAmount(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : 0;
}

export function evaluateSplitTender(
  drafts: ReadonlyArray<SplitTenderDraft>,
  total: number,
  options: { allowOnAccount: boolean },
): SplitTenderEvaluation {
  const lines: PaymentLine[] = drafts
    .map((draft) => ({ method: draft.method, amount: parseAmount(draft.amount) }))
    .filter((line) => line.amount > 0);
  const allocated = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const remaining = roundMoney(total - allocated);

  if (!options.allowOnAccount && lines.some((line) => line.method === "on_account")) {
    return {
      payments: [],
      allocated,
      remaining,
      valid: false,
      error: "Choose a customer to sell on account",
    };
  }
  if (lines.length === 0) {
    return { payments: [], allocated, remaining, valid: false, error: "Enter an amount to collect" };
  }
  if (Math.abs(remaining) > 0.001) {
    return {
      payments: [],
      allocated,
      remaining,
      valid: false,
      error: remaining > 0 ? "Amounts do not cover the total yet" : "Amounts exceed the total",
    };
  }
  try {
    // Same normalizer the till and Convex use, so a valid split here is valid on upload.
    const payments = normalizeSalePayments(lines, lines[0]!.method, total);
    return { payments, allocated, remaining, valid: true, error: null };
  } catch (error) {
    return {
      payments: [],
      allocated,
      remaining,
      valid: false,
      error: error instanceof Error ? error.message : "Invalid split payment",
    };
  }
}

export function newSplitDraft(
  id: string,
  method: PaymentMethod,
  amount: number | null,
): SplitTenderDraft {
  return { id, method, amount: amount !== null && amount > 0 ? amount.toFixed(2) : "" };
}

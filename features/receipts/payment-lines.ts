import { paymentMethodLabel } from "@/lib/payments";
import type { ReceiptPayload, ReceiptPaymentLine } from "./types";

export type ReceiptPaymentDisplayLine = { label: string; amount: number };

/**
 * Tender lines to print for a split or on-account sale.
 * Null means "single tender": callers keep the one-line `Payment: cash` header.
 */
export function receiptPaymentLines(
  payload: Pick<ReceiptPayload, "payments" | "kind">,
): ReceiptPaymentDisplayLine[] | null {
  if (payload.kind === "return") return null;
  const lines = payload.payments;
  if (!lines || lines.length === 0) return null;
  if (lines.length === 1 && lines[0]!.method !== "on_account") return null;
  return lines.map((line) => ({ label: paymentMethodLabel(line.method), amount: line.amount }));
}

/** Parse untrusted receipt JSON (server payload, outbox cache) into typed tender lines. */
export function parseReceiptPayments(value: unknown): ReceiptPaymentLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const lines: ReceiptPaymentLine[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const { method, amount } = row as { method?: unknown; amount?: unknown };
    if (typeof method !== "string" || typeof amount !== "number" || !Number.isFinite(amount)) {
      continue;
    }
    lines.push({ method, amount });
  }
  return lines.length > 0 ? lines : undefined;
}

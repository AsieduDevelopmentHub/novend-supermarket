import { roundMoney } from "@/lib/currency";
import { onAccountAmount } from "@/convex/shared/salePayments";
import type { NovendOfflineDb } from "./db";
import type {
  CompleteSaleOutboxPayload,
  MirroredCustomer,
  OutboxRow,
  RecordCustomerPaymentPayload,
} from "./types";

const OPEN_FOR_BALANCE = new Set(["pending", "syncing"]);

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Receivable effect (per customer) of outbox work Convex has not seen yet.
 * Failed rows are excluded: a failed sale is rolled back on the till, and a
 * failed payment must be retried or discarded explicitly.
 */
export function pendingBalanceDeltas(rows: ReadonlyArray<OutboxRow>): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (customerId: string, amount: number) => {
    deltas.set(customerId, roundMoney((deltas.get(customerId) ?? 0) + amount));
  };
  for (const row of rows) {
    if (!OPEN_FOR_BALANCE.has(row.status)) continue;
    if (row.type === "complete_sale") {
      const payload = parseJson<CompleteSaleOutboxPayload>(row.payloadJson);
      // Every queued sale carries its normalized tender lines (see completeSaleLocally).
      if (!payload?.customerId || !payload.payments) continue;
      const charge = onAccountAmount(payload.payments);
      if (charge > 0) add(payload.customerId, charge);
    } else if (row.type === "record_customer_payment") {
      const payload = parseJson<RecordCustomerPaymentPayload>(row.payloadJson);
      if (payload) add(payload.customerId, -payload.amount);
    }
  }
  return deltas;
}

/** Server balances from the snapshot plus work still waiting in the outbox. */
export function overlayPendingCustomerBalances(
  customers: MirroredCustomer[],
  rows: ReadonlyArray<OutboxRow>,
): MirroredCustomer[] {
  const deltas = pendingBalanceDeltas(rows);
  if (deltas.size === 0) return customers;
  return customers.map((customer) => {
    const delta = deltas.get(customer.id);
    if (!delta) return customer;
    return { ...customer, balance: roundMoney((customer.balance ?? 0) + delta) };
  });
}

/** Optimistic balance change on this device (sale charge, payment, rollback). */
export async function applyLocalCustomerBalanceChange(
  db: NovendOfflineDb,
  customerId: string,
  delta: number,
): Promise<void> {
  const customer = await db.customers.get(customerId);
  if (!customer) return;
  await db.customers.put({
    ...customer,
    balance: roundMoney((customer.balance ?? 0) + delta),
    updatedAt: Date.now(),
  });
}

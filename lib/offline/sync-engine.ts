import type { Id } from "@/convex/_generated/dataModel";
import { toUserMessage } from "@/lib/errors";
import {
  cleanupStaleOfflineRecords,
  recoverInterruptedSync,
  recordSyncDiagnostics,
} from "./cleanup";
import { getOfflineDb } from "./db";
import {
  claimOutboxRow,
  listPendingOutbox,
  markOutboxFailed,
  markOutboxPending,
  markOutboxSynced,
  parseCompleteSalePayload,
  parseProcessReturnPayload,
} from "./outbox";
import { markLocalSaleFailed, markLocalSaleSynced } from "./sales-repository";
import { markLocalReturnFailed, markLocalReturnSynced } from "./returns-repository";
import { pullOfflineSnapshot, type SnapshotSource } from "./snapshot";

export type CompleteSaleMutator = (args: {
  customerId?: Id<"customers">;
  customerName?: string;
  items: Array<{ productId: Id<"products">; quantity: number; discount: number }>;
  discount: number;
  paymentMethod: "cash" | "card" | "mobile_money";
  heldSaleId?: Id<"heldSales">;
  clientOperationId?: string;
}) => Promise<{
  saleId: Id<"sales">;
  invoiceNumber: string;
  total: number;
  receiptPayload: unknown;
}>;

export type ProcessReturnMutator = (args: {
  saleId: Id<"sales">;
  items: Array<{ saleItemId: Id<"saleItems">; quantity: number }>;
  reason: string;
  notes?: string;
  clientOperationId?: string;
}) => Promise<{
  returnId: Id<"saleReturns">;
  returnNumber: string;
  refundAmount: number;
  receiptPayload: unknown;
}>;

let draining = false;
let backoffUntil = 0;
let consecutiveTransientFailures = 0;

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;
const CLEANUP_EVERY_N_DRAINS = 8;
let drainCycles = 0;

function isBusinessConflict(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("insufficient stock") ||
    m.includes("product unavailable") ||
    m.includes("customer not found") ||
    m.includes("cart is empty") ||
    m.includes("cannot return") ||
    m.includes("order not found") ||
    m.includes("select at least one") ||
    m.includes("invalid")
  );
}

function nextBackoffMs(attempts: number) {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

/** Drain pending outbox ops to Convex. Safe to call frequently. */
export async function drainOutbox(options: {
  completeSale: CompleteSaleMutator;
  processReturn: ProcessReturnMutator;
  convex: SnapshotSource;
}): Promise<{ processed: number; failed: number }> {
  if (draining) return { processed: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }
  if (Date.now() < backoffUntil) {
    return { processed: 0, failed: 0 };
  }

  const db = await getOfflineDb();
  if (!db) return { processed: 0, failed: 0 };

  draining = true;
  let processed = 0;
  let failed = 0;
  let lastError: string | null = null;

  try {
    await recoverInterruptedSync(db);

    drainCycles += 1;
    if (drainCycles % CLEANUP_EVERY_N_DRAINS === 0) {
      try {
        await cleanupStaleOfflineRecords(db);
      } catch {
        /* cleanup best-effort */
      }
    }

    const pending = await listPendingOutbox(db);
    for (const row of pending) {
      const claimed = await claimOutboxRow(db, row.id);
      if (!claimed) continue;

      try {
        if (claimed.type === "complete_sale") {
          const payload = parseCompleteSalePayload(claimed);
          const result = await options.completeSale({
            customerId: payload.customerId as Id<"customers"> | undefined,
            customerName: payload.customerName,
            items: payload.items.map((i) => ({
              productId: i.productId as Id<"products">,
              quantity: i.quantity,
              discount: i.discount,
            })),
            discount: payload.discount,
            paymentMethod: payload.paymentMethod,
            heldSaleId: payload.serverHeldSaleId as Id<"heldSales"> | undefined,
            clientOperationId: claimed.clientOperationId,
          });
          await markOutboxSynced(db, claimed.id);
          await markLocalSaleSynced(payload.localSaleId, {
            saleId: result.saleId,
            invoiceNumber: result.invoiceNumber,
            receiptPayload: result.receiptPayload,
          });
          processed += 1;
          consecutiveTransientFailures = 0;
        } else if (claimed.type === "process_return") {
          const payload = parseProcessReturnPayload(claimed);
          const result = await options.processReturn({
            saleId: payload.saleId as Id<"sales">,
            items: payload.items.map((item) => ({
              saleItemId: item.saleItemId as Id<"saleItems">,
              quantity: item.quantity,
            })),
            reason: payload.reason,
            notes: payload.notes,
            clientOperationId: claimed.clientOperationId,
          });
          await markOutboxSynced(db, claimed.id);
          await markLocalReturnSynced(payload.localReturnId, {
            returnId: result.returnId,
            returnNumber: result.returnNumber,
            receiptPayload: result.receiptPayload,
          });
          processed += 1;
          consecutiveTransientFailures = 0;
        }
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Sync failed";
        const message = toUserMessage(error, "Sync failed");
        lastError = message;
        if (isBusinessConflict(raw)) {
          if (claimed.type === "process_return") {
            const payload = parseProcessReturnPayload(claimed);
            await markOutboxFailed(db, claimed.id, message);
            await markLocalReturnFailed(payload.localReturnId, message);
          } else {
            const payload = parseCompleteSalePayload(claimed);
            await markOutboxFailed(db, claimed.id, message);
            await markLocalSaleFailed(payload.localSaleId, message);
          }
          failed += 1;
        } else {
          // Network / transient — leave pending with exponential backoff
          await markOutboxPending(db, claimed.id, message);
          consecutiveTransientFailures += 1;
          backoffUntil =
            Date.now() + nextBackoffMs(Math.max(claimed.attempts, consecutiveTransientFailures));
          break;
        }
      }
    }

    if (processed > 0) {
      try {
        // Force refresh after successful sync so stock / orders stay accurate.
        await pullOfflineSnapshot(options.convex, { force: true });
      } catch {
        /* snapshot refresh best-effort */
      }
    }

    await recordSyncDiagnostics(db, {
      processed,
      failed,
      error: lastError,
    });
  } finally {
    draining = false;
  }

  return { processed, failed };
}

export function isSyncEngineBusy() {
  return draining;
}

export function getSyncBackoffRemainingMs() {
  return Math.max(0, backoffUntil - Date.now());
}

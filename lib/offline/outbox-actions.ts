import { getOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import {
  deleteOutboxRow,
  listOpenOutbox,
  markOutboxPending,
  parseCompleteSalePayload,
  parseProcessReturnPayload,
} from "./outbox";
import { discardFailedLocalSale, markLocalSaleFailed } from "./sales-repository";
import { markLocalReturnFailed } from "./returns-repository";
import type { OutboxRow } from "./types";

/** Failed / blocked uploads older than this can be cleared without per-row Discard. */
export const STALE_FAILED_OUTBOX_MS = 7 * 24 * 60 * 60 * 1000;

export async function retryOutboxEvent(id: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await markOutboxPending(db, id);
  notifyReplicaChanged();
}

export function isStaleFailedOutboxRow(
  row: OutboxRow,
  olderThanMs = STALE_FAILED_OUTBOX_MS,
  now = Date.now(),
): boolean {
  if (row.status !== "failed" && row.status !== "blocked_by_entitlement") return false;
  return row.createdAt <= now - olderThanMs;
}

/**
 * Drop week-old (or older) failed outbox rows the same way as Discard — restores
 * stock for rejected local sales. Used for cashiers who cannot navigate per-row
 * discard (and for auto-clear on drain so Global Medicine-style tills heal).
 */
export async function discardStaleFailedOutboxEvents(options?: {
  olderThanMs?: number;
}): Promise<number> {
  const olderThanMs = options?.olderThanMs ?? STALE_FAILED_OUTBOX_MS;
  const open = await listOpenOutbox();
  const now = Date.now();
  const targets = open.filter((row) => isStaleFailedOutboxRow(row, olderThanMs, now));
  for (const row of targets) {
    await discardOutboxEvent(row.id);
  }
  return targets.length;
}

/** Drop a queued event so it will not upload. Sales restore local stock first. */
export async function discardOutboxEvent(id: string) {
  const db = await getOfflineDb();
  if (!db) return;
  const row = await db.outbox.get(id);
  if (!row) return;

  if (row.type === "complete_sale") {
    const payload = parseCompleteSalePayload(row);
    await markLocalSaleFailed(payload.localSaleId, row.lastError ?? "Discarded");
    await discardFailedLocalSale(payload.localSaleId);
    await db.outbox.delete(id);
    notifyReplicaChanged();
    return;
  }

  if (row.type === "process_return") {
    const payload = parseProcessReturnPayload(row);
    await markLocalReturnFailed(payload.localReturnId, row.lastError ?? "Discarded");
    const items = await db.localReturnItems
      .where("localReturnId")
      .equals(payload.localReturnId)
      .toArray();
    if (items.length > 0) {
      await db.localReturnItems.bulkDelete(items.map((item) => item.id));
    }
    await db.localReturns.delete(payload.localReturnId);
    await db.outbox.delete(id);
    notifyReplicaChanged();
    return;
  }

  await deleteOutboxRow(id);
}

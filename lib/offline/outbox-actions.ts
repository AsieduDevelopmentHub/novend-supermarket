import { getOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import {
  deleteOutboxRow,
  markOutboxPending,
  parseCompleteSalePayload,
  parseProcessReturnPayload,
} from "./outbox";
import { discardFailedLocalSale, markLocalSaleFailed } from "./sales-repository";
import { markLocalReturnFailed } from "./returns-repository";

export async function retryOutboxEvent(id: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await markOutboxPending(db, id);
  notifyReplicaChanged();
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
    const items = await db.localReturnItems.where("localReturnId").equals(payload.localReturnId).toArray();
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

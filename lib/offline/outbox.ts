import { getOfflineDb, type NovendOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import type {
  CompleteSaleOutboxPayload,
  ProcessReturnOutboxPayload,
  OutboxOpType,
  OutboxRow,
  UpsertProductPayload,
} from "./types";
import { newClientId } from "./db";

let mirrorOnlyDepth = 0;

/** Run replica Dexie writes without enqueueing a duplicate Convex sync. */
export async function withMirrorOnly<T>(fn: () => Promise<T>): Promise<T> {
  mirrorOnlyDepth += 1;
  try {
    return await fn();
  } finally {
    mirrorOnlyDepth -= 1;
  }
}

function isMirrorOnly() {
  return mirrorOnlyDepth > 0;
}

export async function enqueueCompleteSale(
  db: NovendOfflineDb,
  clientOperationId: string,
  payload: CompleteSaleOutboxPayload,
): Promise<OutboxRow> {
  const now = Date.now();
  const row: OutboxRow = {
    id: newClientId("outbox"),
    type: "complete_sale",
    clientOperationId,
    payloadJson: JSON.stringify(payload),
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.outbox.put(row);
  notifyReplicaChanged();
  return row;
}

export async function enqueueProcessReturn(
  db: NovendOfflineDb,
  clientOperationId: string,
  payload: ProcessReturnOutboxPayload,
): Promise<OutboxRow> {
  const now = Date.now();
  const row: OutboxRow = {
    id: newClientId("outbox"),
    type: "process_return",
    clientOperationId,
    payloadJson: JSON.stringify(payload),
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.outbox.put(row);
  notifyReplicaChanged();
  return row;
}

export async function listPendingOutbox(db: NovendOfflineDb): Promise<OutboxRow[]> {
  try {
    return await db.outbox
      .where("[status+createdAt]")
      .between(["pending", 0], ["pending", Infinity])
      .toArray();
  } catch {
    const rows = await db.outbox.where("status").equals("pending").toArray();
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }
}

export async function claimOutboxRow(db: NovendOfflineDb, id: string): Promise<OutboxRow | null> {
  const row = await db.outbox.get(id);
  if (!row || (row.status !== "pending" && row.status !== "failed")) return null;
  const next: OutboxRow = {
    ...row,
    status: "syncing",
    attempts: row.attempts + 1,
    updatedAt: Date.now(),
  };
  await db.outbox.put(next);
  return next;
}

export async function markOutboxSynced(db: NovendOfflineDb, id: string) {
  const row = await db.outbox.get(id);
  if (!row) return;
  await db.outbox.put({
    ...row,
    status: "synced",
    lastError: undefined,
    updatedAt: Date.now(),
  });
}

export async function markOutboxFailed(db: NovendOfflineDb, id: string, error: string) {
  const row = await db.outbox.get(id);
  if (!row) return;
  await db.outbox.put({
    ...row,
    status: "failed",
    lastError: error,
    updatedAt: Date.now(),
  });
}

export async function markOutboxPending(db: NovendOfflineDb, id: string, error?: string) {
  const row = await db.outbox.get(id);
  if (!row) return;
  await db.outbox.put({
    ...row,
    status: "pending",
    lastError: error,
    updatedAt: Date.now(),
  });
}

const OPEN_STATUSES: OutboxRow["status"][] = ["pending", "syncing", "failed"];

async function findOpenUpsertProduct(
  db: NovendOfflineDb,
  localId: string,
): Promise<OutboxRow | undefined> {
  const rows = await db.outbox.toArray();
  return rows.find((row) => {
    if (row.type !== "upsert_product") return false;
    if (row.status !== "pending" && row.status !== "failed") return false;
    try {
      const payload = JSON.parse(row.payloadJson) as { localId?: string };
      return payload.localId === localId;
    } catch {
      return false;
    }
  });
}

export async function enqueueOutbox(
  db: NovendOfflineDb,
  type: OutboxOpType,
  payload: unknown,
  clientOperationId = newClientId("op"),
  options?: { notify?: boolean },
): Promise<OutboxRow> {
  const now = Date.now();
  if (type === "upsert_product") {
    const incoming = payload as UpsertProductPayload;
    const existing = await findOpenUpsertProduct(db, incoming.localId);
    if (existing) {
      const previous = JSON.parse(existing.payloadJson) as UpsertProductPayload;
      const merged: UpsertProductPayload = {
        ...incoming,
        stockQuantity: previous.stockQuantity || incoming.stockQuantity,
        branchId: previous.branchId ?? incoming.branchId,
        expiryDate: incoming.expiryDate ?? previous.expiryDate,
      };
      const next: OutboxRow = {
        ...existing,
        payloadJson: JSON.stringify(merged),
        status: "pending",
        lastError: undefined,
        updatedAt: now,
      };
      await db.outbox.put(next);
      if (options?.notify !== false) {
        notifyReplicaChanged();
      }
      return next;
    }
  }
  const row: OutboxRow = {
    id: newClientId("outbox"),
    type,
    clientOperationId,
    payloadJson: JSON.stringify(payload),
    status: isMirrorOnly() ? "synced" : "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (!isMirrorOnly()) {
    await db.outbox.put(row);
  }
  if (options?.notify !== false) {
    notifyReplicaChanged();
  }
  return row;
}

export async function replaceIdInPendingOutbox(db: NovendOfflineDb, fromId: string, toId: string) {
  if (!fromId || fromId === toId) return;
  const pending = await listPendingOutbox(db);
  for (const row of pending) {
    if (!row.payloadJson.includes(fromId)) continue;
    await db.outbox.put({
      ...row,
      payloadJson: row.payloadJson.split(fromId).join(toId),
      updatedAt: Date.now(),
    });
  }
}

export async function countOutboxByStatus() {
  const db = await getOfflineDb();
  if (!db) return { pending: 0, failed: 0, syncing: 0 };
  const [pending, failed, syncing] = await Promise.all([
    db.outbox.where("status").equals("pending").count(),
    db.outbox.where("status").equals("failed").count(),
    db.outbox.where("status").equals("syncing").count(),
  ]);
  return { pending, failed, syncing };
}

export async function retryFailedOutbox(db: NovendOfflineDb, id: string) {
  await markOutboxPending(db, id);
}

export function parseCompleteSalePayload(row: OutboxRow): CompleteSaleOutboxPayload {
  return JSON.parse(row.payloadJson) as CompleteSaleOutboxPayload;
}

export function parseProcessReturnPayload(row: OutboxRow): ProcessReturnOutboxPayload {
  return JSON.parse(row.payloadJson) as ProcessReturnOutboxPayload;
}

export async function listOpenOutbox(): Promise<OutboxRow[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const rows = await db.outbox.toArray();
  return rows
    .filter((row) => OPEN_STATUSES.includes(row.status))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listRecentSyncedOutbox(limit = 12): Promise<OutboxRow[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const rows = await db.outbox.where("status").equals("synced").toArray();
  return rows.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export async function deleteOutboxRow(id: string) {
  const db = await getOfflineDb();
  if (!db) return;
  await db.outbox.delete(id);
  notifyReplicaChanged();
}

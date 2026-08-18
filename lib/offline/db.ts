import Dexie, { type EntityTable } from "dexie";
import type {
  LocalHeldSale,
  LocalReceipt,
  LocalSale,
  LocalSaleItem,
  MirroredCategory,
  MirroredCustomer,
  MirroredOrder,
  MirroredProduct,
  OfflineMeta,
  OutboxRow,
  LocalReturn,
  LocalReturnItem,
  MirroredOrderItem,
} from "./types";

export type PrincellenOfflineDb = NovendOfflineDb;
export type NovendOfflineDb = Dexie & {
  meta: EntityTable<OfflineMeta, "key">;
  products: EntityTable<MirroredProduct, "id">;
  categories: EntityTable<MirroredCategory, "id">;
  customers: EntityTable<MirroredCustomer, "id">;
  orders: EntityTable<MirroredOrder, "id">;
  orderItems: EntityTable<MirroredOrderItem, "id">;
  heldSales: EntityTable<LocalHeldSale, "id">;
  localSales: EntityTable<LocalSale, "id">;
  localSaleItems: EntityTable<LocalSaleItem, "id">;
  localReceipts: EntityTable<LocalReceipt, "id">;
  localReturns: EntityTable<LocalReturn, "id">;
  localReturnItems: EntityTable<LocalReturnItem, "id">;
  outbox: EntityTable<OutboxRow, "id">;
};

let dbInstance: NovendOfflineDb | null = null;
let dbFailed = false;

export function createOfflineDb(organizationId?: string): NovendOfflineDb {
  const suffix = organizationId ? `-${organizationId}` : "anon";
  const db = new Dexie(`novend-offline-${suffix}`) as NovendOfflineDb;
  db.version(1).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId",
    categories: "id, name, isActive",
    customers: "id, name, status",
    heldSales: "id, cashierId, heldAt",
    localSales: "id, clientOperationId, syncStatus, completedAt, invoiceNumber",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    outbox: "id, status, createdAt, clientOperationId, type",
  });
  // v2: compound indexes for sync drain + cleanup performance on large offline datasets.
  db.version(2).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  });
  // v3: mirror recent Convex orders + richer customer purchase stats.
  db.version(3).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  });
  db.version(4).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId",
    orderItems: "id, orderId, productId",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    localReturns: "id, clientOperationId, saleId, syncStatus, completedAt",
    localReturnItems: "id, localReturnId, saleItemId",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  });
  return db;
}

/** Opens IndexedDB; returns null if unavailable (private mode / blocked). */
export async function getOfflineDb(): Promise<PrincellenOfflineDb | null> {
  if (dbFailed) return null;
  if (dbInstance) return dbInstance;

  try {
    const db = createOfflineDb();
    await db.open();
    dbInstance = db;
    return db;
  } catch (error) {
    console.info("[offline] IndexedDB unavailable — online-only mode", error);
    dbFailed = true;
    dbInstance = null;
    return null;
  }
}

export function isOfflineDbAvailable() {
  return !dbFailed && dbInstance !== null;
}

export const META_KEYS = {
  deviceId: "deviceId",
  invoiceSeq: "invoiceSeq",
  lastSnapshotAt: "lastSnapshotAt",
  printSnapshot: "printSnapshot",
  dashboardSummary: "dashboardSummary",
  profileName: "profileName",
  profileUserId: "profileUserId",
  profileRole: "profileRole",
  profileBranchId: "profileBranchId",
  profileBranchName: "profileBranchName",
  profileImageUrl: "profileImageUrl",
  profileEmail: "profileEmail",
  profilePhone: "profilePhone",
  profileOrganizationName: "profileOrganizationName",
  lastCleanupAt: "lastCleanupAt",
  lastSyncAt: "lastSyncAt",
  lastSyncProcessed: "lastSyncProcessed",
  lastSyncFailed: "lastSyncFailed",
  lastSyncError: "lastSyncError",
} as const;

export async function getMeta(db: PrincellenOfflineDb, key: string): Promise<string | null> {
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(db: PrincellenOfflineDb, key: string, value: string) {
  await db.meta.put({ key, value });
}

export async function ensureDeviceId(db: PrincellenOfflineDb): Promise<string> {
  const existing = await getMeta(db, META_KEYS.deviceId);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setMeta(db, META_KEYS.deviceId, id);
  return id;
}

export async function nextProvisionalInvoice(db: PrincellenOfflineDb): Promise<string> {
  const deviceId = await ensureDeviceId(db);
  const short = deviceId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const raw = await getMeta(db, META_KEYS.invoiceSeq);
  const seq = (raw ? Number.parseInt(raw, 10) : 0) + 1;
  await setMeta(db, META_KEYS.invoiceSeq, String(seq));
  return `OFF-${short}-${String(seq).padStart(4, "0")}`;
}

export function newClientId(prefix = "op"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

import Dexie, { type EntityTable } from "dexie";
import { allocateInvoiceNumber } from "@/convex/shared/documentReferences";
import type {
  LocalHeldSale,
  LocalReceipt,
  LocalSale,
  LocalSaleItem,
  MirroredBranch,
  MirroredBranchStock,
  MirroredCategory,
  MirroredCustomer,
  MirroredExpense,
  MirroredLot,
  MirroredOrder,
  MirroredOrderItem,
  MirroredProduct,
  MirroredReturn,
  MirroredSupplier,
  MirroredUser,
  MirroredWholesalePurchase,
  MirroredWholesaleStock,
  MirroredWholesaleTransfer,
  OfflineMeta,
  OutboxRow,
  LocalReturn,
  LocalReturnItem,
  ProductImageCache,
} from "./types";

export type NovendOfflineDb = Dexie & {
  meta: EntityTable<OfflineMeta, "key">;
  products: EntityTable<MirroredProduct, "id">;
  branchStock: EntityTable<MirroredBranchStock, "id">;
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
  suppliers: EntityTable<MirroredSupplier, "id">;
  wholesaleStock: EntityTable<MirroredWholesaleStock, "id">;
  wholesalePurchases: EntityTable<MirroredWholesalePurchase, "id">;
  wholesaleTransfers: EntityTable<MirroredWholesaleTransfer, "id">;
  branches: EntityTable<MirroredBranch, "id">;
  users: EntityTable<MirroredUser, "id">;
  expenses: EntityTable<MirroredExpense, "id">;
  returns: EntityTable<MirroredReturn, "id">;
  productImages: EntityTable<ProductImageCache, "id">;
  lots: EntityTable<MirroredLot, "id">;
  outbox: EntityTable<OutboxRow, "id">;
};

let dbInstance: NovendOfflineDb | null = null;
let dbFailed = false;
let boundOrganizationId: string | null = null;
let boundUserId: string | null = null;

const ORG_STORAGE_KEY = "novend.offlineOrganizationId";
const USER_STORAGE_KEY = "novend.offlineUserId";

function readStoredOrganizationId(): string | undefined {
  if (boundOrganizationId) return boundOrganizationId;
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem(ORG_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  return undefined;
}

function readStoredUserId(): string | undefined {
  if (boundUserId) return boundUserId;
  if (typeof window === "undefined") return undefined;
  try {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* private mode */
  }
  return undefined;
}

function replicaDbName(organizationId?: string, userId?: string) {
  const org = organizationId ?? "anon";
  return userId ? `novend-offline-${org}-${userId}` : `novend-offline-${org}`;
}

/** Bind IndexedDB to the session organization + user so cashiers don't share an admin replica. */
export function bindOfflineOrganization(organizationId: string, userId?: string) {
  boundOrganizationId = organizationId;
  dbFailed = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ORG_STORAGE_KEY, organizationId);
      if (userId) {
        boundUserId = userId;
        window.localStorage.setItem(USER_STORAGE_KEY, userId);
      }
    } catch {
      /* private mode / quota */
    }
  }
  if (userId) boundUserId = userId;
  const expectedName = replicaDbName(organizationId, userId ?? readStoredUserId());
  if (dbInstance && dbInstance.name !== expectedName) {
    dbInstance.close();
    dbInstance = null;
  }
}

/** Drop the session org binding (sign-out). Does not delete the org replica. */
export function unbindOfflineOrganization() {
  boundOrganizationId = null;
  boundUserId = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ORG_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete this organization's Dexie replicas so the next login cannot inherit
 * another user's sales, returns, or dashboard cache.
 */
export async function deleteBoundOfflineReplica(): Promise<void> {
  const org = readStoredOrganizationId();
  const names = new Set<string>();
  if (dbInstance) names.add(dbInstance.name);
  if (org) {
    names.add(replicaDbName(org, readStoredUserId()));
    names.add(replicaDbName(org));
  }

  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  boundOrganizationId = null;
  boundUserId = null;
  dbFailed = false;

  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    try {
      const listed = await indexedDB.databases();
      for (const info of listed) {
        const name = info.name;
        if (!name?.startsWith("novend-offline-")) continue;
        if (name.startsWith("novend-offline-platform-")) continue;
        if (org && name.includes(org)) names.add(name);
      }
    } catch {
      /* Safari / private mode */
    }
  }

  for (const name of names) {
    try {
      await Dexie.delete(name);
    } catch {
      /* already gone */
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ORG_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function createOfflineDb(organizationId?: string, userId?: string): NovendOfflineDb {
  const db = new Dexie(replicaDbName(organizationId, userId)) as NovendOfflineDb;
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
  db.version(5).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId, cashierId",
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
  db.version(6).stores({
    meta: "key",
    products: "id, name, sku, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId, cashierId",
    orderItems: "id, orderId, productId",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    localReturns: "id, clientOperationId, saleId, syncStatus, completedAt",
    localReturnItems: "id, localReturnId, saleItemId",
    suppliers: "id, name, status",
    wholesaleStock: "id, productId, name",
    wholesalePurchases: "id, supplierId, purchasedAt",
    wholesaleTransfers: "id, createdAt",
    branches: "id, name, status",
    users: "id, name, role, branchId",
    expenses: "id, occurredAt, branchId, category",
    returns: "id, completedAt, saleId, branchId",
    productImages: "id",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  });
  db.version(7).stores({
    meta: "key",
    products: "id, name, sku, barcode, status, categoryId, [status+name]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId, cashierId",
    orderItems: "id, orderId, productId",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    localReturns: "id, clientOperationId, saleId, syncStatus, completedAt",
    localReturnItems: "id, localReturnId, saleItemId",
    suppliers: "id, name, status",
    wholesaleStock: "id, productId, name",
    wholesalePurchases: "id, supplierId, purchasedAt",
    wholesaleTransfers: "id, createdAt",
    branches: "id, name, status",
    users: "id, name, role, branchId",
    expenses: "id, occurredAt, branchId, category",
    returns: "id, completedAt, saleId, branchId",
    productImages: "id",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  });
  const storesV8 = {
    meta: "key",
    products: "id, name, sku, barcode, status, categoryId, [status+name]",
    branchStock: "id, branchId, productId, [branchId+productId]",
    categories: "id, name, isActive",
    customers: "id, name, status, [status+name]",
    orders: "id, completedAt, invoiceNumber, branchId, customerId, cashierId",
    orderItems: "id, orderId, productId",
    heldSales: "id, cashierId, heldAt",
    localSales:
      "id, clientOperationId, syncStatus, completedAt, invoiceNumber, [syncStatus+completedAt]",
    localSaleItems: "id, localSaleId, productId",
    localReceipts: "id, localSaleId, invoiceNumber",
    localReturns: "id, clientOperationId, saleId, syncStatus, completedAt",
    localReturnItems: "id, localReturnId, saleItemId",
    suppliers: "id, name, status",
    wholesaleStock: "id, productId, name",
    wholesalePurchases: "id, supplierId, purchasedAt",
    wholesaleTransfers: "id, createdAt",
    branches: "id, name, status",
    users: "id, name, role, branchId",
    expenses: "id, occurredAt, branchId, category",
    returns: "id, completedAt, saleId, branchId",
    productImages: "id",
    outbox: "id, status, createdAt, clientOperationId, type, [status+createdAt]",
  } as const;
  db.version(8).stores(storesV8);
  // v9: rebuild missing stores (stuck v8 upgrades) + expiry lots for offline batch edits.
  db.version(9).stores({
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
  });
  return db;
}

/** Opens IndexedDB; returns null if unavailable (private mode / blocked). */
export async function getOfflineDb(): Promise<NovendOfflineDb | null> {
  if (dbFailed) return null;

  try {
    const organizationId = readStoredOrganizationId();
    const userId = readStoredUserId();
    const expectedName = replicaDbName(organizationId, userId);
    if (dbInstance && dbInstance.name !== expectedName) {
      dbInstance.close();
      dbInstance = null;
    }
    if (dbInstance) {
      if (missingRequiredStores(dbInstance).length === 0) return dbInstance;
      const staleName = dbInstance.name;
      dbInstance.close();
      dbInstance = null;
      await Dexie.delete(staleName);
    }

    const db = await openReplica(organizationId, userId);
    dbInstance = db;
    return db;
  } catch (error) {
    console.info("[offline] IndexedDB unavailable — online-only mode", error);
    dbFailed = true;
    dbInstance = null;
    return null;
  }
}

const REQUIRED_OFFLINE_STORES = [
  "meta",
  "products",
  "branchStock",
  "branches",
  "productImages",
  "outbox",
  "lots",
] as const;

function idbHasStore(db: Dexie, name: string) {
  try {
    return db.backendDB().objectStoreNames.contains(name);
  } catch {
    return db.tables.some((table) => table.name === name);
  }
}

function missingRequiredStores(db: Dexie) {
  return REQUIRED_OFFLINE_STORES.filter((name) => !idbHasStore(db, name));
}

async function rebuildReplica(organizationId?: string, userId?: string): Promise<NovendOfflineDb> {
  const name = replicaDbName(organizationId, userId);
  try {
    await Dexie.delete(name);
  } catch {
    /* already gone */
  }
  const fresh = createOfflineDb(organizationId, userId);
  await fresh.open();
  return fresh;
}

async function openReplica(organizationId?: string, userId?: string): Promise<NovendOfflineDb> {
  const db = createOfflineDb(organizationId, userId);
  await db.open();
  if (missingRequiredStores(db).length === 0) return db;

  console.info(
    "[offline] IndexedDB missing stores — rebuilding replica",
    missingRequiredStores(db),
  );
  db.close();
  return rebuildReplica(organizationId, userId);
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
  licenseSnapshot: "licenseSnapshot",
  billingOverview: "billingOverview",
  billingHistory: "billingHistory",
  posPreferences: "posPreferences",
  lastCleanupAt: "lastCleanupAt",
  lastSyncAt: "lastSyncAt",
  lastSyncProcessed: "lastSyncProcessed",
  lastSyncFailed: "lastSyncFailed",
  lastSyncError: "lastSyncError",
  replicaSchemaVersion: "replicaSchemaVersion",
  profileOrganizationId: "profileOrganizationId",
  tourProgress: "tourProgress",
  platformOverview: "platformOverview",
  platformOrganizations: "platformOrganizations",
  platformReleases: "platformReleases",
  platformOrgDetail: "platformOrgDetail",
  platformRevenue: "platformRevenue",
  platformSubscriptions: "platformSubscriptions",
  platformOperatingCosts: "platformOperatingCosts",
  platformHealth: "platformHealth",
  platformPaymentDetail: "platformPaymentDetail",
  platformReleaseDetail: "platformReleaseDetail",
  platformCostDraftQueue: "platformCostDraftQueue",
  platformInsight: "platformInsight",
  platformReleaseBundles: "platformReleaseBundles",
  platformMonitoring: "platformMonitoring",
  platformActivity: "platformActivity",
} as const;

/** Bump when Dexie adds replica tables so TTL snapshot skips cannot leave new stores empty. */
export const REPLICA_SCHEMA_VERSION = "10";

export async function getMeta(db: NovendOfflineDb, key: string): Promise<string | null> {
  try {
    const row = await db.meta.get(key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setMeta(db: NovendOfflineDb, key: string, value: string) {
  await db.meta.put({ key, value });
}

export async function ensureDeviceId(db: NovendOfflineDb): Promise<string> {
  const existing = await getMeta(db, META_KEYS.deviceId);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await setMeta(db, META_KEYS.deviceId, id);
  return id;
}

/** Invoice printed at checkout. Convex stores this same number on sync. */
export function nextProvisionalInvoice(): string {
  return allocateInvoiceNumber();
}

export function newClientId(prefix = "op"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

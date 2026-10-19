import Dexie, { type EntityTable } from "dexie";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { allocateInvoiceNumber } from "@/convex/shared/documentReferences";
import type {
  LocalHeldSale,
  LocalReceipt,
  LocalSale,
  LocalSaleItem,
  LocalTillSession,
  MirroredBranch,
  MirroredBranchStock,
  MirroredCategory,
  MirroredCustomer,
  MirroredCustomerGroup,
  MirroredCustomerLedgerEntry,
  MirroredPriceListRule,
  MirroredWholesaleLot,
  MirroredExpense,
  MirroredLot,
  MirroredOrder,
  MirroredOrderItem,
  MirroredProduct,
  MirroredReturn,
  MirroredStaffCompensation,
  MirroredSupplier,
  MirroredSupplierPayment,
  MirroredUser,
  MirroredWholesalePurchase,
  MirroredWholesaleStock,
  MirroredWholesaleTransfer,
  MirroredDiningTable,
  MirroredDiningSession,
  MirroredDiningSessionItem,
  MirroredKitchenTicket,
  MirroredHotelRoom,
  MirroredHotelReservation,
  MirroredHotelStay,
  MirroredHotelFolioCharge,
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
  supplierPayments: EntityTable<MirroredSupplierPayment, "id">;
  wholesaleTransfers: EntityTable<MirroredWholesaleTransfer, "id">;
  branches: EntityTable<MirroredBranch, "id">;
  users: EntityTable<MirroredUser, "id">;
  staffCompensation: EntityTable<MirroredStaffCompensation, "id">;
  expenses: EntityTable<MirroredExpense, "id">;
  returns: EntityTable<MirroredReturn, "id">;
  productImages: EntityTable<ProductImageCache, "id">;
  lots: EntityTable<MirroredLot, "id">;
  diningTables: EntityTable<MirroredDiningTable, "id">;
  diningSessions: EntityTable<MirroredDiningSession, "id">;
  diningSessionItems: EntityTable<MirroredDiningSessionItem, "id">;
  kitchenTickets: EntityTable<MirroredKitchenTicket, "id">;
  hotelRooms: EntityTable<MirroredHotelRoom, "id">;
  hotelReservations: EntityTable<MirroredHotelReservation, "id">;
  hotelStays: EntityTable<MirroredHotelStay, "id">;
  hotelFolioCharges: EntityTable<MirroredHotelFolioCharge, "id">;
  wholesaleLots: EntityTable<MirroredWholesaleLot, "id">;
  customerLedger: EntityTable<MirroredCustomerLedgerEntry, "id">;
  customerGroups: EntityTable<MirroredCustomerGroup, "id">;
  priceListRules: EntityTable<MirroredPriceListRule, "id">;
  tillSessions: EntityTable<LocalTillSession, "id">;
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

/** Dexie database name for an org (and optional user) replica. */
export function offlineReplicaDbName(organizationId?: string, userId?: string) {
  const org = organizationId ?? "anon";
  // Millie's single till: all staff share one org replica (catalog + stock + sales).
  if (FULLY_OFFLINE) return `novend-offline-${org}`;
  return userId ? `novend-offline-${org}-${userId}` : `novend-offline-${org}`;
}

function replicaDbName(organizationId?: string, userId?: string) {
  return offlineReplicaDbName(organizationId, userId);
}

/**
 * Logout may only delete the bound organization's offline replicas (including
 * product image blobs in those DBs). Never delete another tenant's Dexie DB or
 * the platform Super Admin replica.
 */
export function shouldDeleteOfflineReplicaOnLogout(
  dbName: string,
  boundOrganizationId: string | null,
): boolean {
  if (!dbName.startsWith("novend-offline-")) return false;
  if (dbName.startsWith("novend-offline-platform-")) return false;
  if (!boundOrganizationId) return false;
  const rest = dbName.slice("novend-offline-".length);
  return rest === boundOrganizationId || rest.startsWith(`${boundOrganizationId}-`);
}

/** Bind IndexedDB to the session organization (+ user when not fully offline). */
export function bindOfflineOrganization(organizationId: string, userId?: string) {
  boundOrganizationId = organizationId;
  dbFailed = false;
  const scopedUserId = FULLY_OFFLINE ? undefined : userId;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ORG_STORAGE_KEY, organizationId);
      if (FULLY_OFFLINE) {
        boundUserId = null;
        window.localStorage.removeItem(USER_STORAGE_KEY);
      } else if (scopedUserId) {
        boundUserId = scopedUserId;
        window.localStorage.setItem(USER_STORAGE_KEY, scopedUserId);
      }
    } catch {
      /* private mode / quota */
    }
  }
  if (scopedUserId) boundUserId = scopedUserId;
  const expectedName = replicaDbName(
    organizationId,
    FULLY_OFFLINE ? undefined : scopedUserId ?? readStoredUserId(),
  );
  if (dbInstance && dbInstance.name !== expectedName) {
    dbInstance.close();
    dbInstance = null;
  }
}

/** Current org binding (in-memory or localStorage). Used to skip tenant sync on PEAS. */
export function getBoundOrganizationId(): string | null {
  return readStoredOrganizationId() ?? null;
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
 * Delete only the *current user's* Dexie replica so another cashier's offline
 * shell on this shared till is preserved. Org-wide wipe belongs on privacy reset.
 */
export async function deleteBoundOfflineReplica(): Promise<void> {
  const org = readStoredOrganizationId() ?? null;
  const userId = readStoredUserId() ?? null;
  const names = new Set<string>();
  const currentName = userId && org ? replicaDbName(org, userId) : dbInstance?.name;
  if (currentName && shouldDeleteOfflineReplicaOnLogout(currentName, org)) {
    names.add(currentName);
  }
  if (dbInstance && shouldDeleteOfflineReplicaOnLogout(dbInstance.name, org)) {
    // Prefer the bound user replica; never expand to every `org-*` cashier DB.
    if (!userId || dbInstance.name === replicaDbName(org ?? undefined, userId)) {
      names.add(dbInstance.name);
    }
  }

  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  boundOrganizationId = null;
  boundUserId = null;
  dbFailed = false;

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
  db.version(10).stores({
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
    staffCompensation: "id",
    expenses:
      "id, occurredAt, branchId, category, beneficiaryProfileId, payPeriodKey, sourceKind, recordedByUserId",
  });
  // v11: Phase B dining floor mirror (tables); open checks stay online-authoritative.
  db.version(11).stores({
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
    staffCompensation: "id",
    expenses:
      "id, occurredAt, branchId, category, beneficiaryProfileId, payPeriodKey, sourceKind, recordedByUserId",
    diningTables: "id, branchId, status, name",
  });
  // v12: Phase C hotel rooms mirror; stays/folio stay online-authoritative.
  db.version(12).stores({
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
    staffCompensation: "id",
    expenses:
      "id, occurredAt, branchId, category, beneficiaryProfileId, payPeriodKey, sourceKind, recordedByUserId",
    diningTables: "id, branchId, status, name",
    hotelRooms: "id, branchId, status, name",
  });
  // v13: Phase D open hospitality ops mirrors (sessions, tickets, stays, reservations, folio).
  db.version(13).stores({
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
    staffCompensation: "id",
    expenses:
      "id, occurredAt, branchId, category, beneficiaryProfileId, payPeriodKey, sourceKind, recordedByUserId",
    diningTables: "id, branchId, status, name",
    diningSessions: "id, branchId, tableId, status, openedAt",
    diningSessionItems: "id, sessionId, productId, kitchenStatus",
    kitchenTickets: "id, branchId, sessionId, status, firedAt",
    hotelRooms: "id, branchId, status, name",
    hotelReservations: "id, branchId, roomId, status, arrivalDate, customerId",
    hotelStays: "id, branchId, roomId, status, checkInAt, customerId",
    hotelFolioCharges: "id, stayId, status, createdAt",
  });
  // v14: supplier payment ledger. Purchase amountPaid is a field on the existing purchase store.
  const storesV14 = {
    ...storesV8,
    lots: "id, productId, branchId, expiryDate, [productId+branchId]",
    staffCompensation: "id",
    expenses:
      "id, occurredAt, branchId, category, beneficiaryProfileId, payPeriodKey, sourceKind, recordedByUserId",
    diningTables: "id, branchId, status, name",
    diningSessions: "id, branchId, tableId, status, openedAt",
    diningSessionItems: "id, sessionId, productId, kitchenStatus",
    kitchenTickets: "id, branchId, sessionId, status, firedAt",
    hotelRooms: "id, branchId, status, name",
    hotelReservations: "id, branchId, roomId, status, arrivalDate, customerId",
    hotelStays: "id, branchId, roomId, status, checkInAt, customerId",
    hotelFolioCharges: "id, stayId, status, createdAt",
    supplierPayments: "id, supplierId, purchaseId, paidAt",
  } as const;
  db.version(14).stores(storesV14);
  // v15: warehouse lots (offline FEFO), customer receivable ledger, price lists.
  const storesV15 = {
    ...storesV14,
    wholesaleLots: "id, productId, expiryDate, [productId+expiryDate]",
    customerLedger: "id, customerId, occurredAt, [customerId+occurredAt]",
    customerGroups: "id, name, status",
    priceListRules: "id, productId, categoryId, groupId, active",
  } as const;
  db.version(15).stores(storesV15);
  // v16: local till / cash-up sessions (Millie's Dexie-only end of day).
  db.version(16).stores({
    ...storesV15,
    tillSessions: "id, cashierId, status, openedAt, [cashierId+status], branchId",
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
  /** JSON array of AppPermission strings for Millie's staff overrides. */
  profilePermissions: "profilePermissions",
  profileBranchId: "profileBranchId",
  profileBranchName: "profileBranchName",
  profileImageUrl: "profileImageUrl",
  profileEmail: "profileEmail",
  profilePhone: "profilePhone",
  profileOrganizationName: "profileOrganizationName",
  licenseSnapshot: "licenseSnapshot",
  /** Durable evidence that this installation previously received a valid licence. */
  licenseActivated: "licenseActivated",
  billingOverview: "billingOverview",
  billingHistory: "billingHistory",
  posPreferences: "posPreferences",
  businessCapabilities: "businessCapabilities",
  /** Resolved industry terminology (+ overrides) for offline nav / headers. */
  businessTerminology: "businessTerminology",
  productImagesPolicy: "productImagesPolicy",
  expiryPolicy: "expiryPolicy",
  /** VAT settings when tax_vat capability is on; JSON { ratePercent, label }. */
  taxVat: "taxVat",
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
  /** Last platform telemetry heartbeat: JSON { signature, sentAt }. */
  telemetryHeartbeat: "telemetryHeartbeat",
  /** Last automatic backup_only / snapshot_only cloud upload timestamp (ms). */
  scheduledCloudBackupAt: "scheduledCloudBackupAt",
  /** Last start of a scheduled upload attempt (success or fail) — cooldown / anti-storm. */
  scheduledCloudBackupAttemptAt: "scheduledCloudBackupAttemptAt",
  /** Last automatic local-folder `.novend-backup` write (ms). */
  scheduledLocalFolderBackupAt: "scheduledLocalFolderBackupAt",
  /** Last start of a local-folder backup attempt — cooldown / anti-storm. */
  scheduledLocalFolderBackupAttemptAt: "scheduledLocalFolderBackupAttemptAt",
  /** "1" when an org recovery key is sealed on this device. */
  recoveryKeySealed: "recoveryKeySealed",
  /** JSON { userId, at } — login instant waiting to upload as the clock-in. */
  pendingClockIn: "pendingClockIn",
} as const;

/** Bump when Dexie adds replica tables so TTL snapshot skips cannot leave new stores empty. */
export const REPLICA_SCHEMA_VERSION = "16";

export async function getMeta(db: NovendOfflineDb, key: string): Promise<string | null> {
  try {
    const row = await db.meta.get(key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setMeta(db: NovendOfflineDb, key: string, value: string) {
  try {
    await db.meta.put({ key, value });
  } catch (error) {
    // Stale connection after replica rebuild — drop cache and retry once on a fresh open.
    const message = error instanceof Error ? error.message : String(error);
    if (!/object store|NotFoundError/i.test(message)) throw error;
    if (dbInstance === db) {
      try {
        dbInstance.close();
      } catch {
        /* ignore */
      }
      dbInstance = null;
    }
    const fresh = await getOfflineDb();
    if (!fresh) throw error;
    await fresh.meta.put({ key, value });
  }
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

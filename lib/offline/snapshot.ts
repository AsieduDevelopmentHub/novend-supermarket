import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import {
  ensureDeviceId,
  getMeta,
  getOfflineDb,
  META_KEYS,
  REPLICA_SCHEMA_VERSION,
  setMeta,
  type NovendOfflineDb,
} from "./db";
import { getLastSnapshotAt, SNAPSHOT_PULL_TTL_MS } from "./freshness";
import { cacheProductImages } from "./image-cache";
import {
  notifyReplicaChanged,
  replicaWriteEpoch,
  shouldApplyFetchedSnapshot,
} from "./replica-events";
import {
  productMatchesBarcode,
  productMatchesQuery,
  resolveBarcodeMatch,
} from "./barcode-lookup";
import {
  branchStockMapForBranch,
  resolveCatalogBranchId,
  sellableQuantityForBranch,
} from "./branch-stock";
import { catalogSearchRank, salesCatalogResultLimit } from "@/constants/sales-catalog";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { saveShellProfile } from "./shell-profile";
import type { OrganizationBusinessConfiguration } from "@/convex/shared/businessCapabilities";
import { DEFAULT_BUSINESS_CONFIGURATION } from "@/convex/shared/businessCapabilities";
import type { BusinessTermsMap, BusinessTerminologyOverrides } from "@/convex/shared/businessTerms";
import { DEFAULT_BUSINESS_TERMS } from "@/convex/shared/businessTerms";
import { productTracksInventory } from "@/convex/shared/productInventory";
import { loadBusinessCapabilitiesCache } from "./business-capabilities";
import type { ProductImagesPolicy } from "@/convex/shared/productImagesPolicy";
import { DEFAULT_PRODUCT_IMAGES_POLICY } from "@/convex/shared/productImagesPolicy";
import type { ExpiryPolicy } from "@/convex/shared/expiryPolicy";
import { DEFAULT_EXPIRY_POLICY } from "@/convex/shared/expiryPolicy";
import {
  mergeTourProgress,
  parseTourProgress,
  saveTourProgress,
  type StoredTourProgress,
} from "./tour-progress-cache";
import {
  mergeServerAndLocalById,
  mergeWholesaleStock,
  overlayPendingBranchStock,
  overlayPendingSupplierPayments,
  overlayPendingWholesaleStock,
  pendingLocalIdsFromOutbox,
  sameExpense,
  sameReturnNumber,
  sameWholesalePurchase,
  sameWholesaleTransfer,
} from "./replica-dedupe";
import { withReceiptQuantities } from "./sale-upload-lines";
import { overlayPendingCustomerBalances } from "./customer-credit";
import { replayPendingWarehouseLots } from "./wholesale-lots";
import type {
  MirroredBranch,
  MirroredBranchStock,
  MirroredCategory,
  MirroredCustomer,
  MirroredCustomerGroup,
  MirroredCustomerLedgerEntry,
  MirroredPriceListRule,
  MirroredWholesaleLot,
  MirroredDiningTable,
  MirroredDiningSession,
  MirroredDiningSessionItem,
  MirroredKitchenTicket,
  MirroredHotelRoom,
  MirroredHotelReservation,
  MirroredHotelStay,
  MirroredHotelFolioCharge,
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
  PrintSnapshot,
} from "./types";

export type SnapshotSource = {
  query: ConvexReactClient["query"];
};

export type PullOfflineSnapshotOptions = {
  /** Bypass TTL and always fetch from Convex. */
  force?: boolean;
};

async function replaceServerRows<T extends { id: string }>(
  table: {
    filter: (fn: (row: T) => boolean) => { toArray: () => Promise<T[]> };
    clear: () => Promise<void>;
    bulkPut: (rows: T[]) => Promise<unknown>;
  },
  rows: T[],
  pendingLocalIds: Set<string>,
  isSame?: (server: T, local: T) => boolean,
) {
  const localOnly = await table.filter((row) => row.id.startsWith("local_")).toArray();
  const merged = mergeServerAndLocalById(rows, localOnly, pendingLocalIds, isSame);
  await table.clear();
  if (merged.length > 0) {
    await table.bulkPut(merged);
  }
}

async function replaceWholesaleStockRows(
  table: {
    filter: (fn: (row: MirroredWholesaleStock) => boolean) => {
      toArray: () => Promise<MirroredWholesaleStock[]>;
    };
    clear: () => Promise<void>;
    bulkPut: (rows: MirroredWholesaleStock[]) => Promise<unknown>;
  },
  rows: MirroredWholesaleStock[],
  pendingLocalIds: Set<string>,
) {
  const localOnly = await table.filter((row) => row.id.startsWith("local_")).toArray();
  const merged = mergeWholesaleStock(rows, localOnly, pendingLocalIds);
  await table.clear();
  if (merged.length > 0) {
    await table.bulkPut(merged);
  }
}

/** Pull catalog + customers + orders + print settings into Dexie. */
export async function pullOfflineSnapshot(
  convex: SnapshotSource,
  options: PullOfflineSnapshotOptions = {},
): Promise<{
  productCount: number;
  customerCount: number;
  orderCount: number;
  skipped: boolean;
} | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  await ensureDeviceId(db);

  if (!options.force) {
    try {
      const lastAt = await getLastSnapshotAt();
      const replicaVersion = await getMeta(db, META_KEYS.replicaSchemaVersion);
      const branchCount = await db.branches.count();
      // Throws if the lots store is missing (stuck upgrade) so we pull a full snapshot.
      await db.lots.limit(1).count();
      const replicaComplete = replicaVersion === REPLICA_SCHEMA_VERSION && branchCount > 0;
      if (lastAt && Date.now() - lastAt < SNAPSHOT_PULL_TTL_MS && replicaComplete) {
        const [productCount, customerCount, orderCount] = await Promise.all([
          db.products.count(),
          db.customers.count(),
          db.orders.count(),
        ]);
        if (productCount > 0) {
          notifyReplicaChanged({ silent: true });
          return { productCount, customerCount, orderCount, skipped: true };
        }
      }
    } catch {
      /* Missing stores — fall through to a full snapshot after Dexie repair. */
    }
  }

  const epochAtStart = replicaWriteEpoch();
  const snapshot = await convex.query(api.offline.getSnapshot, {});
  if (!shouldApplyFetchedSnapshot(epochAtStart)) {
    return { productCount: 0, customerCount: 0, orderCount: 0, skipped: true };
  }
  await applySnapshot(db, snapshot);
  void cacheProductImages(snapshot.products);
  return {
    productCount: snapshot.products.length,
    customerCount: snapshot.customers.length,
    orderCount: snapshot.orders?.length ?? 0,
    skipped: false,
  };
}

export async function applySnapshot(
  db: NovendOfflineDb,
  snapshot: {
    products: MirroredProduct[];
    branchStock?: MirroredBranchStock[];
    categories: MirroredCategory[];
    customers: MirroredCustomer[];
    customerLedger?: MirroredCustomerLedgerEntry[];
    customerGroups?: MirroredCustomerGroup[];
    priceListRules?: MirroredPriceListRule[];
    wholesaleLots?: MirroredWholesaleLot[];
    orders: MirroredOrder[];
    orderItems?: MirroredOrderItem[];
    suppliers?: MirroredSupplier[];
    wholesaleStock?: MirroredWholesaleStock[];
    wholesalePurchases?: MirroredWholesalePurchase[];
    supplierPayments?: MirroredSupplierPayment[];
    wholesaleTransfers?: MirroredWholesaleTransfer[];
    branches?: MirroredBranch[];
    users?: MirroredUser[];
    expenses?: MirroredExpense[];
    staffCompensation?: MirroredStaffCompensation[];
    returns?: MirroredReturn[];
    lots?: MirroredLot[];
    diningTables?: MirroredDiningTable[];
    diningSessions?: MirroredDiningSession[];
    diningSessionItems?: MirroredDiningSessionItem[];
    kitchenTickets?: MirroredKitchenTicket[];
    hotelRooms?: MirroredHotelRoom[];
    hotelStays?: MirroredHotelStay[];
    hotelFolioCharges?: MirroredHotelFolioCharge[];
    hotelReservations?: MirroredHotelReservation[];
    print: PrintSnapshot;
    businessCapabilities?: OrganizationBusinessConfiguration;
    businessTerminology?: {
      industryProfile: string;
      overrides: BusinessTerminologyOverrides;
      terms: BusinessTermsMap;
    };
    productImagesPolicy?: ProductImagesPolicy;
    expiryPolicy?: ExpiryPolicy;
    profile: {
      userId: string;
      name: string;
      role?: AppRole;
      branchId?: string;
      branchName?: string | null;
    };
  },
) {
  const now = Date.now();
  const openOutbox = await db.outbox.toArray();
  const stockOutbox = await withReceiptQuantities(openOutbox, (localSaleId) =>
    db.localSaleItems.where("localSaleId").equals(localSaleId).toArray(),
  );
  const pendingLocalIds = pendingLocalIdsFromOutbox(openOutbox);
  const tables = [
    db.products,
    db.branchStock,
    db.categories,
    db.customers,
    db.customerLedger,
    db.customerGroups,
    db.priceListRules,
    db.wholesaleLots,
    db.orders,
    db.orderItems,
    db.suppliers,
    db.wholesaleStock,
    db.wholesalePurchases,
    db.supplierPayments,
    db.wholesaleTransfers,
    db.branches,
    db.users,
    db.staffCompensation,
    db.expenses,
    db.returns,
    db.lots,
    db.diningTables,
    db.diningSessions,
    db.diningSessionItems,
    db.kitchenTickets,
    db.hotelRooms,
    db.hotelStays,
    db.hotelFolioCharges,
    db.hotelReservations,
    db.meta,
  ];
  let pendingBranchLots: MirroredLot[] = snapshot.lots ?? [];
  await db.transaction("rw", tables, async () => {
    await replaceServerRows(
      db.products,
      snapshot.products.map((p) => ({ ...p, updatedAt: p.updatedAt || now })),
      pendingLocalIds,
    );
    await replaceServerRows(
      db.branchStock,
      overlayPendingBranchStock(snapshot.branchStock ?? [], stockOutbox),
      pendingLocalIds,
    );
    await replaceServerRows(db.categories, snapshot.categories, pendingLocalIds);
    await replaceServerRows(
      db.customers,
      overlayPendingCustomerBalances(
        snapshot.customers.map((c) => ({
          ...c,
          notes: c.notes ?? null,
          purchaseCount: c.purchaseCount ?? 0,
          lastPurchaseAt: c.lastPurchaseAt ?? null,
          lastPurchaseTotal: c.lastPurchaseTotal ?? null,
          lastInvoiceNumber: c.lastInvoiceNumber ?? null,
          creditLimit: c.creditLimit ?? null,
          customerGroupId: c.customerGroupId ?? null,
          balance: c.balance ?? 0,
          updatedAt: c.updatedAt || now,
        })),
        openOutbox,
      ),
      pendingLocalIds,
    );
    await replaceServerRows(db.customerLedger, snapshot.customerLedger ?? [], pendingLocalIds);
    await replaceServerRows(db.customerGroups, snapshot.customerGroups ?? [], pendingLocalIds);
    await replaceServerRows(db.priceListRules, snapshot.priceListRules ?? [], pendingLocalIds);
    {
      const datedProductIds = new Set(
        snapshot.products.filter((p) => p.tracksExpiry).map((p) => p.id),
      );
      const branchNames = new Map((snapshot.branches ?? []).map((b) => [b.id, b.name]));
      const replayed = replayPendingWarehouseLots({
        warehouseLots: snapshot.wholesaleLots ?? [],
        branchLots: snapshot.lots ?? [],
        outbox: openOutbox,
        datedProductIds,
        branchName: (branchId) => branchNames.get(branchId) ?? null,
      });
      await db.wholesaleLots.clear();
      if (replayed.warehouseLots.length > 0) await db.wholesaleLots.bulkPut(replayed.warehouseLots);
      pendingBranchLots = replayed.branchLots;
    }
    await replaceServerRows(db.orders, snapshot.orders ?? [], pendingLocalIds);
    await db.orderItems.clear();
    if (snapshot.orderItems && snapshot.orderItems.length > 0) {
      await db.orderItems.bulkPut(snapshot.orderItems);
    }
    await replaceServerRows(db.suppliers, snapshot.suppliers ?? [], pendingLocalIds);
    await replaceWholesaleStockRows(
      db.wholesaleStock,
      overlayPendingWholesaleStock(snapshot.wholesaleStock ?? [], openOutbox),
      pendingLocalIds,
    );
    await replaceServerRows(
      db.wholesalePurchases,
      overlayPendingSupplierPayments(snapshot.wholesalePurchases ?? [], openOutbox),
      pendingLocalIds,
      sameWholesalePurchase,
    );
    await replaceServerRows(
      db.supplierPayments,
      snapshot.supplierPayments ?? [],
      pendingLocalIds,
    );
    await replaceServerRows(
      db.wholesaleTransfers,
      snapshot.wholesaleTransfers ?? [],
      pendingLocalIds,
      sameWholesaleTransfer,
    );
    const branchRows =
      snapshot.branches && snapshot.branches.length > 0
        ? snapshot.branches
        : snapshot.profile.branchId
          ? [
              {
                id: snapshot.profile.branchId,
                name: snapshot.profile.branchName ?? "Main Branch",
                code: "MAIN",
                address: null,
                phone: null,
                status: "active" as const,
              },
            ]
          : [];
    await replaceServerRows(db.branches, branchRows, pendingLocalIds);
    await replaceServerRows(db.users, snapshot.users ?? [], pendingLocalIds);
    await replaceServerRows(
      db.staffCompensation,
      snapshot.staffCompensation ?? [],
      pendingLocalIds,
      (a, b) => a.id === b.id,
    );
    await replaceServerRows(db.expenses, snapshot.expenses ?? [], pendingLocalIds, sameExpense);
    await replaceServerRows(db.returns, snapshot.returns ?? [], pendingLocalIds, sameReturnNumber);
    await replaceServerRows(db.lots, pendingBranchLots, pendingLocalIds);
    await replaceServerRows(db.diningTables, snapshot.diningTables ?? [], pendingLocalIds);
    await replaceServerRows(db.diningSessions, snapshot.diningSessions ?? [], pendingLocalIds);
    await replaceServerRows(
      db.diningSessionItems,
      snapshot.diningSessionItems ?? [],
      pendingLocalIds,
    );
    await replaceServerRows(db.kitchenTickets, snapshot.kitchenTickets ?? [], pendingLocalIds);
    await replaceServerRows(db.hotelRooms, snapshot.hotelRooms ?? [], pendingLocalIds);
    await replaceServerRows(db.hotelStays, snapshot.hotelStays ?? [], pendingLocalIds);
    await replaceServerRows(
      db.hotelFolioCharges,
      snapshot.hotelFolioCharges ?? [],
      pendingLocalIds,
    );
    await replaceServerRows(
      db.hotelReservations,
      snapshot.hotelReservations ?? [],
      pendingLocalIds,
    );
    await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(snapshot.print));
    await setMeta(
      db,
      META_KEYS.businessCapabilities,
      JSON.stringify(snapshot.businessCapabilities ?? DEFAULT_BUSINESS_CONFIGURATION),
    );
    await setMeta(
      db,
      META_KEYS.businessTerminology,
      JSON.stringify(
        snapshot.businessTerminology ?? {
          industryProfile: snapshot.businessCapabilities?.industryProfile ?? "retail",
          overrides: {},
          terms: DEFAULT_BUSINESS_TERMS,
        },
      ),
    );
    await setMeta(
      db,
      META_KEYS.productImagesPolicy,
      JSON.stringify(snapshot.productImagesPolicy ?? DEFAULT_PRODUCT_IMAGES_POLICY),
    );
    await setMeta(
      db,
      META_KEYS.expiryPolicy,
      JSON.stringify(snapshot.expiryPolicy ?? DEFAULT_EXPIRY_POLICY),
    );
    await setMeta(db, META_KEYS.profileUserId, snapshot.profile.userId);
    await setMeta(db, META_KEYS.profileName, snapshot.profile.name);
    if (snapshot.profile.role) {
      await setMeta(db, META_KEYS.profileRole, snapshot.profile.role);
    }
    if (snapshot.profile.branchId) {
      await setMeta(db, META_KEYS.profileBranchId, snapshot.profile.branchId);
    }
    if (snapshot.profile.branchName) {
      await setMeta(db, META_KEYS.profileBranchName, snapshot.profile.branchName);
    }
    const incomingTours = parseTourProgress(
      "tourProgress" in snapshot.profile ? snapshot.profile.tourProgress : [],
    );
    if (incomingTours.length > 0) {
      const existingRaw = await getMeta(db, META_KEYS.tourProgress);
      let existing: StoredTourProgress[] = [];
      if (existingRaw) {
        try {
          existing = parseTourProgress(JSON.parse(existingRaw) as unknown);
        } catch {
          existing = [];
        }
      }
      await saveTourProgress(mergeTourProgress(existing, incomingTours));
    }
    await setMeta(db, META_KEYS.lastSnapshotAt, String(now));
    await setMeta(db, META_KEYS.replicaSchemaVersion, REPLICA_SCHEMA_VERSION);
  });

  if (snapshot.profile.role && snapshot.profile.branchId) {
    await saveShellProfile({
      userId: snapshot.profile.userId,
      name: snapshot.profile.name,
      role: snapshot.profile.role,
      branchId: snapshot.profile.branchId,
      branchName: snapshot.profile.branchName ?? "Branch",
      imageUrl: null,
      email: null,
      phone: null,
      organizationName:
        "organizationName" in snapshot.profile
          ? ((snapshot.profile as { organizationName?: string | null }).organizationName ?? null)
          : null,
      organizationId:
        "organizationId" in snapshot.profile
          ? ((snapshot.profile as { organizationId?: string | null }).organizationId ?? null)
          : null,
    });
  }
  notifyReplicaChanged({ silent: true });
}

export async function listLocalCatalogProducts(search?: string, branchId?: string | null) {
  const db = await getOfflineDb();
  if (!db) return null;
  const effectiveBranchId = await resolveCatalogBranchId(db, branchId);
  if (!effectiveBranchId) return [];

  const query = search?.trim() ?? "";
  // Always load the full active catalog, then filter — never search only the browse window.
  let products = await db.products
    .filter((p) => p.status === "active" && p.isVariantParent !== true)
    .toArray();
  if (query) {
    products = products.filter((p) => productMatchesQuery(p, query));
  }

  const stockByProduct = await branchStockMapForBranch(db, effectiveBranchId);
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  const businessConfig = await loadBusinessCapabilitiesCache();
  const resultLimit = salesCatalogResultLimit(query);

  const rows = products
    .map((product) => {
      const stock = stockByProduct.get(product.id);
      const stockQuantity = sellableQuantityForBranch({
        stock,
        product,
        branchId: effectiveBranchId,
        profileBranchId,
      });
      const isExpiring = stock?.isExpiring ?? product.isExpiring;

      const displayName = product.variantLabel
        ? `${product.name} · ${product.variantLabel}`
        : product.name;

      return {
        id: product.id,
        name: displayName,
        sku: product.sku,
        barcode: product.barcode ?? null,
        sellingPrice: product.sellingPrice,
        stockQuantity,
        unit: product.unit,
        sellUnits: product.sellUnits ?? null,
        pricingMode: product.pricingMode ?? null,
        imageUrl: product.imageUrl,
        isExpiring,
        tracksInventory: productTracksInventory(product, businessConfig),
        parentProductId: product.parentProductId ?? null,
        variantLabel: product.variantLabel ?? null,
        tracksSerials: product.tracksSerials === true,
        isVariantParent: false,
      };
    })
    // Browse: only sellable (cloud). Millie's local till shows all active products
    // so a just-created item appears on Sales without requiring stock > 0 first.
    .filter((p) => {
      if (p.tracksInventory === false) return true;
      if (query) return true;
      if (FULLY_OFFLINE) return true;
      return p.stockQuantity > 0;
    });

  if (query) {
    const q = query.toLowerCase();
    rows.sort((a, b) => {
      const rankDiff = catalogSearchRank(a, q) - catalogSearchRank(b, q);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
  } else {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  return resultLimit == null ? rows : rows.slice(0, resultLimit);
}

/** Exact SKU or dedicated barcode match for scanners. */
export async function findLocalProductBySku(sku: string) {
  const matches = await findLocalProductsByBarcode(sku);
  return matches[0] ?? null;
}

/**
 * Offline barcode lookup — Dexie only.
 * Matches sell-unit barcode, product barcode, then SKU.
 * Multiple rows support rare catalog duplicates; the sales UI shows a picker.
 */
export async function findLocalProductsByBarcode(code: string, branchId?: string | null) {
  const db = await getOfflineDb();
  if (!db) return [];
  const normalized = code.trim();
  if (!normalized) return [];

  const products = await db.products
    .filter((p) => p.status === "active" && productMatchesBarcode(p, normalized))
    .toArray();

  const effectiveBranchId = await resolveCatalogBranchId(db, branchId);
  if (!effectiveBranchId) return [];

  const stockByProduct = await branchStockMapForBranch(db, effectiveBranchId);
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  const businessConfig = await loadBusinessCapabilitiesCache();

  return products
    .map((product) => {
      const stock = stockByProduct.get(product.id);
      const stockQuantity = sellableQuantityForBranch({
        stock,
        product,
        branchId: effectiveBranchId,
        profileBranchId,
      });
      const match = resolveBarcodeMatch(product, normalized);
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode ?? null,
        sellingPrice: product.sellingPrice,
        stockQuantity,
        unit: product.unit,
        sellUnits: product.sellUnits ?? null,
        pricingMode: product.pricingMode ?? null,
        costPrice: product.costPrice,
        imageUrl: product.imageUrl,
        isExpiring: stock?.isExpiring ?? product.isExpiring,
        tracksInventory: productTracksInventory(product, businessConfig),
        matchedSellUnitKey: match?.sellUnitKey,
      };
    })
    .filter((product) => product.tracksInventory === false || product.stockQuantity > 0);
}

/**
 * Branch sellable qty for one product — not search-scoped.
 * Sales cart checks must use this (or a session cache) because the POS catalog
 * browse/search windows are capped; cart lines fall out of that window and looked
 * like Available: 0 after a few different products.
 */
export async function getLocalProductAvailability(
  productId: string,
  branchId?: string | null,
): Promise<{ stockQuantity: number; tracksInventory: boolean } | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const product = await db.products.get(productId);
  if (!product || product.status !== "active") return null;

  const effectiveBranchId = await resolveCatalogBranchId(db, branchId);
  if (!effectiveBranchId) return null;

  const stockByProduct = await branchStockMapForBranch(db, effectiveBranchId);
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  const businessConfig = await loadBusinessCapabilitiesCache();
  const stock = stockByProduct.get(product.id);
  return {
    stockQuantity: sellableQuantityForBranch({
      stock,
      product,
      branchId: effectiveBranchId,
      profileBranchId,
    }),
    tracksInventory: productTracksInventory(product, businessConfig),
  };
}

export async function searchLocalCustomers(q: string, limit = 6) {
  const db = await getOfflineDb();
  if (!db) return null;
  const queryText = q.trim().toLowerCase();
  if (!queryText) return [];
  const customers = await db.customers
    .filter(
      (c) =>
        c.status === "active" &&
        (c.name.toLowerCase().includes(queryText) ||
          (c.phone?.toLowerCase().includes(queryText) ?? false) ||
          (c.email?.toLowerCase().includes(queryText) ?? false)),
    )
    .toArray();
  return customers
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
    }));
}

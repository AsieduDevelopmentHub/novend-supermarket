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
  type PrincellenOfflineDb,
} from "./db";
import { getLastSnapshotAt, SNAPSHOT_PULL_TTL_MS } from "./freshness";
import { cacheProductImages } from "./image-cache";
import { saveShellProfile } from "./shell-profile";
import type {
  MirroredBranch,
  MirroredCategory,
  MirroredCustomer,
  MirroredExpense,
  MirroredOrder,
  MirroredOrderItem,
  MirroredProduct,
  MirroredReturn,
  MirroredSupplier,
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
  table: { filter: (fn: (row: T) => boolean) => { toArray: () => Promise<T[]> }; clear: () => Promise<void>; bulkPut: (rows: T[]) => Promise<unknown> },
  rows: T[],
) {
  const localOnly = await table.filter((row) => row.id.startsWith("local_")).toArray();
  await table.clear();
  if (rows.length + localOnly.length > 0) {
    await table.bulkPut([...rows, ...localOnly]);
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
    const lastAt = await getLastSnapshotAt();
    const replicaVersion = await getMeta(db, META_KEYS.replicaSchemaVersion);
    const branchCount = await db.branches.count();
    const replicaComplete = replicaVersion === REPLICA_SCHEMA_VERSION && branchCount > 0;
    if (lastAt && Date.now() - lastAt < SNAPSHOT_PULL_TTL_MS && replicaComplete) {
      const [productCount, customerCount, orderCount] = await Promise.all([
        db.products.count(),
        db.customers.count(),
        db.orders.count(),
      ]);
      if (productCount > 0) {
        return { productCount, customerCount, orderCount, skipped: true };
      }
    }
  }

  const snapshot = await convex.query(api.offline.getSnapshot, {});
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
  db: PrincellenOfflineDb,
  snapshot: {
    products: MirroredProduct[];
    categories: MirroredCategory[];
    customers: MirroredCustomer[];
    orders: MirroredOrder[];
    orderItems?: MirroredOrderItem[];
    suppliers?: MirroredSupplier[];
    wholesaleStock?: MirroredWholesaleStock[];
    wholesalePurchases?: MirroredWholesalePurchase[];
    wholesaleTransfers?: MirroredWholesaleTransfer[];
    branches?: MirroredBranch[];
    users?: MirroredUser[];
    expenses?: MirroredExpense[];
    returns?: MirroredReturn[];
    print: PrintSnapshot;
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
  const tables = [
    db.products,
    db.categories,
    db.customers,
    db.orders,
    db.orderItems,
    db.suppliers,
    db.wholesaleStock,
    db.wholesalePurchases,
    db.wholesaleTransfers,
    db.branches,
    db.users,
    db.expenses,
    db.returns,
    db.meta,
  ];
  await db.transaction("rw", tables, async () => {
    await replaceServerRows(db.products, snapshot.products.map((p) => ({ ...p, updatedAt: p.updatedAt || now })));
    await replaceServerRows(db.categories, snapshot.categories);
    await replaceServerRows(
      db.customers,
      snapshot.customers.map((c) => ({
        ...c,
        notes: c.notes ?? null,
        purchaseCount: c.purchaseCount ?? 0,
        lastPurchaseAt: c.lastPurchaseAt ?? null,
        lastPurchaseTotal: c.lastPurchaseTotal ?? null,
        lastInvoiceNumber: c.lastInvoiceNumber ?? null,
        updatedAt: c.updatedAt || now,
      })),
    );
    await replaceServerRows(db.orders, snapshot.orders ?? []);
    await db.orderItems.clear();
    if (snapshot.orderItems && snapshot.orderItems.length > 0) {
      await db.orderItems.bulkPut(snapshot.orderItems);
    }
    await replaceServerRows(db.suppliers, snapshot.suppliers ?? []);
    await replaceServerRows(db.wholesaleStock, snapshot.wholesaleStock ?? []);
    await replaceServerRows(db.wholesalePurchases, snapshot.wholesalePurchases ?? []);
    await replaceServerRows(db.wholesaleTransfers, snapshot.wholesaleTransfers ?? []);
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
    await replaceServerRows(db.branches, branchRows);
    await replaceServerRows(db.users, snapshot.users ?? []);
    await replaceServerRows(db.expenses, snapshot.expenses ?? []);
    await replaceServerRows(db.returns, snapshot.returns ?? []);
    await setMeta(db, META_KEYS.printSnapshot, JSON.stringify(snapshot.print));
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
    });
  }
}

export async function listLocalCatalogProducts(search?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  let products = await db.products.filter((p) => p.status === "active").toArray();
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }
  return products
    .filter((p) => (p.sellableQuantity ?? p.stockQuantity) > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 48)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.sellableQuantity ?? p.stockQuantity,
      unit: p.unit,
      imageUrl: p.imageUrl,
      isExpiring: p.isExpiring,
    }));
}

/** Exact SKU match for barcode / keyboard-wedge scanners. */
export async function findLocalProductBySku(sku: string) {
  const matches = await findLocalProductsByBarcode(sku);
  return matches[0] ?? null;
}

/**
 * Offline barcode lookup — returns every active product whose SKU matches the
 * scanned code (exact, case-insensitive). Multiple rows support future barcode
 * aliases and rare catalog duplicates; the sales UI shows a picker when needed.
 */
export async function findLocalProductsByBarcode(code: string) {
  const db = await getOfflineDb();
  if (!db) return [];
  const normalized = code.trim().toLowerCase();
  if (!normalized) return [];

  const products = await db.products
    .filter((p) => p.status === "active" && p.sku.toLowerCase() === normalized)
    .toArray();

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    sellingPrice: product.sellingPrice,
    stockQuantity: product.sellableQuantity ?? product.stockQuantity,
    unit: product.unit,
    imageUrl: product.imageUrl,
    isExpiring: product.isExpiring,
  }));
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

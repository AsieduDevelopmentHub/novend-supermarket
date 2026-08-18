import type { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import { ensureDeviceId, getOfflineDb, META_KEYS, setMeta, type PrincellenOfflineDb } from "./db";
import { getLastSnapshotAt, SNAPSHOT_PULL_TTL_MS } from "./freshness";
import { saveShellProfile } from "./shell-profile";
import type {
  MirroredCategory,
  MirroredCustomer,
  MirroredOrder,
  MirroredOrderItem,
  MirroredProduct,
  PrintSnapshot,
} from "./types";

export type SnapshotSource = {
  query: ConvexReactClient["query"];
};

export type PullOfflineSnapshotOptions = {
  /** Bypass TTL and always fetch from Convex. */
  force?: boolean;
};

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
    if (lastAt && Date.now() - lastAt < SNAPSHOT_PULL_TTL_MS) {
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
  await db.transaction(
    "rw",
    [db.products, db.categories, db.customers, db.orders, db.orderItems, db.meta],
    async () => {
      await db.products.clear();
      await db.categories.clear();
      await db.customers.clear();
      await db.orders.clear();
      await db.orderItems.clear();
      await db.products.bulkPut(
        snapshot.products.map((p) => ({ ...p, updatedAt: p.updatedAt || now })),
      );
      await db.categories.bulkPut(snapshot.categories);
      await db.customers.bulkPut(
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
      await db.orders.bulkPut(snapshot.orders ?? []);
      if (snapshot.orderItems && snapshot.orderItems.length > 0) {
        await db.orderItems.bulkPut(snapshot.orderItems);
      }
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
    },
  );

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
  const db = await getOfflineDb();
  if (!db) return null;
  const code = sku.trim().toLowerCase();
  if (!code) return null;
  const product = await db.products.filter((p) => p.sku.toLowerCase() === code).first();
  if (!product || product.status !== "active") return null;
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    sellingPrice: product.sellingPrice,
    stockQuantity: product.sellableQuantity ?? product.stockQuantity,
    unit: product.unit,
    imageUrl: product.imageUrl,
    isExpiring: product.isExpiring,
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

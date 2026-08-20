import { getOfflineDb } from "./db";
import type { MirroredCategory, MirroredCustomer, MirroredProduct } from "./types";

export type MirroredProductRow = MirroredProduct & {
  isLowStock: boolean;
};

function availableQty(p: MirroredProduct) {
  return p.tracksExpiry ? (p.sellableQuantity ?? 0) : (p.sellableQuantity ?? p.stockQuantity);
}

/** Active (or all non-archived) products from the Dexie mirror. */
export async function listMirroredProducts(options?: {
  search?: string;
  includeInactive?: boolean;
  categoryId?: string;
}): Promise<MirroredProductRow[] | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  let products = await db.products.toArray();
  if (options?.includeInactive) {
    products = products.filter((p) => p.status !== "archived");
  } else {
    products = products.filter((p) => p.status === "active");
  }

  if (options?.categoryId) {
    products = products.filter((p) => p.categoryId === options.categoryId);
  }

  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }

  return products
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({
      ...p,
      isLowStock: availableQty(p) <= p.lowStockThreshold,
      isExpired: p.isExpired ?? false,
      isExpiring: p.isExpiring ?? false,
    }));
}

export async function getMirroredProduct(id: string): Promise<MirroredProductRow | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const product = await db.products.get(id);
  if (!product) return null;
  return {
    ...product,
    isLowStock: availableQty(product) <= product.lowStockThreshold,
    isExpired: product.isExpired ?? false,
    isExpiring: product.isExpiring ?? false,
  };
}

export async function listMirroredCategories(): Promise<MirroredCategory[] | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  return (await db.categories.toArray())
    .filter((c) => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMirroredCustomers(options?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<MirroredCustomer[] | null> {
  const db = await getOfflineDb();
  if (!db) return null;

  let customers = await db.customers.toArray();
  if (!options?.includeInactive) {
    customers = customers.filter((c) => c.status === "active");
  }

  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }

  // Older mirrors may lack purchase fields — derive from local + mirrored orders.
  const [localSales, mirroredOrders] = await Promise.all([
    db.localSales.toArray(),
    db.orders.toArray(),
  ]);

  return customers
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => {
      if (typeof c.purchaseCount === "number") {
        return {
          ...c,
          purchaseCount: c.purchaseCount,
          lastPurchaseAt: c.lastPurchaseAt ?? null,
          lastPurchaseTotal: c.lastPurchaseTotal ?? null,
          lastInvoiceNumber: c.lastInvoiceNumber ?? null,
        };
      }
      const related = [
        ...mirroredOrders.filter((o) => o.customerId === c.id),
        ...localSales.filter((s) => s.customerId === c.id),
      ].sort((a, b) => b.completedAt - a.completedAt);
      const last = related[0];
      return {
        ...c,
        purchaseCount: related.length,
        lastPurchaseAt: last?.completedAt ?? null,
        lastPurchaseTotal: last?.total ?? null,
        lastInvoiceNumber: last?.invoiceNumber ?? null,
      };
    });
}

export async function getMirroredCustomer(id: string): Promise<MirroredCustomer | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  return (await db.customers.get(id)) ?? null;
}

export type LocalOrderFilters = {
  search?: string;
  branchId?: string;
  cashierId?: string;
  startDate?: number;
  endDate?: number;
  minTotal?: number;
  maxTotal?: number;
  paymentMethod?: "cash" | "card" | "mobile_money";
  returnStatus?: "none" | "returned";
};

/**
 * Orders for offline / cold-start: mirrored Convex sales + unsynced local sales.
 */
export async function listLocalOrders(filters: LocalOrderFilters = {}) {
  const db = await getOfflineDb();
  if (!db) return null;

  const [mirrored, localSales] = await Promise.all([
    db.orders.orderBy("completedAt").reverse().toArray(),
    db.localSales.orderBy("completedAt").reverse().toArray(),
  ]);

  const mirroredIds = new Set(mirrored.map((o) => o.id));
  const unsyncedLocal = localSales.filter(
    (s) =>
      (s.syncStatus === "pending" || s.syncStatus === "failed") &&
      !(s.serverSaleId && mirroredIds.has(s.serverSaleId)),
  );

  type OrderRow = {
    id: string;
    invoiceNumber: string;
    completedAt: number;
    branchId: string | null;
    branchName: string | null;
    customerId: string | null;
    customerName: string;
    cashierId: string | null;
    cashierName: string;
    itemCount: number;
    paymentMethod: "cash" | "card" | "mobile_money";
    total: number;
    status: string;
    isLocal: boolean;
    refundedAmount: number;
  };

  const localReturns = await db.localReturns.toArray();
  const pendingRefundBySale = new Map<string, number>();
  for (const row of localReturns) {
    if (row.syncStatus !== "pending" && row.syncStatus !== "failed") continue;
    pendingRefundBySale.set(row.saleId, (pendingRefundBySale.get(row.saleId) ?? 0) + row.refundAmount);
  }

  let rows: OrderRow[] = [
    ...mirrored.map((o) => ({
      id: o.id,
      invoiceNumber: o.invoiceNumber,
      completedAt: o.completedAt,
      branchId: o.branchId,
      branchName: o.branchName,
      customerId: o.customerId,
      customerName: o.customerName,
      cashierId: o.cashierId ?? null,
      cashierName: o.cashierName,
      itemCount: o.itemCount,
      paymentMethod: o.paymentMethod,
      total: o.total,
      status: o.status,
      isLocal: false,
      refundedAmount: (o.refundedAmount ?? 0) + (pendingRefundBySale.get(o.id) ?? 0),
    })),
    ...unsyncedLocal.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      completedAt: s.completedAt,
      branchId: s.branchId ?? null,
      branchName: s.branchName ?? null,
      customerId: s.customerId ?? null,
      customerName: s.customerName,
      cashierId: s.cashierId,
      cashierName: s.cashierName,
      itemCount: s.itemCount,
      paymentMethod: s.paymentMethod,
      total: s.total,
      status: s.syncStatus,
      isLocal: true,
      refundedAmount: pendingRefundBySale.get(s.id) ?? 0,
    })),
  ];

  if (filters.branchId) {
    rows = rows.filter((r) => !r.branchId || r.branchId === filters.branchId);
  }
  if (filters.cashierId) {
    rows = rows.filter((r) => !r.cashierId || r.cashierId === filters.cashierId);
  }
  if (filters.startDate !== undefined) {
    rows = rows.filter((r) => r.completedAt >= filters.startDate!);
  }
  if (filters.endDate !== undefined) {
    rows = rows.filter((r) => r.completedAt <= filters.endDate!);
  }
  if (filters.minTotal !== undefined) {
    rows = rows.filter((r) => r.total >= filters.minTotal!);
  }
  if (filters.maxTotal !== undefined) {
    rows = rows.filter((r) => r.total <= filters.maxTotal!);
  }
  if (filters.paymentMethod) {
    rows = rows.filter((r) => r.paymentMethod === filters.paymentMethod);
  }
  if (filters.returnStatus === "none") {
    rows = rows.filter((r) => r.refundedAmount === 0);
  } else if (filters.returnStatus === "returned") {
    rows = rows.filter((r) => r.refundedAmount > 0);
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.cashierName.toLowerCase().includes(q),
    );
  }

  return rows.sort((a, b) => b.completedAt - a.completedAt);
}

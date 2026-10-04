import { getMeta, getOfflineDb, META_KEYS } from "./db";
import { productMatchesQuery } from "./barcode-lookup";
import {
  dedupeByProductId,
  dropLocalDuplicates,
  sameExpense,
  sameWholesalePurchase,
  sameWholesaleTransfer,
} from "./replica-dedupe";
import {
  branchStockMapForBranch,
  branchStockMapOrgWide,
  resolveMirrorBranchFilter,
  resolveMirroredProductStock,
} from "./branch-stock";
import {
  applyPendingTransferDisplay,
  pendingTransferDisplayAdjustments,
  transferStockKey,
} from "./pending-transfers";
import type { MirroredCategory, MirroredCustomer, MirroredProduct } from "./types";
import { presenceFromLastSeenAt, sortUsersByPresence } from "@/lib/presence";
import { ownedSaleIdsForCashier } from "@/lib/dashboard/cashier-scope";
import { summarizeLots } from "@/convex/shared/lots";
import { resolveExpiryAlertDays } from "@/convex/shared/expiryPolicy";
import { loadExpiryPolicyCache } from "./expiry-policy";

export type MirroredInventoryAlertBranch = {
  branchId: string;
  branchName: string;
  stockQuantity: number;
  sellableQuantity: number;
  expiredQuantity: number;
  expiringQuantity: number;
  nearestExpiry: string | null;
  isLowStock: boolean;
  isExpired: boolean;
  isExpiring: boolean;
};

export type MirroredProductRow = MirroredProduct & {
  isLowStock: boolean;
  alertBranches?: MirroredInventoryAlertBranch[];
};

async function mapMirroredProductRows(
  products: MirroredProduct[],
  branchId?: string | null,
): Promise<MirroredProductRow[]> {
  const db = await getOfflineDb();
  if (!db) {
    return products.map((p) => ({
      ...p,
      isLowStock: (p.sellableQuantity ?? p.stockQuantity) <= p.lowStockThreshold,
      isExpired: p.isExpired ?? false,
      isExpiring: p.isExpiring ?? false,
    }));
  }

  const branchFilter = await resolveMirrorBranchFilter(db, branchId);
  const stockByProduct = branchFilter
    ? await branchStockMapForBranch(db, branchFilter)
    : await branchStockMapOrgWide(db);
  const pendingTransfers = await pendingTransferDisplayAdjustments(db);
  const lots = await db.lots.toArray();
  const allBranchStock = branchFilter == null ? await db.branchStock.toArray() : [];
  const branches = branchFilter == null ? await db.branches.toArray() : [];
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const expiryPolicy = await loadExpiryPolicyCache();
  const orgAlertDays = expiryPolicy.defaultAlertDays;

  return Promise.all(
    products.map(async (product) => {
      const resolved = await resolveMirroredProductStock(db, product, branchFilter, stockByProduct);
      const pending =
        branchFilter != null
          ? pendingTransfers.get(transferStockKey(branchFilter, product.id))
          : undefined;
      const displayed = applyPendingTransferDisplay(
        resolved.stockQuantity,
        resolved.sellableQuantity,
        pending,
      );
      const alertDays = resolveExpiryAlertDays(product, orgAlertDays);
      const productLots = lots.filter(
        (lot) =>
          lot.productId === product.id &&
          lot.quantity > 0 &&
          (branchFilter == null || lot.branchId === branchFilter),
      );
      const lotSummary =
        product.tracksExpiry && productLots.length > 0
          ? summarizeLots(productLots, alertDays)
          : null;

      const alertBranches =
        branchFilter == null
          ? allBranchStock
              .filter((row) => row.productId === product.id)
              .map((row) => {
                const branchLots = lots.filter(
                  (lot) =>
                    lot.productId === product.id &&
                    lot.branchId === row.branchId &&
                    lot.quantity > 0,
                );
                const summary =
                  product.tracksExpiry && branchLots.length > 0
                    ? summarizeLots(branchLots, alertDays)
                    : null;
                const sellable = product.tracksExpiry
                  ? (summary?.sellableQuantity ?? row.sellableQuantity ?? 0)
                  : (row.sellableQuantity ?? row.quantity);
                const expiredQuantity = summary?.expiredQuantity ?? 0;
                const expiringQuantity = summary?.expiringQuantity ?? 0;
                const isLowStock = sellable <= product.lowStockThreshold;
                const isExpired = expiredQuantity > 0;
                const isExpiring = expiringQuantity > 0;
                if (!isLowStock && !isExpired && !isExpiring) return null;
                return {
                  branchId: row.branchId,
                  branchName: branchNameById.get(row.branchId) ?? "Branch",
                  stockQuantity: row.quantity,
                  sellableQuantity: sellable,
                  expiredQuantity,
                  expiringQuantity,
                  nearestExpiry: summary?.nearestExpiry ?? null,
                  isLowStock,
                  isExpired,
                  isExpiring,
                };
              })
              .filter((row): row is NonNullable<typeof row> => row !== null)
          : undefined;

      const isLowStock =
        branchFilter == null
          ? (alertBranches?.some((row) => row.isLowStock) ??
            displayed.sellableQuantity <= product.lowStockThreshold)
          : displayed.sellableQuantity <= product.lowStockThreshold;

      return {
        ...product,
        stockQuantity: displayed.stockQuantity,
        sellableQuantity: displayed.sellableQuantity,
        expiredQuantity: lotSummary?.expiredQuantity ?? product.expiredQuantity ?? 0,
        expiringQuantity: lotSummary?.expiringQuantity ?? product.expiringQuantity ?? 0,
        isExpiring:
          lotSummary != null
            ? lotSummary.expiringQuantity > 0
            : branchFilter == null
              ? (alertBranches?.some((row) => row.isExpiring) ?? false)
              : (resolved.isExpiring ?? false),
        isExpired:
          lotSummary != null
            ? lotSummary.expiredQuantity > 0
            : branchFilter == null
              ? (alertBranches?.some((row) => row.isExpired) ?? false)
              : (resolved.isExpired ?? false),
        isLowStock,
        alertBranches,
      };
    }),
  );
}

type ListMirroredProductsOptions = {
  search?: string;
  includeInactive?: boolean;
  categoryId?: string;
  branchId?: string | null;
  page?: number;
  pageSize?: number;
};

export type PagedMirroredProducts = {
  items: MirroredProductRow[];
  total: number;
  page: number;
  pageSize: number;
};

/** Active (or all non-archived) products from the Dexie mirror. */
export async function listMirroredProducts(
  options?: ListMirroredProductsOptions,
): Promise<MirroredProductRow[] | PagedMirroredProducts | null> {
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
    products = products.filter((p) => productMatchesQuery(p, options.search!));
  }

  products.sort((a, b) => a.name.localeCompare(b.name));
  const pageSize = options?.pageSize;
  const page = options?.page ?? 1;
  const total = products.length;
  const sliced =
    pageSize && pageSize > 0
      ? products.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
      : products;
  const rows = await mapMirroredProductRows(sliced, options?.branchId);
  if (pageSize && pageSize > 0) {
    return { items: rows, total, page, pageSize };
  }
  return rows;
}

export async function getMirroredProduct(
  id: string,
  branchId?: string | null,
): Promise<MirroredProductRow | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const product = await db.products.get(id);
  if (!product) return null;
  const [row] = await mapMirroredProductRows([product], branchId);
  return row ?? null;
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

  const mirroredIds = new Set(mirroredOrders.map((o) => o.id));
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
        ...localSales.filter(
          (s) =>
            s.customerId === c.id &&
            s.syncStatus !== "synced" &&
            !(s.serverSaleId && mirroredIds.has(s.serverSaleId)),
        ),
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
  const mirroredInvoices = new Set(mirrored.map((o) => o.invoiceNumber));
  const unsyncedLocal = localSales.filter(
    (s) =>
      (s.syncStatus === "pending" || s.syncStatus === "failed") &&
      !(s.serverSaleId && mirroredIds.has(s.serverSaleId)) &&
      !mirroredInvoices.has(s.invoiceNumber),
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
    pendingRefundBySale.set(
      row.saleId,
      (pendingRefundBySale.get(row.saleId) ?? 0) + row.refundAmount,
    );
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

  const role = await getMeta(db, META_KEYS.profileRole);
  const sessionUserId = await getMeta(db, META_KEYS.profileUserId);
  const sessionBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (role === "cashier") {
    rows = rows.filter((r) => !sessionUserId || r.cashierId === sessionUserId);
  } else if (role === "manager" && sessionBranchId) {
    rows = rows.filter((r) => !r.branchId || r.branchId === sessionBranchId);
  }

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

export async function listMirroredSuppliers(options?: {
  search?: string;
  includeInactive?: boolean;
}) {
  const db = await getOfflineDb();
  if (!db) return [];
  let rows = await db.suppliers.toArray();
  if (!options?.includeInactive) {
    rows = rows.filter((row) => row.status === "active");
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.contactName?.toLowerCase().includes(q) ?? false) ||
        (row.phone?.includes(q) ?? false),
    );
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMirroredSupplier(id: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  const supplier = await db.suppliers.get(id);
  if (!supplier) return null;
  const purchases = (await db.wholesalePurchases.where("supplierId").equals(id).toArray()).sort(
    (a, b) => b.purchasedAt - a.purchasedAt,
  );
  return {
    ...supplier,
    purchaseCount: purchases.length,
    purchaseTotal: purchases.reduce((sum, row) => sum + row.totalCost, 0),
    purchases: purchases.slice(0, 50).map((p) => ({
      id: p.id,
      reference: p.reference,
      invoiceNumber: p.invoiceNumber,
      purchasedAt: p.purchasedAt,
      itemCount: p.itemCount,
      totalCost: p.totalCost,
    })),
  };
}

export async function listMirroredWholesaleStock(search?: string) {
  const db = await getOfflineDb();
  if (!db) return [];
  let rows = await db.wholesaleStock.toArray();
  const products = await db.products.toArray();
  const productById = new Map(products.map((p) => [p.id, p]));
  const withBarcode = rows.map((row) => {
    const product = productById.get(row.productId);
    return {
      ...row,
      barcode: row.barcode ?? product?.barcode ?? null,
      sellingPrice: row.sellingPrice ?? product?.sellingPrice ?? 0,
      costPrice: row.costPrice || product?.costPrice || 0,
    };
  });
  if (search?.trim()) {
    rows = withBarcode.filter((row) => productMatchesQuery(row, search));
  } else {
    rows = withBarcode;
  }
  return dedupeByProductId(rows)
    .map((row) => ({ ...row, value: row.quantity * row.costPrice }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function wholesaleSummaryFromMirror() {
  const rows = await listMirroredWholesaleStock();
  return {
    units: rows.reduce((sum, row) => sum + row.quantity, 0),
    value: rows.reduce((sum, row) => sum + row.value, 0),
    skuCount: rows.filter((row) => row.quantity > 0).length,
  };
}

export async function listMirroredWholesalePurchases() {
  const db = await getOfflineDb();
  if (!db) return [];
  return dropLocalDuplicates(await db.wholesalePurchases.toArray(), sameWholesalePurchase).sort(
    (a, b) => b.purchasedAt - a.purchasedAt,
  );
}

export async function listMirroredWholesaleTransfers() {
  const db = await getOfflineDb();
  if (!db) return [];
  return dropLocalDuplicates(await db.wholesaleTransfers.toArray(), sameWholesaleTransfer).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export async function listMirroredBranches(includeInactive = false) {
  const db = await getOfflineDb();
  if (!db) return [];
  try {
    let rows = await db.branches.toArray();
    if (!includeInactive) rows = rows.filter((row) => row.status === "active");
    const role = await getMeta(db, META_KEYS.profileRole);
    const sessionBranchId = await getMeta(db, META_KEYS.profileBranchId);
    if (role && role !== "administrator" && sessionBranchId) {
      rows = rows.filter((row) => row.id === sessionBranchId);
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getMirroredBranch(id: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  return (await db.branches.get(id)) ?? null;
}

export async function listMirroredLots(productId: string, branchId?: string | null) {
  const db = await getOfflineDb();
  if (!db) return [];
  try {
    let rows = await db.lots.where("productId").equals(productId).toArray();
    if (branchId) rows = rows.filter((row) => row.branchId === branchId);
    return rows
      .filter((row) => row.quantity > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.receivedAt - b.receivedAt);
  } catch {
    return [];
  }
}

export async function listMirroredUsers(search?: string) {
  const db = await getOfflineDb();
  if (!db) return [];
  try {
    let rows = await db.users.toArray();
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(q) ||
          (row.email?.toLowerCase().includes(q) ?? false) ||
          (row.phone?.includes(q) ?? false),
      );
    }
    const now = Date.now();
    const enriched = rows.map((row) => {
      const { lastSeenAt, presence } = presenceFromLastSeenAt(row.lastSeenAt, now);
      return { ...row, lastSeenAt, presence };
    });
    return sortUsersByPresence(enriched, now);
  } catch {
    return [];
  }
}

export async function listMirroredExpenses(range?: { startDate: number; endDate: number }) {
  const db = await getOfflineDb();
  if (!db) return [];
  let rows = await db.expenses.toArray();
  if (range) {
    rows = rows.filter(
      (row) => row.occurredAt >= range.startDate && row.occurredAt <= range.endDate,
    );
  }
  return dropLocalDuplicates(rows, sameExpense).sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function listMirroredReturns(options?: {
  search?: string;
  kind?: string;
  branchId?: string;
}) {
  const db = await getOfflineDb();
  if (!db) return [];
  const mirrored = await db.returns.toArray();
  const local = await db.localReturns.toArray();
  const mirroredIds = new Set(mirrored.map((row) => row.id));
  const mirroredNumbers = new Set(mirrored.map((row) => row.returnNumber));
  let rows = [
    ...mirrored.map((row) => ({
      id: row.id,
      returnNumber: row.returnNumber,
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber,
      refundAmount: row.refundAmount,
      itemCount: row.itemCount,
      kind: row.kind,
      completedAt: row.completedAt,
      branchId: row.branchId,
      branchName: row.branchName,
      customerName: row.customerName ?? "—",
      cashierName: row.cashierName ?? "—",
      reason: row.reason ?? "",
      status: row.status ?? "completed",
    })),
    ...local
      .filter(
        (row) =>
          row.syncStatus !== "synced" &&
          !mirroredNumbers.has(row.returnNumber) &&
          !(row.serverReturnId && mirroredIds.has(row.serverReturnId)),
      )
      .map((row) => ({
        id: row.id,
        returnNumber: row.returnNumber,
        saleId: row.saleId,
        invoiceNumber: null as string | null,
        refundAmount: row.refundAmount,
        itemCount: row.itemCount,
        kind: "partial",
        completedAt: row.completedAt,
        branchId: null as string | null,
        branchName: null as string | null,
        customerName: "—",
        cashierName: "—",
        reason: row.reason,
        status: row.syncStatus,
      })),
  ];
  if (options?.kind && options.kind !== "all") {
    rows = rows.filter((row) => row.kind === options.kind);
  }
  if (options?.branchId) {
    rows = rows.filter((row) => row.branchId === options.branchId);
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.returnNumber.toLowerCase().includes(q) ||
        (row.invoiceNumber?.toLowerCase().includes(q) ?? false),
    );
  }

  const role = await getMeta(db, META_KEYS.profileRole);
  const sessionUserId = await getMeta(db, META_KEYS.profileUserId);
  const sessionBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (role === "manager" && sessionBranchId && !options?.branchId) {
    rows = rows.filter((row) => !row.branchId || row.branchId === sessionBranchId);
  }
  const ownedSaleIds = ownedSaleIdsForCashier(
    role,
    sessionUserId,
    await db.orders.toArray(),
    await db.localSales.toArray(),
  );
  if (ownedSaleIds) {
    rows = rows.filter((row) => ownedSaleIds.has(row.saleId));
  }

  return rows.sort((a, b) => b.completedAt - a.completedAt);
}

export async function getMirroredCustomerDetail(id: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  const customer = await db.customers.get(id);
  if (!customer) return null;
  const orders = (await db.orders.where("customerId").equals(id).toArray()).sort(
    (a, b) => b.completedAt - a.completedAt,
  );
  return { customer, orders };
}

export async function getMirroredReturn(id: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  const mirrored = await db.returns.get(id);
  let row = mirrored ?? null;
  if (!row) {
    const local = await db.localReturns.get(id);
    if (!local) return null;
    row = {
      id: local.id,
      returnNumber: local.returnNumber,
      saleId: local.saleId,
      invoiceNumber: null,
      refundAmount: local.refundAmount,
      itemCount: local.itemCount,
      kind: "partial",
      completedAt: local.completedAt,
      branchId: null,
      branchName: null,
    };
  }

  const role = await getMeta(db, META_KEYS.profileRole);
  const sessionUserId = await getMeta(db, META_KEYS.profileUserId);
  const sessionBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (role === "manager" && sessionBranchId && row.branchId && row.branchId !== sessionBranchId) {
    return null;
  }
  const ownedSaleIds = ownedSaleIdsForCashier(
    role,
    sessionUserId,
    await db.orders.toArray(),
    await db.localSales.toArray(),
  );
  if (ownedSaleIds && !ownedSaleIds.has(row.saleId)) return null;
  return row;
}

/** Open hospitality operations from Dexie mirrors (Orders offline tab). */
export async function listLocalOpenOperations(options?: {
  branchId?: string;
  industryProfile?: string | null;
}): Promise<
  Array<{
    id: string;
    kind: "dining_session" | "hotel_stay" | "hotel_reservation";
    source: "restaurant_table" | "bar_tab" | "room_folio" | "reservation";
    originLabel: string;
    status: string;
    paymentStatus: "unpaid";
    fulfilmentStatus: string | null;
    branchId: string;
    branchName: string | null;
    openedAt: number;
    total: number;
    itemCount: number;
    guestLabel: string | null;
    serverName: string | null;
    kitchenOpenCount: number;
    kitchenReadyCount: number;
    href: string;
  }>
> {
  const db = await getOfflineDb();
  if (!db) return [];
  const branches = await db.branches.toArray();
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const diningSource =
    options?.industryProfile === "bar" ? ("bar_tab" as const) : ("restaurant_table" as const);
  const rows: Array<{
    id: string;
    kind: "dining_session" | "hotel_stay" | "hotel_reservation";
    source: "restaurant_table" | "bar_tab" | "room_folio" | "reservation";
    originLabel: string;
    status: string;
    paymentStatus: "unpaid";
    fulfilmentStatus: string | null;
    branchId: string;
    branchName: string | null;
    openedAt: number;
    total: number;
    itemCount: number;
    guestLabel: string | null;
    serverName: string | null;
    kitchenOpenCount: number;
    kitchenReadyCount: number;
    href: string;
  }> = [];

  try {
    const sessions = (await db.diningSessions.toArray()).filter((s) => s.status === "open");
    const items = await db.diningSessionItems.toArray();
    const tickets = await db.kitchenTickets.toArray();
    for (const session of sessions) {
      if (options?.branchId && session.branchId !== options.branchId) continue;
      const sessionItems = items.filter(
        (i) => i.sessionId === session.id && i.kitchenStatus !== "void",
      );
      const sessionTickets = tickets.filter((t) => t.sessionId === session.id);
      const kitchenOpenCount = sessionTickets.filter((t) => t.status === "open").length;
      const kitchenReadyCount = sessionTickets.filter((t) => t.status === "ready").length;
      let fulfilmentStatus: string | null = "Open";
      if (kitchenReadyCount > 0) fulfilmentStatus = "Ready";
      else if (kitchenOpenCount > 0) fulfilmentStatus = "Preparing";
      rows.push({
        id: session.id,
        kind: "dining_session",
        source: diningSource,
        originLabel: `Table ${session.tableName}`,
        status: session.status,
        paymentStatus: "unpaid",
        fulfilmentStatus,
        branchId: session.branchId,
        branchName: branchNameById.get(session.branchId) ?? null,
        openedAt: session.openedAt,
        total: sessionItems.reduce((sum, i) => sum + i.lineTotal, 0),
        itemCount: sessionItems.length,
        guestLabel: session.guestCount ? `${session.guestCount} guests` : null,
        serverName: session.openedByName ?? null,
        kitchenOpenCount,
        kitchenReadyCount,
        href: "/floor",
      });
    }

    const stays = (await db.hotelStays.toArray()).filter((s) => s.status === "open");
    const charges = await db.hotelFolioCharges.toArray();
    for (const stay of stays) {
      if (options?.branchId && stay.branchId !== options.branchId) continue;
      const openCharges = charges.filter((c) => c.stayId === stay.id && c.status === "open");
      rows.push({
        id: stay.id,
        kind: "hotel_stay",
        source: "room_folio",
        originLabel: `Room ${stay.roomName}`,
        status: stay.status,
        paymentStatus: "unpaid",
        fulfilmentStatus: null,
        branchId: stay.branchId,
        branchName: branchNameById.get(stay.branchId) ?? null,
        openedAt: stay.checkInAt,
        total: openCharges.reduce((sum, c) => sum + c.lineTotal, 0),
        itemCount: openCharges.length,
        guestLabel: stay.customerName,
        serverName: stay.checkedInByName ?? null,
        kitchenOpenCount: 0,
        kitchenReadyCount: 0,
        href: "/rooms",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const untilDate = new Date();
    untilDate.setDate(untilDate.getDate() + 14);
    const until = untilDate.toISOString().slice(0, 10);
    const reservations = await db.hotelReservations.toArray();
    for (const reservation of reservations) {
      if (options?.branchId && reservation.branchId !== options.branchId) continue;
      if (reservation.status !== "booked" && reservation.status !== "confirmed") continue;
      if (reservation.departureDate < today) continue;
      if (reservation.arrivalDate > until) continue;
      const ref = `#${reservation.id.slice(-6).toUpperCase()}`;
      const roomPart = reservation.roomName ? `  -  Room ${reservation.roomName}` : "";
      rows.push({
        id: reservation.id,
        kind: "hotel_reservation",
        source: "reservation",
        originLabel: `Reservation ${ref}${roomPart}`,
        status: reservation.status,
        paymentStatus: "unpaid",
        fulfilmentStatus: null,
        branchId: reservation.branchId,
        branchName: branchNameById.get(reservation.branchId) ?? null,
        openedAt: reservation.createdAt,
        total: 0,
        itemCount: 0,
        guestLabel: reservation.customerName,
        serverName: null,
        kitchenOpenCount: 0,
        kitchenReadyCount: 0,
        href: "/reservations",
      });
    }
  } catch {
    /* Stores missing until replica upgrade ? return what we have. */
  }

  return rows.sort((a, b) => b.openedAt - a.openedAt);
}

export async function listMirroredDiningTables(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    const rows = await db.diningTables.toArray();
    return rows
      .filter((r) => r.status === "active")
      .filter((r) => !branchId || r.branchId === branchId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listMirroredOpenDiningSessions(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    return (await db.diningSessions.toArray())
      .filter((s) => s.status === "open")
      .filter((s) => !branchId || s.branchId === branchId);
  } catch {
    return [];
  }
}

export async function getMirroredDiningSession(sessionId: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    const session = await db.diningSessions.get(sessionId);
    if (!session || session.status !== "open") return null;
    const items = (await db.diningSessionItems.where("sessionId").equals(sessionId).toArray()).filter(
      (i) => i.kitchenStatus !== "void",
    );
    return { ...session, items };
  } catch {
    return null;
  }
}

export async function listMirroredKitchenTickets(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    return (await db.kitchenTickets.toArray())
      .filter((t) => t.status === "open" || t.status === "ready")
      .filter((t) => !branchId || t.branchId === branchId)
      .sort((a, b) => a.firedAt - b.firedAt)
      .map((t) => {
        let lines: Array<{
          id: string;
          productName: string;
          quantity: number;
          modifiersLabel?: string | null;
          note?: string | null;
        }> = [];
        try {
          lines = JSON.parse(t.linesJson) as typeof lines;
        } catch {
          lines = [];
        }
        return { ...t, lines };
      });
  } catch {
    return [];
  }
}

export async function listMirroredHotelRooms(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    return (await db.hotelRooms.toArray())
      .filter((r) => r.status !== "inactive")
      .filter((r) => !branchId || r.branchId === branchId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listMirroredOpenHotelStays(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    return (await db.hotelStays.toArray())
      .filter((s) => s.status === "open")
      .filter((s) => !branchId || s.branchId === branchId);
  } catch {
    return [];
  }
}

export async function getMirroredHotelStay(stayId: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    const stay = await db.hotelStays.get(stayId);
    if (!stay) return null;
    const charges = await db.hotelFolioCharges.where("stayId").equals(stayId).toArray();
    const openCharges = charges.filter((c) => c.status === "open");
    return {
      ...stay,
      charges: charges.sort((a, b) => a.createdAt - b.createdAt),
      folioTotal: openCharges.reduce((sum, c) => sum + c.lineTotal, 0),
    };
  } catch {
    return null;
  }
}

export async function listMirroredHotelReservations(branchId?: string) {
  const db = await getOfflineDb();
  if (!db) return null;
  try {
    return (await db.hotelReservations.toArray())
      .filter((r) => r.status !== "cancelled")
      .filter((r) => !branchId || r.branchId === branchId)
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  } catch {
    return [];
  }
}

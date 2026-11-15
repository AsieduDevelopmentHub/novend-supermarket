"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  listLocalOrders,
  listMirroredBranches,
  listMirroredCategories,
  listMirroredCustomers,
  listMirroredCustomerGroups,
  listMirroredPriceListRules,
  getMirroredProduct,
  listMirroredExpenses,
  listMirroredProducts,
  type PagedMirroredProducts,
  listMirroredReturns,
  listMirroredSuppliers,
  listMirroredUsers,
  listMirroredWholesalePurchases,
  listMirroredWholesaleStock,
  listMirroredWholesaleTransfers,
  wholesaleSummaryFromMirror,
  type MirroredProductRow,
} from "@/lib/offline/mirror-queries";
import type { MirroredCustomer } from "@/lib/offline/types";
import { useOfflineStatus } from "@/providers/offline-provider";
import { useBusinessDataGate } from "@/hooks/use-business-data-gate";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { getOfflineDb } from "@/lib/offline/db";
import { pickLiveListWhenOnline, pickReplicaList } from "@/lib/offline/list-preference";
import { presenceFromLastSeenAt, sortUsersByPresence } from "@/lib/presence";

type ProductListRow = {
  id: Id<"products">;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryName: string;
  description?: string | null;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  unit: string;
  sellUnits?: MirroredProductRow["sellUnits"];
  isLowStock: boolean;
  isExpired?: boolean;
  isExpiring?: boolean;
  status: string;
  tracksExpiry?: boolean;
  /** When false, catalogue item does not track stock quantity. */
  tracksInventory?: boolean;
  expiryAlertDays?: number | null;
  nearestExpiry?: string | null;
  imageUrl: string | null;
  updatedAt?: number;
};

function mapProduct(row: MirroredProductRow, canViewCost: boolean): ProductListRow {
  return {
    id: row.id as Id<"products">,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryName: row.categoryName,
    description: row.description ?? null,
    sellingPrice: row.sellingPrice,
    costPrice: canViewCost ? row.costPrice : undefined,
    stockQuantity: row.stockQuantity,
    lowStockThreshold: row.lowStockThreshold,
    unit: row.unit,
    sellUnits: row.sellUnits ?? null,
    isLowStock: row.isLowStock,
    isExpired: row.isExpired,
    isExpiring: row.isExpiring,
    status: row.status,
    tracksExpiry: row.tracksExpiry,
    tracksInventory: row.tracksInventory !== false,
    expiryAlertDays: row.expiryAlertDays,
    nearestExpiry: row.nearestExpiry ?? null,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt,
  };
}

/**
 * Local-first products list.
 * Warm Dexie mirror skips the live Convex subscription; snapshot sync keeps data fresh.
 */
function isPagedProducts(
  value: Awaited<ReturnType<typeof listMirroredProducts>>,
): value is PagedMirroredProducts {
  return Boolean(value && !Array.isArray(value) && "items" in value);
}

export function useProductsList(options: {
  search: string;
  includeInactive: boolean;
  branchId?: Id<"branches">;
  categoryId?: Id<"categories">;
  canViewCost: boolean;
  preferLocal?: boolean;
  page?: number;
  pageSize?: number;
  /** When false, skip remote + local loads (lazy export). */
  enabled?: boolean;
}) {
  const enabled = options.enabled !== false;
  const { online, serveLocal, ready, lastSyncAt } = useBusinessDataGate();
  const [local, setLocal] = useState<ProductListRow[] | null>(null);
  const [localTotal, setLocalTotal] = useState(0);
  const skipLive = !enabled || !online || !ready || serveLocal;
  const remote = useAuthedQuery(
    api.products.listProducts,
    skipLive
      ? "skip"
      : {
          search: options.search || undefined,
          includeInactive: options.includeInactive,
          branchId: options.branchId,
          categoryId: options.categoryId,
          page: options.page,
          pageSize: options.pageSize,
        },
  );
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setLocal(null);
        setLocalTotal(0);
        setLocalLoading(false);
      });
      return;
    }
    let cancelled = false;
    const load = () => {
      // Keep prior rows visible while the next Dexie page loads (avoids "stuck" blank UI).
      setLocalLoading(true);
      void listMirroredProducts({
        search: options.search || undefined,
        includeInactive: options.includeInactive,
        branchId: options.branchId ?? null,
        categoryId: options.categoryId,
        page: options.page,
        pageSize: options.pageSize,
      }).then((rows) => {
        if (cancelled || rows == null) return;
        if (isPagedProducts(rows)) {
          setLocal(rows.items.map((r) => mapProduct(r, options.canViewCost)));
          setLocalTotal(rows.total);
        } else {
          setLocal(rows.map((r) => mapProduct(r, options.canViewCost)));
          setLocalTotal(rows.length);
        }
        setLocalLoading(false);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [
    enabled,
    options.search,
    options.includeInactive,
    options.canViewCost,
    options.branchId,
    options.categoryId,
    options.page,
    options.pageSize,
    remote,
    lastSyncAt,
  ]);

  if (online && !serveLocal && remote !== undefined) {
    return {
      products: remote.items,
      total: remote.total,
      loading: false,
      source: "remote" as const,
    };
  }
  if (local != null) {
    return {
      products: local,
      total: localTotal,
      loading: localLoading,
      source: "local" as const,
    };
  }
  return {
    products: [] as ProductListRow[],
    total: 0,
    loading: true,
    source: "local" as const,
  };
}

type InventoryAlertBranch = {
  branchId: Id<"branches">;
  branchName: string;
  stockQuantity: number;
  sellableQuantity: number;
  expiredQuantity: number;
  expiringQuantity: number;
  nearestExpiry?: string | null;
  isLowStock: boolean;
  isExpired: boolean;
  isExpiring: boolean;
};

export type InventoryRow = {
  id: Id<"products">;
  name: string;
  sku: string;
  categoryName: string;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  isLowStock: boolean;
  statusLabel: string;
  imageUrl: string | null;
  tracksExpiry?: boolean;
  sellableQuantity?: number;
  expiredQuantity?: number;
  expiringQuantity?: number;
  nearestExpiry?: string | null;
  isExpired?: boolean;
  isExpiring?: boolean;
  branchId?: Id<"branches"> | null;
  branchName?: string | null;
  alertBranches?: InventoryAlertBranch[];
  /** Stable list key when org-wide alerts expand to product×branch rows. */
  rowKey?: string;
};

function normalizeInventoryRow(r: {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  isLowStock: boolean;
  statusLabel?: string;
  imageUrl: string | null;
  tracksExpiry?: boolean;
  sellableQuantity?: number;
  expiredQuantity?: number;
  expiringQuantity?: number;
  nearestExpiry?: string | null;
  isExpired?: boolean;
  isExpiring?: boolean;
  branchId?: string | null;
  branchName?: string | null;
  alertBranches?: Array<{
    branchId: string;
    branchName: string;
    stockQuantity: number;
    sellableQuantity: number;
    expiredQuantity: number;
    expiringQuantity: number;
    nearestExpiry?: string | null;
    isLowStock: boolean;
    isExpired: boolean;
    isExpiring: boolean;
  }>;
}): InventoryRow {
  return {
    id: r.id as Id<"products">,
    name: r.name,
    sku: r.sku,
    categoryName: r.categoryName,
    stockQuantity: r.stockQuantity,
    unit: r.unit,
    lowStockThreshold: r.lowStockThreshold,
    isLowStock: r.isLowStock,
    statusLabel:
      r.statusLabel ??
      (r.isExpired
        ? "Expired"
        : r.isExpiring
          ? "Expiring"
          : r.isLowStock
            ? "Low stock"
            : "In stock"),
    imageUrl: r.imageUrl,
    tracksExpiry: r.tracksExpiry,
    sellableQuantity: r.sellableQuantity ?? r.stockQuantity,
    expiredQuantity: r.expiredQuantity ?? 0,
    expiringQuantity: r.expiringQuantity ?? 0,
    nearestExpiry: r.nearestExpiry,
    isExpired: r.isExpired,
    isExpiring: r.isExpiring,
    branchId: (r.branchId as Id<"branches"> | null | undefined) ?? null,
    branchName: r.branchName ?? null,
    alertBranches: r.alertBranches?.map((branch) => ({
      branchId: branch.branchId as Id<"branches">,
      branchName: branch.branchName,
      stockQuantity: branch.stockQuantity,
      sellableQuantity: branch.sellableQuantity,
      expiredQuantity: branch.expiredQuantity,
      expiringQuantity: branch.expiringQuantity,
      nearestExpiry: branch.nearestExpiry,
      isLowStock: branch.isLowStock,
      isExpired: branch.isExpired,
      isExpiring: branch.isExpiring,
    })),
  };
}

/** Local-first inventory list (Dexie page when pageSize set; warm Map index). */
export function useInventoryList(options: {
  search: string;
  categoryId?: Id<"categories">;
  branchId?: Id<"branches">;
  page?: number;
  pageSize?: number;
  /**
   * When set, loads the full enriched catalog then filters — alert views need
   * isLowStock / expiry flags before paging. Omit for normal paged lists.
   */
  stockAlert?: "low" | "expiry";
}) {
  const { online, serveLocal, ready, lastSyncAt } = useBusinessDataGate();
  const alertMode = Boolean(options.stockAlert);
  const remote = useAuthedQuery(
    api.inventory.list,
    online && ready && !serveLocal
      ? {
          search: options.search || undefined,
          categoryId: options.categoryId,
          branchId: options.branchId,
        }
      : "skip",
  );
  const [local, setLocal] = useState<InventoryRow[] | null>(null);
  const [localTotal, setLocalTotal] = useState(0);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      setLocalLoading(true);
      void listMirroredProducts({
        search: options.search || undefined,
        categoryId: options.categoryId,
        branchId: options.branchId ?? null,
        page: alertMode ? undefined : options.page,
        pageSize: alertMode ? undefined : options.pageSize,
      }).then((rows) => {
        if (cancelled || rows == null) return;
        if (isPagedProducts(rows)) {
          setLocal(rows.items.map((r) => normalizeInventoryRow(r)));
          setLocalTotal(rows.total);
        } else {
          let mapped = rows.map((r) => normalizeInventoryRow(r));
          if (options.stockAlert === "low") {
            mapped = mapped.filter((r) => r.isLowStock);
          } else if (options.stockAlert === "expiry") {
            mapped = mapped.filter((r) => r.isExpired || r.isExpiring);
          }
          setLocal(mapped);
          setLocalTotal(mapped.length);
        }
        setLocalLoading(false);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [
    options.search,
    options.categoryId,
    options.branchId,
    options.page,
    options.pageSize,
    options.stockAlert,
    alertMode,
    remote,
    lastSyncAt,
  ]);

  if (online && !serveLocal && remote !== undefined) {
    let rows = remote.map((r) => normalizeInventoryRow(r));
    if (options.stockAlert === "low") {
      rows = rows.filter((r) => r.isLowStock);
    } else if (options.stockAlert === "expiry") {
      rows = rows.filter((r) => r.isExpired || r.isExpiring);
    }
    return {
      rows,
      total: rows.length,
      loading: false,
      source: "remote" as const,
    };
  }
  if (local != null) {
    return {
      rows: local,
      total: localTotal,
      loading: localLoading,
      source: "local" as const,
    };
  }
  return { rows: undefined, total: 0, loading: true, source: "local" as const };
}

export function useCategoriesList() {
  const { online, serveLocal, ready, lastSyncAt } = useBusinessDataGate();
  const remote = useAuthedQuery(
    api.categories.list,
    online && ready && !serveLocal ? {} : "skip",
  );
  const [local, setLocal] = useState<Array<{ _id: Id<"categories">; name: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listMirroredCategories().then((rows) => {
        if (cancelled || rows == null) return;
        setLocal(rows.map((c) => ({ _id: c.id as Id<"categories">, name: c.name })));
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [remote, lastSyncAt]);

  useEffect(() => {
    if (!remote?.length || serveLocal) return;
    void (async () => {
      const db = await getOfflineDb();
      if (!db) return;
      await db.categories.bulkPut(
        remote.map((category) => ({
          id: category._id as string,
          name: category.name,
          slug: category.name.trim().toLowerCase().replace(/\s+/g, "-"),
          isActive: true,
        })),
      );
    })();
  }, [remote, serveLocal]);

  const merged = useMemo(() => {
    const byId = new Map<string, { _id: Id<"categories">; name: string }>();
    for (const row of local ?? []) byId.set(row._id, row);
    // Only merge live rows when we intentionally opened the subscription.
    if (!serveLocal) {
      for (const row of remote ?? []) byId.set(row._id, row);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [local, remote, serveLocal]);

  if (merged.length > 0) return merged;
  return local ?? remote;
}

export function useMirroredProduct(productId: string | null, branchId?: Id<"branches"> | null) {
  const { lastSyncAt } = useOfflineStatus();
  const [product, setProduct] = useState<MirroredProductRow | null | undefined>(undefined);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;
    const load = () => {
      void getMirroredProduct(productId, branchId ?? null).then((row) => {
        if (!cancelled) {
          setProduct(row);
          setResolvedId(productId);
        }
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [productId, branchId, lastSyncAt]);

  if (!productId) return null;
  if (resolvedId !== productId) return undefined;
  return product;
}

export function useCustomersList(options: { search: string; includeInactive: boolean }) {
  const { online, serveLocal, ready, lastSyncAt } = useBusinessDataGate();
  const remote = useAuthedQuery(
    api.customers.list,
    online && ready && !serveLocal
      ? {
          search: options.search || undefined,
          includeInactive: options.includeInactive,
        }
      : "skip",
  );
  const [local, setLocal] = useState<MirroredCustomer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listMirroredCustomers({
        search: options.search || undefined,
        includeInactive: options.includeInactive,
      }).then((rows) => {
        if (!cancelled) setLocal(rows);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [options.search, options.includeInactive, remote, lastSyncAt]);

  const mapLocal = (rows: MirroredCustomer[]) =>
    rows.map((c) => ({
      id: c.id as Id<"customers">,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes ?? null,
      status: c.status,
      purchaseCount: c.purchaseCount ?? 0,
      lastPurchaseAt: c.lastPurchaseAt ?? null,
      lastPurchaseTotal: c.lastPurchaseTotal ?? null,
      lastInvoiceNumber: c.lastInvoiceNumber ?? null,
      creditLimit: c.creditLimit ?? null,
      customerGroupId: c.customerGroupId ?? null,
      balance: c.balance ?? 0,
    }));

  const mappedLocal = local ? mapLocal(local) : null;
  const picked = pickReplicaList({ local: mappedLocal, remote, online });
  if (picked.source === "remote" && remote !== undefined) {
    return { customers: remote, loading: false, source: "remote" as const };
  }
  if (picked.rows) {
    return { customers: picked.rows, loading: false, source: "local" as const };
  }
  return { customers: undefined, loading: true, source: "local" as const };
}

export type OrdersListOptions = {
  search: string;
  branchId?: Id<"branches">;
  cashierId?: Id<"users">;
  startDate?: number;
  endDate?: number;
  minTotal?: number;
  maxTotal?: number;
  paymentMethod?: "cash" | "card" | "mobile_money";
  returnStatus?: "none" | "returned";
};

export function useOrdersList(options: OrdersListOptions) {
  const { online, serveLocal, ready, lastSyncAt } = useBusinessDataGate();
  const [local, setLocal] = useState<Awaited<ReturnType<typeof listLocalOrders>>>(null);
  const useRemote = online && ready && !serveLocal;
  const remote = useAuthedQuery(
    api.sales.listOrders,
    useRemote
      ? {
          search: options.search || undefined,
          branchId: options.branchId,
          cashierId: options.cashierId,
          startDate: options.startDate,
          endDate: options.endDate,
          minTotal: options.minTotal,
          maxTotal: options.maxTotal,
          paymentMethod: options.paymentMethod,
          returnStatus: options.returnStatus,
        }
      : "skip",
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listLocalOrders({
        search: options.search || undefined,
        branchId: options.branchId,
        cashierId: options.cashierId,
        startDate: options.startDate,
        endDate: options.endDate,
        minTotal: options.minTotal,
        maxTotal: options.maxTotal,
        paymentMethod: options.paymentMethod,
        returnStatus: options.returnStatus,
      }).then((rows) => {
        if (!cancelled) setLocal(rows);
      });
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [
    options.search,
    options.branchId,
    options.cashierId,
    options.startDate,
    options.endDate,
    options.minTotal,
    options.maxTotal,
    options.paymentMethod,
    options.returnStatus,
    remote,
    lastSyncAt,
  ]);

  function mapLocalRow(o: NonNullable<Awaited<ReturnType<typeof listLocalOrders>>>[number]) {
    return {
      id: o.id as Id<"sales">,
      invoiceNumber: o.invoiceNumber,
      completedAt: o.completedAt,
      branchId: (o.branchId as Id<"branches"> | null) ?? null,
      branchName: o.branchName,
      customerId: (o.customerId as Id<"customers"> | null) ?? null,
      customerName: o.customerName,
      cashierId: (o.cashierId as Id<"users"> | null) ?? null,
      cashierName: o.cashierName,
      itemCount: o.itemCount,
      paymentMethod: o.paymentMethod,
      amountPaid: o.amountPaid,
      changeGiven: o.changeGiven,
      total: o.total,
      status: o.status === "synced" ? "completed" : o.status,
      refundedAmount: o.refundedAmount,
    };
  }

  if (online && !serveLocal && remote !== undefined) {
    const refundById = new Map((local ?? []).map((o) => [o.id, o.refundedAmount] as const));
    const mergedRemote = remote.map((o) => ({
      ...o,
      refundedAmount: Math.max(o.refundedAmount ?? 0, refundById.get(String(o.id)) ?? 0),
    }));
    const pendingLocal =
      local?.filter((o) => o.isLocal && (o.status === "pending" || o.status === "failed")) ?? [];
    if (pendingLocal.length === 0) {
      return { orders: mergedRemote, loading: false, source: "remote" as const };
    }
    const remoteIds = new Set(remote.map((o) => o.id));
    const extras = pendingLocal.filter((o) => !remoteIds.has(o.id as Id<"sales">)).map(mapLocalRow);
    return {
      orders: [...extras, ...mergedRemote].sort((a, b) => b.completedAt - a.completedAt),
      loading: false,
      source: "remote" as const,
    };
  }

  if (!online && local !== null) {
    return {
      orders: local.map(mapLocalRow),
      loading: false,
      source: "local" as const,
    };
  }

  if (local !== null) {
    return {
      orders: local.map(mapLocalRow),
      loading: false,
      source: "local" as const,
    };
  }

  if (remote !== undefined) {
    return { orders: remote, loading: false, source: "remote" as const };
  }
  return { orders: undefined, loading: true, source: "local" as const };
}

function useMirrorRows<T>(loader: () => Promise<T[]>, deps: unknown[]) {
  const { lastSyncAt } = useOfflineStatus();
  const [rows, setRows] = useState<T[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void loader()
        .then((data) => {
          if (!cancelled) setRows(data);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        });
    };
    run();
    const unsub = subscribeReplicaChanged(run);
    return () => {
      cancelled = true;
      unsub();
    };
    // loader is recreated each render; deps capture the inputs that change the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, lastSyncAt]);

  return rows;
}

export function useSuppliersList(options: { search: string; includeInactive: boolean }) {
  const { online, serveLocal, ready } = useBusinessDataGate();
  const remote = useAuthedQuery(
    api.suppliers.list,
    online && ready && !serveLocal
      ? { search: options.search || undefined, includeInactive: options.includeInactive }
      : "skip",
  );
  const local = useMirrorRows(
    () =>
      listMirroredSuppliers({ search: options.search, includeInactive: options.includeInactive }),
    [options.search, options.includeInactive],
  );
  const mappedRemote = remote?.map((row) => ({
    id: String(row._id),
    name: row.name,
    contactName: row.contactName ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    status: row.status,
    createdAt: row.createdAt,
  }));
  const picked = pickReplicaList({ local, remote: mappedRemote, online });
  if (picked.rows) return { suppliers: picked.rows, loading: false };
  return {
    suppliers: [] as Awaited<ReturnType<typeof listMirroredSuppliers>>,
    loading: true,
  };
}

export function useWholesaleLists(search: string) {
  const { online, serveLocal, ready } = useBusinessDataGate();
  const live = online && ready && !serveLocal;
  const stock = useAuthedQuery(api.wholesale.listStock, live ? { search } : "skip");
  const summary = useAuthedQuery(api.wholesale.summary, live ? {} : "skip");
  const purchases = useAuthedQuery(api.wholesale.listPurchases, live ? {} : "skip");
  const transfers = useAuthedQuery(api.wholesale.listTransfers, live ? {} : "skip");
  const localStock = useMirrorRows(() => listMirroredWholesaleStock(search), [search]);
  const localPurchases = useMirrorRows(() => listMirroredWholesalePurchases(), []);
  const localTransfers = useMirrorRows(() => listMirroredWholesaleTransfers(), []);
  const [localSummary, setLocalSummary] = useState<{
    units: number;
    value: number;
    skuCount: number;
  } | null>(null);
  const { lastSyncAt } = useOfflineStatus();
  useEffect(() => {
    let cancelled = false;
    void wholesaleSummaryFromMirror().then((row) => {
      if (!cancelled) setLocalSummary(row);
    });
    return () => {
      cancelled = true;
    };
  }, [lastSyncAt, localStock]);

  const stockPick = pickReplicaList({ local: localStock, remote: stock ?? undefined, online });
  const purchasePick = pickReplicaList({
    local: localPurchases,
    remote: purchases ?? undefined,
    online,
  });
  const transferPick = pickReplicaList({
    local: localTransfers,
    remote: transfers ?? undefined,
    online,
  });
  return {
    stock: stockPick.rows ?? localStock,
    summary: !online || localSummary ? localSummary : (summary ?? localSummary),
    purchases: purchasePick.rows ?? localPurchases,
    transfers: transferPick.rows ?? localTransfers,
  };
}

/** Customer price-list groups (managers). Dexie first; Convex fills the gap before the first snapshot. */
export function useCustomerGroups(enabled = true) {
  const { online, ready, serveLocal } = useBusinessDataGate();
  const local = useMirrorRows(() => listMirroredCustomerGroups(), []);
  const remote = useAuthedQuery(
    api.priceLists.listGroups,
    enabled && online && ready && !serveLocal ? {} : "skip",
  );
  const mappedLocal = local?.map((row) => ({ ...row, id: row.id as Id<"customerGroups"> }));
  return pickReplicaList({ local: mappedLocal, remote, online }).rows;
}

export function usePriceListRules(enabled = true) {
  const { online, ready, serveLocal } = useBusinessDataGate();
  const local = useMirrorRows(() => listMirroredPriceListRules(), []);
  const remote = useAuthedQuery(
    api.priceLists.listRules,
    enabled && online && ready && !serveLocal ? {} : "skip",
  );
  const mappedLocal = local?.map((row) => ({ ...row, id: row.id as Id<"priceListRules"> }));
  return pickReplicaList({ local: mappedLocal, remote, online }).rows;
}

export function useBranchesList(includeInactive = false, enabled = true) {
  const { online, ready, serveLocal } = useBusinessDataGate();
  const local = useMirrorRows(() => listMirroredBranches(includeInactive), [includeInactive]);
  const mappedLocal = local?.map((row) => ({
    id: row.id as Id<"branches">,
    name: row.name,
    code: row.code,
    address: row.address,
    phone: row.phone,
    status: row.status,
  }));
  const remote = useAuthedQuery(
    api.branches.list,
    enabled && online && ready && !serveLocal ? { includeInactive } : "skip",
  );
  if (mappedLocal && mappedLocal.length > 0) return mappedLocal;
  if (online && remote !== undefined) return remote;
  return mappedLocal ?? remote;
}

export function useUsersList(search: string, enabled = true) {
  const { online, ready, serveLocal } = useBusinessDataGate();
  const local = useMirrorRows(() => listMirroredUsers(search), [search]);
  const mappedLocal = local?.map((row) => {
    const { lastSeenAt, presence } = presenceFromLastSeenAt(row.lastSeenAt);
    return {
      ...row,
      id: row.id as Id<"profiles">,
      branchId: (row.branchId as Id<"branches"> | null) ?? null,
      role: row.role as "administrator" | "manager" | "cashier",
      status: (row.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
      presence,
      lastSeenAt,
      lastLoginAt: row.lastLoginAt ?? null,
      lastDevice: row.lastDevice ?? null,
    };
  });
  const remote = useAuthedQuery(
    api.users.list,
    enabled && online && ready && !serveLocal ? { search: search || undefined } : "skip",
  );
  if (!enabled) return mappedLocal;
  const picked = pickLiveListWhenOnline({ local: mappedLocal, remote, online });
  if (!picked) return undefined;
  if (!online) return sortUsersByPresence(picked);
  return picked;
}

export function useReturnsList(options: {
  search: string;
  kind: "all" | "full" | "partial";
  branchId?: Id<"branches">;
}) {
  const { online, ready, serveLocal } = useBusinessDataGate();
  const local = useMirrorRows(
    () =>
      listMirroredReturns({
        search: options.search,
        kind: options.kind,
        branchId: options.branchId,
      }).then((rows) =>
        rows.map((row) => ({
          ...row,
          customerName: row.customerName ?? "—",
          cashierName: row.cashierName ?? "—",
          reason: row.reason ?? "",
          status: row.status ?? "completed",
        })),
      ),
    [options.search, options.kind, options.branchId],
  );
  const remote = useAuthedQuery(
    api.returns.list,
    online && ready && !serveLocal
      ? {
          search: options.search || undefined,
          kind: options.kind === "all" ? undefined : options.kind,
          branchId: options.branchId,
        }
      : "skip",
  );
  if (online && remote !== undefined) return remote;
  if (local && local.length > 0) return local;
  return local ?? remote;
}

export function useLocalExpenses(range: { startDate: number; endDate: number } | null) {
  return useMirrorRows(
    () => (range ? listMirroredExpenses(range) : Promise.resolve([])),
    [range?.startDate, range?.endDate],
  );
}

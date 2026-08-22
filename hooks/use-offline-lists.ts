"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import { canServeListsFromMirror } from "@/lib/offline/freshness";
import {
  listLocalOrders,
  listMirroredBranches,
  listMirroredCategories,
  listMirroredCustomers,
  getMirroredProduct,
  listMirroredExpenses,
  listMirroredProducts,
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
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";

type ProductListRow = {
  id: Id<"products">;
  name: string;
  sku: string;
  categoryName: string;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  unit: string;
  isLowStock: boolean;
  isExpired?: boolean;
  isExpiring?: boolean;
  status: string;
  imageUrl: string | null;
};

function mapProduct(row: MirroredProductRow, canViewCost: boolean): ProductListRow {
  return {
    id: row.id as Id<"products">,
    name: row.name,
    sku: row.sku,
    categoryName: row.categoryName,
    sellingPrice: row.sellingPrice,
    costPrice: canViewCost ? row.costPrice : undefined,
    stockQuantity: row.stockQuantity,
    unit: row.unit,
    isLowStock: row.isLowStock,
    isExpired: row.isExpired,
    isExpiring: row.isExpiring,
    status: row.status,
    imageUrl: row.imageUrl,
  };
}

/** Skip live Convex when Dexie mirror is warm; re-evaluate when sync completes. */
function useMirrorListGate() {
  const online = useConnectivity();
  const { lastSyncAt } = useOfflineStatus();
  const [serveLocal, setServeLocal] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = !online ? true : await canServeListsFromMirror();
      if (cancelled) return;
      setServeLocal(ok);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, lastSyncAt]);

  return { online, serveLocal, ready, lastSyncAt };
}

/**
 * Local-first products list.
 * Warm Dexie mirror skips the live Convex subscription; snapshot sync keeps data fresh.
 */
export function useProductsList(options: {
  search: string;
  includeInactive: boolean;
  branchId?: Id<"branches">;
  canViewCost: boolean;
  preferLocal?: boolean;
}) {
  const { online, serveLocal, ready, lastSyncAt } = useMirrorListGate();
  // Cross-branch admin filters are not in the Dexie mirror — always use Convex.
  const forceRemote = Boolean(options.branchId);
  const preferLocal = !forceRemote && (options.preferLocal === true || serveLocal);
  const [local, setLocal] = useState<ProductListRow[] | null>(null);
  const replicaEmpty = local !== null && local.length === 0;
  const useRemote = online && ready && (!preferLocal || replicaEmpty || forceRemote);
  const remote = useQuery(
    api.products.listProducts,
    useRemote
      ? {
          search: options.search || undefined,
          includeInactive: options.includeInactive,
          branchId: options.branchId,
        }
      : "skip",
  );
  useEffect(() => {
    let cancelled = false;
    void listMirroredProducts({
      search: options.search || undefined,
      includeInactive: options.includeInactive,
    }).then((rows) => {
      if (cancelled || !rows) return;
      setLocal(rows.map((r) => mapProduct(r, options.canViewCost)));
    });
    return () => {
      cancelled = true;
    };
  }, [
    options.search,
    options.includeInactive,
    options.canViewCost,
    remote,
    lastSyncAt,
    serveLocal,
  ]);

  if (preferLocal && local !== null && local.length > 0) {
    return { products: local, loading: false, source: "local" as const };
  }
  if (online && remote !== undefined) {
    return { products: remote, loading: false, source: "remote" as const };
  }
  if (local !== null) {
    return { products: local, loading: false, source: "local" as const };
  }
  if (remote !== undefined) {
    return { products: remote, loading: false, source: "remote" as const };
  }
  return {
    products: [] as ProductListRow[],
    loading: true,
    source: "local" as const,
  };
}

type InventoryRow = {
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
  nearestExpiry?: string | null;
  isExpired?: boolean;
  isExpiring?: boolean;
};

/** Local-first inventory list. */
export function useInventoryList(options: {
  search: string;
  categoryId?: Id<"categories">;
  branchId?: Id<"branches">;
}) {
  const { online, serveLocal, ready, lastSyncAt } = useMirrorListGate();
  const forceRemote = Boolean(options.branchId);
  const useLocal = !forceRemote && serveLocal;
  const useRemote = online && ready && !useLocal;
  const remote = useQuery(
    api.inventory.list,
    useRemote
      ? {
          search: options.search || undefined,
          categoryId: options.categoryId,
          branchId: options.branchId,
        }
      : "skip",
  );
  const [local, setLocal] = useState<InventoryRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMirroredProducts({
      search: options.search || undefined,
      categoryId: options.categoryId,
    }).then((rows) => {
      if (cancelled || !rows) return;
      setLocal(
        rows.map((r) => ({
          id: r.id as Id<"products">,
          name: r.name,
          sku: r.sku,
          categoryName: r.categoryName,
          stockQuantity: r.stockQuantity,
          unit: r.unit,
          lowStockThreshold: r.lowStockThreshold,
          isLowStock: r.isLowStock,
          statusLabel: r.isExpired
            ? "Expired"
            : r.isExpiring
              ? "Expiring"
              : r.isLowStock
                ? "Low stock"
                : "In stock",
          imageUrl: r.imageUrl,
          tracksExpiry: r.tracksExpiry,
          sellableQuantity: r.sellableQuantity ?? r.stockQuantity,
          nearestExpiry: r.nearestExpiry,
          isExpired: r.isExpired,
          isExpiring: r.isExpiring,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [options.search, options.categoryId, remote, lastSyncAt, useLocal]);

  if (useLocal && local !== null) {
    return { rows: local, loading: false, source: "local" as const };
  }
  if (online && remote !== undefined) {
    return { rows: remote, loading: false, source: "remote" as const };
  }
  if (local !== null) {
    return { rows: local, loading: false, source: "local" as const };
  }
  if (remote !== undefined) {
    return { rows: remote, loading: false, source: "remote" as const };
  }
  return { rows: undefined, loading: true, source: "local" as const };
}

export function useCategoriesList() {
  const { online, serveLocal, ready, lastSyncAt } = useMirrorListGate();
  const remote = useQuery(api.categories.list, online && ready && !serveLocal ? {} : "skip");
  const [local, setLocal] = useState<Array<{ _id: Id<"categories">; name: string }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMirroredCategories().then((rows) => {
      if (cancelled || !rows) return;
      setLocal(rows.map((c) => ({ _id: c.id as Id<"categories">, name: c.name })));
    });
    return () => {
      cancelled = true;
    };
  }, [remote, lastSyncAt, serveLocal]);

  if (serveLocal && local !== null) return local;
  if (online && remote !== undefined) return remote;
  if (local !== null) return local;
  return remote;
}

export function useMirroredProduct(productId: string | null) {
  const { lastSyncAt } = useOfflineStatus();
  const [product, setProduct] = useState<MirroredProductRow | null | undefined>(undefined);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    void getMirroredProduct(productId).then((row) => {
      if (!cancelled) setProduct(row);
    });
    const unsub = subscribeReplicaChanged(() => {
      void getMirroredProduct(productId).then((row) => {
        if (!cancelled) setProduct(row);
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [productId, lastSyncAt]);

  return product;
}

export function useCustomersList(options: { search: string; includeInactive: boolean }) {
  const { online, serveLocal, ready, lastSyncAt } = useMirrorListGate();
  const useRemote = online && ready && !serveLocal;
  const remote = useQuery(
    api.customers.list,
    useRemote
      ? {
          search: options.search || undefined,
          includeInactive: options.includeInactive,
        }
      : "skip",
  );
  const [local, setLocal] = useState<MirroredCustomer[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMirroredCustomers({
      search: options.search || undefined,
      includeInactive: options.includeInactive,
    }).then((rows) => {
      if (!cancelled) setLocal(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [options.search, options.includeInactive, remote, lastSyncAt, serveLocal]);

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
    }));

  if (serveLocal && local !== null) {
    return { customers: mapLocal(local), loading: false, source: "local" as const };
  }
  if (online && remote !== undefined) {
    return { customers: remote, loading: false, source: "remote" as const };
  }
  if (local !== null) {
    return { customers: mapLocal(local), loading: false, source: "local" as const };
  }
  if (remote !== undefined) {
    return { customers: remote, loading: false, source: "remote" as const };
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
  const { online, serveLocal, ready, lastSyncAt } = useMirrorListGate();
  const [local, setLocal] = useState<Awaited<ReturnType<typeof listLocalOrders>>>(null);
  const replicaEmpty = local !== null && local.length === 0;
  const useLocal = serveLocal && !replicaEmpty;
  const useRemote = online && ready && !useLocal;
  const remote = useQuery(
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
    return () => {
      cancelled = true;
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
    useLocal,
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
      total: o.total,
      status: o.status === "synced" ? "completed" : o.status,
      refundedAmount: o.refundedAmount,
    };
  }

  if (online && remote !== undefined) {
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

  if ((useLocal || !online) && local !== null) {
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
  const { online, serveLocal, ready } = useMirrorListGate();
  const useRemote = online && ready && !serveLocal;
  const remote = useQuery(
    api.suppliers.list,
    useRemote ? { search: options.search || undefined, includeInactive: options.includeInactive } : "skip",
  );
  const local = useMirrorRows(
    () => listMirroredSuppliers({ search: options.search, includeInactive: options.includeInactive }),
    [options.search, options.includeInactive],
  );
  if (serveLocal && local) return { suppliers: local, loading: false };
  if (online && remote !== undefined) {
    return {
      suppliers: remote.map((row) => ({
        id: String(row._id),
        name: row.name,
        contactName: row.contactName ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
        address: row.address ?? null,
        notes: row.notes ?? null,
        status: row.status,
        createdAt: row.createdAt,
      })),
      loading: false,
    };
  }
  if (local) return { suppliers: local, loading: false };
  return { suppliers: [] as Awaited<ReturnType<typeof listMirroredSuppliers>>, loading: remote === undefined && local === null };
}

export function useWholesaleLists(search: string) {
  const { online, serveLocal, ready } = useMirrorListGate();
  const useRemote = online && ready && !serveLocal;
  const stock = useQuery(api.wholesale.listStock, useRemote ? { search } : "skip");
  const summary = useQuery(api.wholesale.summary, useRemote ? {} : "skip");
  const purchases = useQuery(api.wholesale.listPurchases, useRemote ? {} : "skip");
  const transfers = useQuery(api.wholesale.listTransfers, useRemote ? {} : "skip");
  const localStock = useMirrorRows(() => listMirroredWholesaleStock(search), [search]);
  const localPurchases = useMirrorRows(() => listMirroredWholesalePurchases(), []);
  const localTransfers = useMirrorRows(() => listMirroredWholesaleTransfers(), []);
  const [localSummary, setLocalSummary] = useState<{ units: number; value: number; skuCount: number } | null>(
    null,
  );
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

  const preferLocal = serveLocal || !online;
  return {
    stock: preferLocal ? localStock : (stock ?? localStock),
    summary: preferLocal ? localSummary : (summary ?? localSummary),
    purchases: preferLocal ? localPurchases : (purchases ?? localPurchases),
    transfers: preferLocal ? localTransfers : (transfers ?? localTransfers),
  };
}

export function useBranchesList(includeInactive = false) {
  const { online, serveLocal, ready } = useMirrorListGate();
  const local = useMirrorRows(() => listMirroredBranches(includeInactive), [includeInactive]);
  const mappedLocal = local?.map((row) => ({
    id: row.id as Id<"branches">,
    name: row.name,
    code: row.code,
    address: row.address,
    phone: row.phone,
    status: row.status,
  }));
  const replicaEmpty = local !== null && local.length === 0;
  const useRemote = online && ready && (!serveLocal || replicaEmpty);
  const remote = useQuery(api.branches.list, useRemote ? { includeInactive } : "skip");
  if (serveLocal && mappedLocal && mappedLocal.length > 0) return mappedLocal;
  if (online && remote !== undefined) return remote;
  return mappedLocal ?? remote;
}

export function useUsersList(search: string) {
  const { online, serveLocal, ready } = useMirrorListGate();
  const local = useMirrorRows(() => listMirroredUsers(search), [search]);
  const mappedLocal = local?.map((row) => ({
    ...row,
    id: row.id as Id<"profiles">,
    branchId: (row.branchId as Id<"branches"> | null) ?? null,
    role: row.role as "administrator" | "manager" | "cashier",
    status: (row.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
    presence: row.presence ?? ("offline" as const),
    lastSeenAt: row.lastSeenAt ?? null,
    lastLoginAt: row.lastLoginAt ?? null,
    lastDevice: row.lastDevice ?? null,
  }));
  const replicaEmpty = local !== null && local.length === 0;
  const useRemote = online && ready && (!serveLocal || replicaEmpty);
  const remote = useQuery(
    api.users.list,
    useRemote ? { search: search || undefined } : "skip",
  );
  if (serveLocal && mappedLocal && mappedLocal.length > 0) return mappedLocal;
  if (online && remote !== undefined) return remote;
  return mappedLocal ?? remote;
}

export function useReturnsList(options: {
  search: string;
  kind: "all" | "full" | "partial";
  branchId?: Id<"branches">;
}) {
  const { online, serveLocal, ready } = useMirrorListGate();
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
  const replicaEmpty = local !== null && local.length === 0;
  const useRemote = online && ready && (!serveLocal || replicaEmpty);
  const remote = useQuery(
    api.returns.list,
    useRemote
      ? {
          search: options.search || undefined,
          kind: options.kind === "all" ? undefined : options.kind,
          branchId: options.branchId,
        }
      : "skip",
  );
  if (serveLocal && local && local.length > 0) return local;
  if (online && remote !== undefined) return remote;
  return local ?? remote;
}

export function useLocalExpenses(range: { startDate: number; endDate: number } | null) {
  return useMirrorRows(
    () => (range ? listMirroredExpenses(range) : Promise.resolve([])),
    [range?.startDate, range?.endDate],
  );
}

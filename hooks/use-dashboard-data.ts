"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBusinessDataGate } from "@/hooks/use-business-data-gate";
import { usePermissions } from "@/hooks/use-permissions";
import { useOfflineStatus } from "@/providers/offline-provider";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import {
  buildLocalDashboardSummary,
  loadDashboardSummary,
  saveDashboardSummary,
  type DashboardSummaryCache,
} from "@/lib/offline/ui-cache";

export type DashboardData = DashboardSummaryCache & {
  source: "remote" | "cache" | "local";
};

export type HospitalityOpsSnapshot = {
  hotel: {
    roomsAvailable: number;
    roomsOccupied: number;
    roomsDirty: number;
    roomsMaintenance: number;
    arrivalsToday: number;
    departuresToday: number;
    openFolios: number;
    outstandingFolioBalance: number | null;
  } | null;
  dining: {
    occupiedTables: number;
    openChecks: number;
    pendingKitchenTickets: number;
    readyTickets: number;
  } | null;
};

const EMPTY_HOSPITALITY: HospitalityOpsSnapshot = { hotel: null, dining: null };

type RemoteDashboard = {
  role: string;
  branchId: Id<"branches"> | null;
  kpis: DashboardSummaryCache["kpis"];
  lowStock: Array<{
    id: string;
    productId: Id<"products"> | string;
    name: string;
    stockQuantity: number;
    unit: string;
    lowStockThreshold: number;
    costPrice?: number;
    branchId: Id<"branches"> | string | null;
    branchName: string | null;
  }>;
  expiryAlerts?: Array<{
    id: string;
    productId: Id<"products"> | string;
    name: string;
    sellableQuantity: number;
    expiredQuantity: number;
    nearestExpiry: string | null;
    isExpired: boolean;
    isExpiring: boolean;
    unit: string;
    branchId: Id<"branches"> | string | null;
    branchName: string | null;
  }>;
  topProducts: Array<{ id: string; name: string; total: number; quantity: number }>;
  recentSales: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    itemCount: number;
    total: number;
    completedAt: number;
  }>;
  salesTrend: Array<{ date: string; total: number }>;
  salesByCategory: Array<{ name: string; total: number }>;
  finance?: {
    inventoryValueCost: number | null;
    inventoryValueSell: number;
    revenue: number;
    cogs: number | null;
    grossProfit: number | null;
  } | null;
};

function cacheKeyFor(isAdmin: boolean, branchFilter: Id<"branches"> | "all") {
  return isAdmin && branchFilter !== "all" ? String(branchFilter) : "all";
}

function cacheMatchesScope(cache: DashboardSummaryCache, branchKey: string) {
  if (branchKey === "all") return !cache.branchId;
  return cache.branchId === branchKey;
}

function isEmptySummary(summary: DashboardSummaryCache): boolean {
  return (
    summary.kpis.revenue === 0 &&
    summary.kpis.orders === 0 &&
    summary.kpis.itemsSold === 0 &&
    summary.kpis.lowStockCount === 0 &&
    (summary.kpis.customersEstimate ?? 0) === 0 &&
    summary.recentSales.length === 0 &&
    summary.topProducts.length === 0
  );
}

function mapRemote(remote: RemoteDashboard): DashboardData {
  return {
    role: remote.role,
    branchId: remote.branchId ? String(remote.branchId) : null,
    kpis: remote.kpis,
    lowStock: remote.lowStock.map((row) => ({
      id: String(row.id),
      productId: String(row.productId),
      name: row.name,
      stockQuantity: row.stockQuantity,
      unit: row.unit,
      lowStockThreshold: row.lowStockThreshold,
      costPrice: row.costPrice,
      branchId: row.branchId ? String(row.branchId) : null,
      branchName: row.branchName,
    })),
    expiryAlerts: (remote.expiryAlerts ?? []).map((row) => ({
      id: String(row.id),
      productId: String(row.productId),
      name: row.name,
      sellableQuantity: row.sellableQuantity,
      expiredQuantity: row.expiredQuantity,
      nearestExpiry: row.nearestExpiry,
      isExpired: row.isExpired,
      isExpiring: row.isExpiring,
      unit: row.unit,
      branchId: row.branchId ? String(row.branchId) : null,
      branchName: row.branchName,
    })),
    topProducts: remote.topProducts.map((row) => ({
      id: String(row.id),
      name: row.name,
      total: row.total,
      quantity: row.quantity,
    })),
    recentSales: remote.recentSales.map((row) => ({
      id: String(row.id),
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      itemCount: row.itemCount,
      total: row.total,
      completedAt: row.completedAt,
    })),
    salesTrend: remote.salesTrend,
    salesByCategory: remote.salesByCategory,
    finance: remote.finance ?? null,
    cachedAt: Date.now(),
    source: "remote",
  };
}

function toCachePayload(remote: RemoteDashboard): Omit<DashboardSummaryCache, "cachedAt"> {
  const mapped = mapRemote(remote);
  return {
    role: mapped.role,
    branchId: mapped.branchId,
    kpis: mapped.kpis,
    lowStock: mapped.lowStock,
    expiryAlerts: mapped.expiryAlerts,
    topProducts: mapped.topProducts,
    recentSales: mapped.recentSales,
    salesTrend: mapped.salesTrend,
    salesByCategory: mapped.salesByCategory,
    finance: mapped.finance ?? null,
  };
}

/**
 * Local-first dashboard.
 *
 * A warm Dexie mirror serves the normal operational view. Convex is reserved
 * for cold bootstrap and explicit historical ranges, avoiding an always-on
 * raw-data subscription while preserving cloud-authoritative reports.
 */
export function useDashboardData(
  branchFilter: Id<"branches"> | "all",
  requestedRange?: { startDate: number; endDate: number },
) {
  const online = useConnectivity();
  const { isAuthenticated } = useConvexAuth();
  const { lastSyncAt } = useOfflineStatus();
  const { serveLocal, ready: businessSourceReady } = useBusinessDataGate();
  const { isAdmin, role } = usePermissions();
  const branchKey = cacheKeyFor(isAdmin, branchFilter);
  const showOps = role === "administrator" || role === "manager";
  const range = showOps ? requestedRange : undefined;
  const cacheKey = range
    ? `${branchKey}:${range.startDate}:${range.endDate}`
    : `${branchKey}:today`;
  const [localData, setLocalData] = useState<DashboardData | null>(null);
  const [acceptEmptyLocal, setAcceptEmptyLocal] = useState(false);
  // Cold till only. Admin/manager always pass a periodRange (default last 7 days),
  // so `|| range` previously kept dashboard.summary subscribed all day on warm
  // Dexie tills and dominated Convex database bandwidth. Historical UI ranges
  // rebuild from the mirror; background snapshot is the bulk refresh path.
  const shouldQueryRemote = Boolean(
    online && isAuthenticated && businessSourceReady && !serveLocal,
  );

  const remote = useQuery(
    api.dashboard.summary,
    shouldQueryRemote
      ? {
          branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
          startDate: range?.startDate,
          endDate: range?.endDate,
        }
      : "skip",
  );

  const hospitalityRemote = useQuery(
    api.dashboard.hospitalityOps,
    shouldQueryRemote
      ? {
          branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
        }
      : "skip",
  );

  const hospitality: HospitalityOpsSnapshot =
    hospitalityRemote === undefined
      ? EMPTY_HOSPITALITY
      : {
          hotel: hospitalityRemote.hotel,
          dining: hospitalityRemote.dining,
        };

  useEffect(() => {
    setAcceptEmptyLocal(false);
    setLocalData(null);
  }, [cacheKey, role]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    const loadLocal = () => {
      void (async () => {
        const cached = await loadDashboardSummary(cacheKey);
        if (cancelled) return;
        if (cached && cacheMatchesScope(cached, branchKey) && cached.role === role) {
          // Prefer a warm non-empty cache for instant paint; empty zeros are
          // ignored while online so we do not flash false KPIs before Convex.
          if (!online || !isEmptySummary(cached)) {
            setLocalData({ ...cached, source: "cache" });
          }
        }
        // Always rebuild from Dexie (including after sales / replica events).
        // Returning early while online froze KPIs for the whole shift once the
        // warm cache painted — without reopening dashboard.summary.
        const local = await buildLocalDashboardSummary(
          role as AppRole,
          branchKey === "all" ? undefined : branchKey,
          range,
        );
        if (cancelled) return;
        if (shouldQueryRemote && isEmptySummary(local)) {
          // Keep waiting for remote rather than locking in zeros.
          return;
        }
        setLocalData({ ...local, source: "local" });
        if (!isEmptySummary(local)) {
          await saveDashboardSummary(local, cacheKey);
        }
      })();
    };

    loadLocal();
    const unsub = subscribeReplicaChanged(loadLocal);

    // If Convex hangs (auth race after Electron restart), unlock with Dexie.
    const giveUp = window.setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        const local = await buildLocalDashboardSummary(
          role as AppRole,
          branchKey === "all" ? undefined : branchKey,
          range,
        );
        if (cancelled) return;
        setAcceptEmptyLocal(true);
        setLocalData((prev) => prev ?? { ...local, source: "local" });
      })();
    }, 8_000);

    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      unsub();
    };
  }, [
    role,
    branchKey,
    cacheKey,
    range,
    online,
    isAuthenticated,
    lastSyncAt,
    shouldQueryRemote,
  ]);

  useEffect(() => {
    if (!remote) return;
    const mapped = mapRemote(remote);
    void saveDashboardSummary(toCachePayload(remote), cacheKey).then(() => {
      setLocalData(mapped);
    });
  }, [remote, cacheKey]);

  if (remote) {
    return { data: mapRemote(remote), loading: false, hospitality };
  }

  if (
    localData &&
    cacheMatchesScope(localData, branchKey) &&
    (!role || localData.role === role) &&
    (acceptEmptyLocal || !(shouldQueryRemote && isEmptySummary(localData)))
  ) {
    return { data: localData, loading: false, hospitality };
  }

  // Online + auth: Convex is in flight (or briefly unavailable). Offline: still
  // building Dexie. Either way show skeleton instead of false zeros.
  return { data: null, loading: true, hospitality };
}

/** @deprecated Kept for unit tests that imported the mirror-wait helper. */
export async function shouldWaitForFirstMirror(input: {
  online: boolean;
  lastSnap: number | null;
  empty: boolean;
}): Promise<boolean> {
  void input;
  return false;
}

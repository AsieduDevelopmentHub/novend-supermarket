"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import {
  buildLocalDashboardSummary,
  loadDashboardSummary,
  saveDashboardSummary,
  type DashboardSummaryCache,
} from "@/lib/offline/ui-cache";

export type DashboardData = DashboardSummaryCache & {
  source: "remote" | "cache" | "local";
};

type RemoteDashboard = {
  role: string;
  branchId: Id<"branches"> | null;
  kpis: DashboardSummaryCache["kpis"];
  lowStock: Array<{
    id: string | Id<"products">;
    name: string;
    stockQuantity: number;
    unit: string;
    lowStockThreshold: number;
    costPrice?: number;
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
};

function mapRemote(remote: RemoteDashboard): DashboardData {
  return {
    role: remote.role,
    branchId: remote.branchId ? String(remote.branchId) : null,
    kpis: remote.kpis,
    lowStock: remote.lowStock.map((row) => ({
      id: String(row.id),
      name: row.name,
      stockQuantity: row.stockQuantity,
      unit: row.unit,
      lowStockThreshold: row.lowStockThreshold,
      costPrice: row.costPrice,
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
    cachedAt: 0,
    source: "remote",
  };
}

function cacheKeyFor(isAdmin: boolean, branchFilter: Id<"branches"> | "all") {
  return isAdmin && branchFilter !== "all" ? String(branchFilter) : "all";
}

function cacheMatchesScope(cache: DashboardSummaryCache, branchKey: string) {
  if (branchKey === "all") return !cache.branchId;
  return cache.branchId === branchKey;
}

/**
 * Local-first dashboard, scoped to the selected branch.
 * Always fetches live Convex data while online so switching branches never
 * reuses another branch's (or org-wide) cache.
 */
export function useDashboardData(branchFilter: Id<"branches"> | "all") {
  const online = useConnectivity();
  const { isAdmin, role } = usePermissions();
  const branchKey = cacheKeyFor(isAdmin, branchFilter);
  const [localData, setLocalData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadDashboardSummary(branchKey);
      if (cancelled) return;
      if (cached && cacheMatchesScope(cached, branchKey)) {
        setLocalData({ ...cached, source: "cache" });
        return;
      }
      const local = await buildLocalDashboardSummary(
        (role as AppRole) ?? "cashier",
        branchKey === "all" ? undefined : branchKey,
      );
      if (cancelled) return;
      setLocalData({ ...local, source: "local" });
    })();
    return () => {
      cancelled = true;
    };
  }, [role, branchKey]);

  const remote = useQuery(
    api.dashboard.summary,
    online
      ? {
          branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
        }
      : "skip",
  );

  useEffect(() => {
    if (!remote) return;
    const mapped = mapRemote(remote);
    void saveDashboardSummary(
      {
        role: remote.role,
        branchId: remote.branchId ? String(remote.branchId) : null,
        kpis: remote.kpis,
        lowStock: remote.lowStock.map((row) => ({
          id: String(row.id),
          name: row.name,
          stockQuantity: row.stockQuantity,
          unit: row.unit,
          lowStockThreshold: row.lowStockThreshold,
          costPrice: row.costPrice,
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
      },
      branchKey,
    ).then(() => {
      setLocalData(mapped);
    });
  }, [remote, branchKey]);

  if (remote) {
    return { data: mapRemote(remote), loading: false };
  }
  if (localData && cacheMatchesScope(localData, branchKey)) {
    return { data: localData, loading: false };
  }
  return { data: null, loading: true };
}

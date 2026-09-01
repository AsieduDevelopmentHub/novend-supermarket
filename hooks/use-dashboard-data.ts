"use client";

import { useEffect, useRef, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import { getLastSnapshotAt } from "@/lib/offline/freshness";
import {
  buildLocalDashboardSummary,
  loadDashboardSummary,
  saveDashboardSummary,
  type DashboardSummaryCache,
} from "@/lib/offline/ui-cache";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";

export type DashboardData = DashboardSummaryCache & {
  source: "cache" | "local";
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

/**
 * Dashboard summary is IndexedDB-only. Convex is never queried for this screen —
 * restock, sales, and returns already live in the Dexie replica.
 *
 * While online and the org replica has never been snapshotted, keep loading
 * instead of painting authoritative zeros (post-login race).
 */
export function useDashboardData(branchFilter: Id<"branches"> | "all") {
  const online = useConnectivity();
  const { isAdmin, role } = usePermissions();
  const branchKey = cacheKeyFor(isAdmin, branchFilter);
  const [localData, setLocalData] = useState<DashboardData | null>(null);
  const [waitingForReplica, setWaitingForReplica] = useState(true);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!role) {
      return;
    }

    let cancelled = false;
    const generation = ++generationRef.current;
    let paintCache = true;

    const giveUp = window.setTimeout(() => {
      if (!cancelled) setWaitingForReplica(false);
    }, 12_000);

    const load = () => {
      void (async () => {
        const lastSnap = await getLastSnapshotAt();
        if (cancelled || generation !== generationRef.current) return;

        if (paintCache) {
          paintCache = false;
          if (lastSnap) {
            const cached = await loadDashboardSummary(branchKey);
            if (cancelled || generation !== generationRef.current) return;
            if (
              cached &&
              cacheMatchesScope(cached, branchKey) &&
              cached.role === role
            ) {
              setLocalData({ ...cached, source: "cache" });
              setWaitingForReplica(false);
            }
          }
        }

        const local = await buildLocalDashboardSummary(
          role,
          branchKey === "all" ? undefined : branchKey,
        );
        if (cancelled || generation !== generationRef.current) return;

        const empty = isEmptySummary(local);
        if (online && !lastSnap && empty) {
          setWaitingForReplica(true);
          return;
        }

        setLocalData({ ...local, source: "local" });
        setWaitingForReplica(false);
        if (lastSnap || !empty) {
          await saveDashboardSummary(local, branchKey);
        }
      })();
    };

    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      unsub();
    };
  }, [role, branchKey, online]);

  if (!role) {
    return { data: null, loading: true };
  }
  if (
    waitingForReplica &&
    !(localData && cacheMatchesScope(localData, branchKey) && localData.role === role)
  ) {
    return { data: null, loading: true };
  }
  if (localData && cacheMatchesScope(localData, branchKey) && localData.role === role) {
    return { data: localData, loading: false };
  }
  return { data: null, loading: true };
}

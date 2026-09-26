"use client";

import { useEffect, useRef, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePermissions } from "@/hooks/use-permissions";
import { loadCloudPolicy } from "@/lib/offline/cloud-policy";
import { getLastSnapshotAt, mirrorHasCatalog } from "@/lib/offline/freshness";
import {
  buildLocalDashboardSummary,
  loadDashboardSummary,
  saveDashboardSummary,
  type DashboardSummaryCache,
} from "@/lib/offline/ui-cache";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import type { AppRole } from "@/config/navigation";

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
 * True when we should hold the skeleton briefly after login so we do not flash
 * authoritative zeros before the first full_sync mirror lands.
 *
 * Package / local cloud modes never pull that mirror — do not wait for them.
 * A device that already has catalog rows is ready enough to paint.
 */
export async function shouldWaitForFirstMirror(input: {
  online: boolean;
  lastSnap: number | null;
  empty: boolean;
}): Promise<boolean> {
  if (!input.online || input.lastSnap || !input.empty) return false;
  const policy = await loadCloudPolicy();
  if (!policy.shouldUseRealtimeSubscriptions()) return false;
  if (await mirrorHasCatalog()) return false;
  return true;
}

/**
 * Dashboard summary is IndexedDB-only. Convex is never queried for this screen —
 * restock, sales, and returns already live in the Dexie replica.
 *
 * While online on full_sync with an empty fresh replica, keep loading briefly
 * instead of painting zeros — then always paint (even empty) so Electron/Cap
 * never stick on skeletons when the mirror is delayed or skipped.
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
    const scopedBranch = branchKey === "all" ? undefined : branchKey;

    const paintLocal = async (sourceRole: AppRole) => {
      const local = await buildLocalDashboardSummary(sourceRole, scopedBranch);
      if (cancelled || generation !== generationRef.current) return null;
      setLocalData({ ...local, source: "local" });
      setWaitingForReplica(false);
      return local;
    };

    const giveUp = window.setTimeout(() => {
      if (cancelled) return;
      void paintLocal(role);
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
            if (cached && cacheMatchesScope(cached, branchKey) && cached.role === role) {
              setLocalData({ ...cached, source: "cache" });
              setWaitingForReplica(false);
            }
          }
        }

        const local = await buildLocalDashboardSummary(role, scopedBranch);
        if (cancelled || generation !== generationRef.current) return;

        const empty = isEmptySummary(local);
        if (await shouldWaitForFirstMirror({ online, lastSnap, empty })) {
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

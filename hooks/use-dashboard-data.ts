"use client";

import { useEffect, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import type { AppRole } from "@/config/navigation";
import { usePermissions } from "@/hooks/use-permissions";
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

/**
 * Dashboard summary is IndexedDB-only. Convex is never queried for this screen —
 * restock, sales, and returns already live in the Dexie replica.
 */
export function useDashboardData(branchFilter: Id<"branches"> | "all") {
  const { isAdmin, role } = usePermissions();
  const branchKey = cacheKeyFor(isAdmin, branchFilter);
  const [localData, setLocalData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    let paintCache = true;
    const load = () => {
      void (async () => {
        if (paintCache) {
          paintCache = false;
          const cached = await loadDashboardSummary(branchKey);
          if (cancelled) return;
          if (cached && cacheMatchesScope(cached, branchKey)) {
            setLocalData({ ...cached, source: "cache" });
          }
        }
        const local = await buildLocalDashboardSummary(
          (role as AppRole) ?? "cashier",
          branchKey === "all" ? undefined : branchKey,
        );
        if (cancelled) return;
        setLocalData({ ...local, source: "local" });
        await saveDashboardSummary(local, branchKey);
      })();
    };
    load();
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [role, branchKey]);

  if (localData && cacheMatchesScope(localData, branchKey)) {
    return { data: localData, loading: false };
  }
  return { data: null, loading: true };
}

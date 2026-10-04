"use client";

import { useEffect, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadBillingHistory,
  loadBillingOverview,
  saveBillingHistory,
  saveBillingOverview,
  type CachedBillingHistoryRow,
  type CachedBillingOverview,
} from "@/lib/offline/billing-cache";

type CacheSource = "live" | "cache";

export function useBillingOverviewData() {
  const online = useConnectivity();
  const live = useAuthedQuery(api.billing.overview, online ? {} : "skip");
  const [cached, setCached] = useState<CachedBillingOverview | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadBillingOverview().then((row) => {
      if (cancelled) return;
      setCached(row);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    void saveBillingOverview(live);
  }, [live]);

  if (live) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return { data: cached, loading: false, source: "cache" as CacheSource };
  }
  return { data: null, loading: true, source: "cache" as CacheSource };
}

export function useBillingHistoryData() {
  const online = useConnectivity();
  const live = useAuthedQuery(api.billing.history, online ? { limit: 25 } : "skip");
  const [cached, setCached] = useState<CachedBillingHistoryRow[] | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadBillingHistory().then((rows) => {
      if (cancelled) return;
      setCached(rows);
      setCacheReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    void saveBillingHistory(
      live.map((row) => ({
        id: String(row.id),
        amount: row.amount,
        currency: row.currency,
        gateway: row.gateway,
        reference: row.reference,
        status: row.status,
        description: row.description,
        kind: row.kind,
        planKey: row.planKey,
        billingCycle: row.billingCycle,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
      })),
    );
  }, [live]);

  if (live) {
    return { data: live, loading: false, source: "live" as CacheSource };
  }
  if (cacheReady) {
    return { data: cached ?? [], loading: false, source: "cache" as CacheSource };
  }
  return { data: undefined, loading: true, source: "cache" as CacheSource };
}

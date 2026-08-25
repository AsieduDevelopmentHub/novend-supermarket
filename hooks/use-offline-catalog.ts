"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { listLocalCatalogProducts, searchLocalCustomers } from "@/lib/offline/snapshot";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { canServeListsFromMirror } from "@/lib/offline/freshness";
import { useOfflineStatus } from "@/providers/offline-provider";

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  imageUrl: string | null;
  isExpiring?: boolean;
};

function mapRemoteProducts(
  remote: Array<{
    id: string;
    name: string;
    sku: string;
    barcode?: string | null;
    sellingPrice: number;
    stockQuantity: number;
    unit: string;
    imageUrl: string | null;
    isExpiring?: boolean;
  }>,
): CatalogProduct[] {
  return remote.map((p) => ({
    id: p.id as string,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: p.sellingPrice,
    stockQuantity: p.stockQuantity,
    unit: p.unit,
    imageUrl: p.imageUrl,
    isExpiring: p.isExpiring,
  }));
}

/**
 * Branch-scoped product catalog for Sales.
 * Always hydrate Dexie first so Cap false-online never blocks the POS.
 * Prefer live Convex when it settles.
 */
export function useSalesCatalog(search: string, branchId?: Id<"branches"> | null) {
  const { online, lastSyncAt } = useOfflineStatus();
  const branchKey = branchId ?? undefined;
  const remote = useQuery(
    api.sales.catalog,
    online ? { search: search || undefined, branchId: branchKey } : "skip",
  );
  const [local, setLocal] = useState<CatalogProduct[] | null>(null);

  const refreshLocal = useCallback(async () => {
    const rows = await listLocalCatalogProducts(search || undefined, branchKey ?? null);
    setLocal(rows);
  }, [search, branchKey]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listLocalCatalogProducts(search || undefined, branchKey ?? null).then((rows) => {
        if (!cancelled) setLocal(rows ?? []);
      });
    };
    const timer = window.setTimeout(load, 0);
    const unsub = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsub();
    };
  }, [search, branchKey, lastSyncAt]);

  if (online && remote !== undefined) {
    return {
      products: mapRemoteProducts(remote),
      source: "remote" as const,
      loading: false,
      refreshLocal,
    };
  }

  if (local != null) {
    return {
      products: local,
      source: "local" as const,
      loading: false,
      refreshLocal,
    };
  }

  return {
    products: [] as CatalogProduct[],
    source: online ? ("remote" as const) : ("local" as const),
    loading: true,
    refreshLocal,
  };
}

export function useSalesCustomerSearch(query: string) {
  const { online, lastSyncAt } = useOfflineStatus();
  const trimmed = query.trim();
  const [serveLocal, setServeLocal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = !online ? true : await canServeListsFromMirror();
      if (!cancelled) setServeLocal(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, lastSyncAt]);

  const remote = useQuery(
    api.customers.search,
    online && !serveLocal && trimmed.length >= 2 ? { q: query, limit: 6 } : "skip",
  );
  const [localHits, setLocalHits] = useState<
    Array<{ id: string; name: string; phone: string | null }>
  >([]);

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchLocalCustomers(query, 6).then((hits) => {
        if (!cancelled) setLocalHits(hits ?? []);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, trimmed.length, lastSyncAt]);

  const effectiveLocal = trimmed.length < 2 ? [] : localHits;

  if (!online || serveLocal) {
    return effectiveLocal;
  }
  if (remote !== undefined) {
    return remote.map((c) => ({
      id: c.id as string,
      name: c.name,
      phone: c.phone,
    }));
  }
  return effectiveLocal;
}

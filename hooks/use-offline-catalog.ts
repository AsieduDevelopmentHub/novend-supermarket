"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { canServeListsFromMirror } from "@/lib/offline/freshness";
import { listLocalCatalogProducts, searchLocalCustomers } from "@/lib/offline/snapshot";
import { useOfflineStatus } from "@/providers/offline-provider";

export type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stockQuantity: number;
  unit: string;
  imageUrl: string | null;
  isExpiring?: boolean;
};

/**
 * Dexie-first product catalog for Sales.
 * Skips the live Convex catalog subscription when the offline mirror is warm.
 */
export function useSalesCatalog(search: string, branchId?: Id<"branches"> | null) {
  const { online, lastSyncAt } = useOfflineStatus();
  const [serveLocal, setServeLocal] = useState(false);
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Admin cross-branch catalog is not mirrored locally.
      let ok = false;
      if (branchId) ok = false;
      else if (!online) ok = true;
      else ok = await canServeListsFromMirror();
      if (cancelled) return;
      setServeLocal(ok);
      setGateReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, lastSyncAt, branchId]);

  const remote = useQuery(
    api.sales.catalog,
    online && gateReady && !serveLocal
      ? { search: search || undefined, branchId: branchId ?? undefined }
      : "skip",
  );
  const [local, setLocal] = useState<CatalogProduct[] | null>(null);

  const refreshLocal = useCallback(async () => {
    const rows = await listLocalCatalogProducts(search || undefined);
    setLocal(rows);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void listLocalCatalogProducts(search || undefined).then((rows) => {
        if (!cancelled) setLocal(rows);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, lastSyncAt, remote]);

  if (local && local.length > 0) {
    return { products: local, source: "local" as const, loading: false, refreshLocal };
  }
  if (remote !== undefined) {
    return {
      products: remote.map((p) => ({
        id: p.id as string,
        name: p.name,
        sku: p.sku,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
        unit: p.unit,
        imageUrl: p.imageUrl,
        isExpiring: p.isExpiring,
      })),
      source: "remote" as const,
      loading: false,
      refreshLocal,
    };
  }
  if (local) {
    return { products: local, source: "local" as const, loading: false, refreshLocal };
  }
  return {
    products: [] as CatalogProduct[],
    source: "local" as const,
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
